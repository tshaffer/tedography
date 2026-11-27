import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Router as RouterType, type Response } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { PhotoState, MediaType, EditType, EDIT_TYPE_VALUES, type MediaAssetAlbumMembership, type MediaAssetPerson } from '@tedography/domain';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import {
  findById,
  findByIds,
  createMediaAsset,
  deleteAssetsByIds,
  updateMediaAssetPeople,
  addEditedAssetId,
  setMediaAssetEditMethod,
} from '../repositories/assetRepository.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';
import {
  bulkUpsertQueueEntries,
  clearQueue,
  getQueueEntries,
  removeQueueEntry,
  updateQueueEntryEditType,
  upsertQueueEntry,
} from '../repositories/editQueueRepository.js';
import { createEditHistoryEntry, getAllHistoryEntries } from '../repositories/editHistoryRepository.js';
import { buildEditLookupResponse, type EditLookupAssetInfo } from '../editLookup/editLookup.js';
import { buildDisplayFilePlan } from '../import/displayFilePlanning.js';
import { convertToDisplayJpeg } from '../import/displayJpegConversion.js';
import { extractImportMetadata } from '../import/exifMetadata.js';
import { classifyExtractedCaptureDate } from '../import/captureProvenance.js';
import { computeSha256ForFile } from '../import/fileHash.js';
import {
  buildThumbnailDerivedRelativePath,
  resolveDerivedAbsolutePath,
} from '../import/derivedStorage.js';
import { getStorageRootById } from '../import/storageRoots.js';
import { getMediaSupport } from '../import/supportedMedia.js';
import { generateJpegThumbnail } from '../import/thumbnailGeneration.js';
import { resolveEditFolders, type EditFolders } from '../editQueue/editFolders.js';
import {
  MANIFEST_FILENAME,
  NOTES_FILENAME,
  basenameWithoutExt,
  exportedNameOf,
  mergeIntoManifest,
  readManifestState,
  type ManifestEntry,
  type ManifestState,
} from '../editQueue/manifest.js';
import { entriesMissingFromManifest } from '../editQueue/exportNames.js';
import { exportNameStore, listExportNames, recordManifestNames } from '../repositories/editExportNameRepository.js';
import { exportOneAsset, type ExportItemResult } from '../editQueue/exportService.js';
import {
  UnsafeDeleteError,
  clearReturnedFiles,
  deleteReturnFile,
  listClearableReturnFiles,
  listReturnFiles,
  scanReturnFolder,
  type ReturnScanResult,
} from '../editQueue/returnFiles.js';
import { placeEditedFile } from '../editQueue/importPlacement.js';

export const editQueueRoutes: RouterType = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves and validates the Edit folders from config. Refuses (rather than
 * guessing) when they overlap each other or the library's own storage, so a bad
 * configuration can never lead to a destructive operation.
 */
async function loadEditFolders(): Promise<{ ok: true; folders: EditFolders } | { ok: false; status: number; error: string }> {
  if (!config.editPath) {
    return {
      ok: false,
      status: 400,
      error: 'TEDOGRAPHY_EDIT_PATH (or TEDOGRAPHY_AI_QUEUE_EXPORT_PATH) is not configured in .env',
    };
  }
  const result = await resolveEditFolders({
    editPath: config.editPath,
    exportPath: config.editExportPath,
    returnPath: config.editReturnPath,
    protectedPaths: [
      ...config.storageRoots.map((r) => r.absolutePath),
      config.derivedRoot,
      ...(config.unrotatedRoot ? [config.unrotatedRoot] : []),
    ],
  });
  if (!result.ok) {
    return { ok: false, status: 500, error: `Edit folder configuration error: ${result.error}` };
  }
  return { ok: true, folders: result.folders };
}

async function requireEditFolders(res: Response): Promise<EditFolders | null> {
  const result = await loadEditFolders();
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return null;
  }
  return result.folders;
}

interface SourceEntries {
  manifestStatus: ManifestState['status'];
  // Every known source-to-working-copy link: the manifest's, plus any recorded in
  // the database that it lacks.
  entries: ManifestEntry[];
  // The latter alone, to be written back to the manifest when it is next saved.
  restored: ManifestEntry[];
}

/**
 * Reads the links between working filenames and their source photos. A damaged
 * manifest yields nothing, so that it gets looked at rather than worked around.
 */
async function loadSourceEntries(editPath: string): Promise<SourceEntries> {
  const manifest = await readManifestState(editPath);
  if (manifest.status === 'unreadable') {
    return { manifestStatus: manifest.status, entries: [], restored: [] };
  }
  const [records, queue] = await Promise.all([listExportNames(), getQueueEntries()]);
  const notes = new Map(queue.map((e) => [e.assetId, e.note]));
  const restored = entriesMissingFromManifest(records, manifest.entries, (assetId) => notes.get(assetId) ?? '');
  return { manifestStatus: manifest.status, entries: [...manifest.entries, ...restored], restored };
}

function importBlocker(source: SourceEntries): string | null {
  if (source.manifestStatus === 'unreadable') {
    return `${MANIFEST_FILENAME} in the edit folder could not be read. It has been left as it is.`;
  }
  if (source.manifestStatus === 'missing' && source.entries.length === 0) {
    return `${MANIFEST_FILENAME} not found in the edit folder. Run Export first.`;
  }
  return null;
}

type AlbumNodeMap = Map<string, { label: string; parentId: string | null }>;

function buildAlbumPath(albumId: string, nodesById: AlbumNodeMap): string | null {
  const parts: string[] = [];
  let currentId: string | null = albumId;
  let depth = 0;
  while (currentId && depth < 20) {
    const node = nodesById.get(currentId);
    if (!node) break;
    parts.unshift(node.label);
    currentId = node.parentId;
    depth++;
  }
  return parts.length > 0 ? parts.join(' → ') : null;
}

// ─── GET / — list queue entries with filenames and album path ────────────────

editQueueRoutes.get('/', async (_req, res) => {
  try {
    const [entries, allNodes] = await Promise.all([getQueueEntries(), listAlbumTreeNodes()]);
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));

    const loaded = await loadEditFolders();
    const orphansByBasenameLower = new Map<string, string[]>();
    const ambiguousByAssetId = new Map<string, string[]>();
    let workingNames = new Map<string, string>();
    if (loaded.ok) {
      const { entries: manifestEntries } = await loadSourceEntries(loaded.folders.editPath);
      workingNames = new Map(manifestEntries.map((e) => [e.sourceAssetId, exportedNameOf(e)]));
      const scan = await scanReturnFolder(loaded.folders.returnPath, manifestEntries);
      for (const orphan of scan.unmatched) {
        if (!orphan.inferredBasename) continue;
        const key = orphan.inferredBasename.toLowerCase();
        const list = orphansByBasenameLower.get(key) ?? [];
        list.push(orphan.filename);
        orphansByBasenameLower.set(key, list);
      }
      for (const item of scan.ambiguous) {
        for (const candidate of item.candidates) {
          const list = ambiguousByAssetId.get(candidate.sourceAssetId) ?? [];
          list.push(item.filename);
          ambiguousByAssetId.set(candidate.sourceAssetId, list);
        }
      }
    }

    const withDetails = await Promise.all(
      entries.map(async (entry) => {
        const asset = await findById(entry.assetId);
        const filename = asset?.filename ?? entry.assetId;
        const albumIds = asset?.albumIds ?? [];
        const albumId = albumIds[0] ?? null;
        const albumPath = albumId ? buildAlbumPath(albumId, nodesById) : null;
        const workingFilename = workingNames.get(entry.assetId) ?? null;
        const orphanKeys = new Set(
          [filename, ...(workingFilename ? [workingFilename] : [])].map((n) => basenameWithoutExt(n).toLowerCase())
        );
        const orphanedEditFilenames = [...orphanKeys].flatMap((key) => orphansByBasenameLower.get(key) ?? []);
        const isExported = workingFilename != null;
        const ambiguousEditFilenames = ambiguousByAssetId.get(entry.assetId) ?? [];
        return { ...entry, filename, workingFilename, albumId, albumPath, orphanedEditFilenames, ambiguousEditFilenames, isExported };
      })
    );
    res.json(withDetails);
  } catch (error) {
    log.error('Failed to get edit queue', error);
    res.status(500).json({ error: 'Failed to get edit queue' });
  }
});

// ─── GET /lookup — search the queue and Edit History by filename / folder ─────
//
// `q` is plain text with `*` and `?` wildcards (see editLookup/patternMatch.ts).
// Read-only, so — like GET / — it is not gated behind the maintenance feature.

editQueueRoutes.get('/lookup', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    const [queueEntries, historyEntries, allNodes, exportNames] = await Promise.all([
      getQueueEntries(),
      getAllHistoryEntries(),
      listAlbumTreeNodes(),
      listExportNames()
    ]);
    const workingNamesByAssetId = new Map(exportNames.map((r) => [r.assetId, r.exportedFilename]));
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));

    const assetIds = Array.from(
      new Set([
        ...queueEntries.map((e) => e.assetId),
        ...historyEntries.map((e) => e.sourceAssetId),
        ...workingNamesByAssetId.keys()
      ])
    );
    const assets = await findByIds(assetIds);
    const assetsById = new Map<string, EditLookupAssetInfo>();
    for (const asset of assets) {
      const archivePath = asset.originalArchivePath ?? asset.archivePath ?? '';
      const folder = path.posix.dirname(archivePath.replace(/\\/g, '/'));
      const albumId = asset.albumIds?.[0] ?? null;
      assetsById.set(asset.id, {
        filename: asset.filename,
        folder: folder === '.' ? '' : folder,
        albumId,
        albumPath: albumId ? buildAlbumPath(albumId, nodesById) : null
      });
    }

    res.json(buildEditLookupResponse({ query, queueEntries, historyEntries, assetsById, workingNamesByAssetId }));
  } catch (error) {
    log.error('Failed to search edit queue and history', error);
    res.status(500).json({ error: 'Failed to search edit queue and history' });
  }
});

// ─── POST / — add/upsert asset ────────────────────────────────────────────────

editQueueRoutes.post('/', requireFeature('maintenance'), async (req, res) => {
  const { assetId, note } = req.body as { assetId?: string; note?: string };
  if (!assetId) {
    res.status(400).json({ error: 'assetId is required' });
    return;
  }
  try {
    const entry = await upsertQueueEntry(assetId, note ?? '');
    res.json(entry);
  } catch (error) {
    log.error('Failed to add to edit queue', error);
    res.status(500).json({ error: 'Failed to add to edit queue' });
  }
});

// ─── POST /bulk — add many assets with one shared note + edit type ───────────

editQueueRoutes.post('/bulk', requireFeature('maintenance'), async (req, res) => {
  const { assetIds, note, editType } = req.body as {
    assetIds?: unknown;
    note?: unknown;
    editType?: unknown;
  };
  if (!Array.isArray(assetIds) || assetIds.length === 0 || !assetIds.every((id) => typeof id === 'string')) {
    res.status(400).json({ error: 'assetIds must be a non-empty array of strings' });
    return;
  }
  if (note != null && typeof note !== 'string') {
    res.status(400).json({ error: 'note must be a string' });
    return;
  }
  const resolvedEditType = editType == null ? EditType.Unspecified : editType;
  if (!EDIT_TYPE_VALUES.includes(resolvedEditType as EditType)) {
    res.status(400).json({ error: `editType must be one of: ${EDIT_TYPE_VALUES.join(', ')}` });
    return;
  }
  try {
    const result = await bulkUpsertQueueEntries(
      assetIds as string[],
      (note as string | undefined) ?? '',
      resolvedEditType as EditType
    );
    res.json({ addedCount: result.added.length, skippedCount: result.skipped.length, ...result });
  } catch (error) {
    log.error('Failed to bulk add to edit queue', error);
    res.status(500).json({ error: 'Failed to bulk add to edit queue' });
  }
});

// ─── DELETE / — clear queue ───────────────────────────────────────────────────

editQueueRoutes.delete('/', requireFeature('maintenance'), async (_req, res) => {
  try {
    await clearQueue();
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to clear edit queue', error);
    res.status(500).json({ error: 'Failed to clear edit queue' });
  }
});

// ─── GET /edit-folder — what the Edit Queue folders currently hold ───────────
//
// Only the return folder's contents are listed for action. The export folder
// ("Active Edits") belongs to Lightroom and the user, so it is summarized
// read-only from the manifest and nothing in it is ever offered for deletion.

editQueueRoutes.get('/edit-folder', requireFeature('maintenance'), async (_req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  try {
    const { entries, manifestStatus } = await loadSourceEntries(folders.editPath);
    const scan = await scanReturnFolder(folders.returnPath, entries);
    const returnFiles = await listReturnFiles(folders.returnPath);
    const clearable = await listClearableReturnFiles(folders.returnPath);

    let exportedPresentCount = 0;
    for (const entry of entries) {
      const present = await fs.lstat(path.join(folders.exportPath, exportedNameOf(entry))).then(() => true, () => false);
      if (present) exportedPresentCount++;
    }

    const matchedNames = new Set(scan.matched.map((m) => m.filename));
    const ambiguousNames = new Set(scan.ambiguous.map((m) => m.filename));
    const unmatchedNames = new Set(scan.unmatched.map((m) => m.filename));
    res.json({
      folders,
      manifest: { exists: manifestStatus === 'ok', entryCount: entries.length },
      notesExists: await fs.lstat(path.join(folders.editPath, NOTES_FILENAME)).then(() => true, () => false),
      exportedEntryCount: entries.length,
      exportedPresentCount,
      files: returnFiles.map((file) => ({
        ...file,
        importStatus: matchedNames.has(file.filename)
          ? 'ready'
          : ambiguousNames.has(file.filename)
            ? 'ambiguous'
            : unmatchedNames.has(file.filename)
              ? 'unmatched'
              : 'other',
      })),
      ambiguous: scan.ambiguous.map((item) => ({
        filename: item.filename,
        candidates: item.candidates.map((c) => ({ sourceAssetId: c.sourceAssetId, sourceFilename: c.originalFilename })),
      })),
      clearableFilenames: clearable.map((f) => f.filename),
    });
  } catch (error) {
    log.error('Failed to list edit folder', error);
    res.status(500).json({ error: 'Failed to list edit folder' });
  }
});

// ─── DELETE /edit-folder — clear returned edit files (and only those) ─────────
//
// Deletes regular "_edited" files directly inside the return folder. Never
// directories, manifest.json, notes.txt, or anything in the export folder.
// `filenames` limits deletion to what the user confirmed.

editQueueRoutes.delete('/edit-folder', requireFeature('maintenance'), async (req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  const body = (req.body ?? {}) as { filenames?: unknown };
  if (body.filenames != null && (!Array.isArray(body.filenames) || !body.filenames.every((f) => typeof f === 'string'))) {
    res.status(400).json({ error: 'filenames must be an array of strings' });
    return;
  }

  try {
    const deleted = await clearReturnedFiles(folders.returnPath, body.filenames as string[] | undefined);
    log.info(`Cleared ${deleted.length} returned edit file(s) from ${folders.returnPath}`);
    res.json({ ok: true, deletedCount: deleted.length, deleted });
  } catch (error) {
    log.error('Failed to clear returned files', error);
    res.status(500).json({ error: 'Failed to clear returned files' });
  }
});

// ─── DELETE /edit-folder/notes — remove notes.txt (never read back) ──────────

editQueueRoutes.delete('/edit-folder/notes', requireFeature('maintenance'), async (_req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;
  try {
    await fs.unlink(path.join(folders.editPath, NOTES_FILENAME)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to delete notes.txt', error);
    res.status(500).json({ error: 'Failed to delete notes.txt' });
  }
});

// ─── DELETE /edit-folder/:filename — delete one file from the return folder ──

editQueueRoutes.delete('/edit-folder/:filename', requireFeature('maintenance'), async (req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  const filename = req.params.filename as string;
  try {
    await deleteReturnFile(folders.returnPath, filename);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof UnsafeDeleteError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    log.error(`Failed to delete returned file "${filename}"`, error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ─── DELETE /:assetId — remove one entry ─────────────────────────────────────

editQueueRoutes.delete('/:assetId', requireFeature('maintenance'), async (req, res) => {
  try {
    await removeQueueEntry(req.params.assetId as string);
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to remove from edit queue', error);
    res.status(500).json({ error: 'Failed to remove from edit queue' });
  }
});

// ─── POST /export — copy originals to the export folder + manifest + notes ───
//
// Never overwrites. Each photo gets one of: exported / alreadyExported /
// previouslyExported / conflict / failed (see editQueue/exportService.ts). Only
// photos with a reliably established working copy are written to the manifest.
// Working filenames are recorded permanently in the database.
// `forceAssetIds` lists previouslyExported photos the user chose to export anyway.

editQueueRoutes.post('/export', requireFeature('maintenance'), async (req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  const { assetIds, forceAssetIds } = req.body as { assetIds?: string[]; forceAssetIds?: string[] };
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    res.status(400).json({ error: 'assetIds must be a non-empty array' });
    return;
  }
  const forced = new Set(Array.isArray(forceAssetIds) ? forceAssetIds : []);

  try {
    await fs.mkdir(folders.editPath, { recursive: true });
    const entries = await getQueueEntries();
    const entryMap = new Map(entries.map((e) => [e.assetId, e]));
    const source = await loadSourceEntries(folders.editPath);
    if (source.manifestStatus === 'unreadable') {
      res.status(500).json({
        error: `${MANIFEST_FILENAME} in the edit folder could not be read. Nothing was exported, and the file has been left as it is.`,
      });
      return;
    }
    // Names listed only in the manifest are recorded too, so they survive its loss.
    await recordManifestNames(source.entries);

    const results: ExportItemResult[] = [];
    const noteLines: string[] = [];
    const newManifestEntries: ManifestEntry[] = [];

    for (const assetId of assetIds) {
      const entry = entryMap.get(assetId);
      if (!entry) {
        results.push({ assetId, filename: assetId, exportedFilename: null, status: 'failed', message: 'Not in the Edit Queue' });
        continue;
      }
      const asset = await findById(assetId);
      if (!asset) {
        results.push({ assetId, filename: assetId, exportedFilename: null, status: 'failed', message: 'Photo not found in the library' });
        continue;
      }

      let sourcePath: string;
      try {
        sourcePath = resolveOriginalAbsolutePathForAsset(asset);
      } catch (err) {
        log.error(`Failed to resolve original for asset ${assetId}`, err);
        results.push({
          assetId,
          filename: asset.filename,
          exportedFilename: null,
          status: 'failed',
          message: 'Could not locate the original file',
        });
        noteLines.push(`${asset.filename}: ERROR - could not locate file`);
        continue;
      }

      const outcome = await exportOneAsset(
        {
          assetId,
          filename: asset.filename,
          sourcePath,
          contentHash: asset.originalContentHash ?? null,
          note: entry.note,
        },
        {
          exportPath: folders.exportPath,
          // Includes this batch's claims, so two same-named photos exported
          // together can't both be tied to one file.
          manifestEntries: [...source.entries, ...newManifestEntries],
          names: exportNameStore,
          force: forced.has(assetId),
          hashFile: computeSha256ForFile,
        }
      );
      results.push(outcome.result);
      if (outcome.manifestEntry) {
        newManifestEntries.push(outcome.manifestEntry);
      }
      // notes.txt is read alongside the working files, so it leads with their names.
      const workingName = outcome.result.exportedFilename;
      const label = workingName && workingName !== asset.filename ? `${workingName} (${asset.filename})` : asset.filename;
      if (outcome.result.status === 'exported' || outcome.result.status === 'alreadyExported') {
        noteLines.push(`${label}: ${entry.note || '(no note)'}`);
      } else {
        noteLines.push(`${label}: NOT EXPORTED (${outcome.result.status})`);
      }
      if (outcome.result.status === 'failed') {
        log.error(`Failed to export asset ${assetId}: ${outcome.result.message}`);
      }
    }

    await fs.writeFile(path.join(folders.editPath, NOTES_FILENAME), noteLines.join('\n') + '\n', 'utf-8');

    // Merge into the existing manifest — never replace it — so edits already
    // produced for photos left out of this batch stay linked to their sources.
    const toSave = [...source.restored, ...newManifestEntries];
    if (toSave.length > 0) {
      await mergeIntoManifest(folders.editPath, toSave);
    }

    const countOf = (status: ExportItemResult['status']): number => results.filter((r) => r.status === status).length;
    res.json({
      editPath: folders.editPath,
      exportPath: folders.exportPath,
      returnPath: folders.returnPath,
      count: countOf('exported'),
      counts: {
        exported: countOf('exported'),
        alreadyExported: countOf('alreadyExported'),
        previouslyExported: countOf('previouslyExported'),
        conflict: countOf('conflict'),
        failed: countOf('failed'),
      },
      results,
    });
  } catch (error) {
    log.error('Failed to export edit queue', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export edit queue' });
  }
});

// ─── GET /import/scan — classify returned files, no side effects ────────────

editQueueRoutes.get('/import/scan', requireFeature('maintenance'), async (_req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  try {
    const source = await loadSourceEntries(folders.editPath);
    const blocker = importBlocker(source);
    if (blocker) {
      res.status(400).json({ error: blocker });
      return;
    }
    const scan = await scanReturnFolder(folders.returnPath, source.entries);
    res.json({
      returnPath: folders.returnPath,
      files: scan.matched.map((m) => ({
        filename: m.filename,
        sourceAssetId: m.entry.sourceAssetId,
        sourceFilename: m.entry.originalFilename,
      })),
      ambiguous: scan.ambiguous.map((a) => ({
        filename: a.filename,
        candidates: a.candidates.map((c) => ({ sourceAssetId: c.sourceAssetId, sourceFilename: c.originalFilename })),
      })),
      unmatched: scan.unmatched.map((u) => ({ filename: u.filename })),
    });
  } catch (error) {
    log.error('Failed to scan return folder', error);
    res.status(500).json({ error: 'Failed to scan the return folder' });
  }
});

// ─── POST /import — import the given classified edited files ────────────────

editQueueRoutes.post('/import', requireFeature('maintenance'), async (req, res) => {
  const folders = await requireEditFolders(res);
  if (!folders) return;

  const { files } = req.body as { files?: { filename?: string; editMethod?: string }[] };
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'files must be a non-empty array' });
    return;
  }
  for (const f of files) {
    if (!f || typeof f.filename !== 'string' || (f.editMethod !== 'ai' && f.editMethod !== 'manual')) {
      res.status(400).json({ error: 'Each file entry requires a filename and editMethod of "ai" or "manual"' });
      return;
    }
  }
  const requestedFiles = files as { filename: string; editMethod: 'ai' | 'manual' }[];

  let scanResult: ReturnScanResult;
  try {
    const source = await loadSourceEntries(folders.editPath);
    const blocker = importBlocker(source);
    if (blocker) {
      res.status(400).json({ error: blocker });
      return;
    }
    if (source.restored.length > 0) {
      await mergeIntoManifest(folders.editPath, source.restored);
    }
    scanResult = await scanReturnFolder(folders.returnPath, source.entries);
  } catch (error) {
    log.error('Failed to prepare import', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to prepare import' });
    return;
  }
  const candidateByFilename = new Map(scanResult.matched.map((c) => [c.filename, c.entry]));
  const ambiguousFilenames = new Set(scanResult.ambiguous.map((a) => a.filename));

  const results: Array<{
    filename: string;
    status: 'imported' | 'skipped' | 'error';
    assetId?: string;
    destPath?: string;
    message?: string;
  }> = [];

  for (const { filename: editedFilename, editMethod } of requestedFiles) {
    // Only a filename the scan classified as unambiguously matched is ever turned
    // into a path, so the request can't name an arbitrary file.
    const manifestEntry = candidateByFilename.get(editedFilename);
    if (!manifestEntry) {
      results.push({
        filename: editedFilename,
        status: 'skipped',
        message: ambiguousFilenames.has(editedFilename)
          ? 'Ambiguous: more than one exported photo could be the source. Left in the return folder untouched.'
          : 'No matching manifest entry for source basename',
      });
      continue;
    }
    const absolutePath = path.join(folders.returnPath, editedFilename);

    const sourceAsset = await findById(manifestEntry.sourceAssetId);
    if (!sourceAsset) {
      results.push({ filename: editedFilename, status: 'error', message: `Source asset ${manifestEntry.sourceAssetId} not found` });
      continue;
    }

    const mediaSupport = getMediaSupport(editedFilename);
    if (!mediaSupport.isSupportedMedia) {
      results.push({ filename: editedFilename, status: 'skipped', message: 'Unsupported media type' });
      continue;
    }

    try {
      // Resolve the storage root that owns the source asset — the edited file moves there
      const sourceStorageRoot = getStorageRootById(sourceAsset.originalStorageRootId);
      if (!sourceStorageRoot) {
        results.push({ filename: editedFilename, status: 'error', message: `Storage root "${sourceAsset.originalStorageRootId}" for source asset not found` });
        continue;
      }

      // Destination: same folder as the source file, keeping the edited filename
      const sourceFileDir = path.dirname(path.join(sourceStorageRoot.absolutePath, sourceAsset.originalArchivePath));
      const destAbsolutePath = path.join(sourceFileDir, editedFilename);
      const relativeToRoot = path.relative(sourceStorageRoot.absolutePath, destAbsolutePath);

      // Hash + stat from the edit folder (before moving)
      const originalContentHash = await computeSha256ForFile(absolutePath);
      const fileStat = await fs.stat(absolutePath);
      const originalFileFormat = (mediaSupport.extension ?? 'jpg').replace('.', '').toLowerCase();

      // EXIF metadata — fall back to source asset where edited file likely stripped it
      const exif = await extractImportMetadata(absolutePath);

      // Display file plan — uses the destination root/path so display references are correct
      const displayPlan = buildDisplayFilePlan({
        originalStorageRootId: sourceStorageRoot.id,
        originalArchivePath: relativeToRoot,
        originalContentHash,
        originalFileFormat,
      });

      // Convert to a display JPEG if this format needs one
      if (displayPlan.requiresDerivedDisplayFile && displayPlan.displayDerivedPath) {
        const targetAbsPath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
        await convertToDisplayJpeg({ sourceAbsolutePath: absolutePath, targetAbsolutePath: targetAbsPath });
      }

      // Thumbnail
      let thumbnailDerivedPath: string | null = null;
      let thumbnailFileFormat: string | null = null;

      if (mediaSupport.mediaType === MediaType.Photo) {
        // Determine source for thumbnail generation
        let thumbSrcPath: string;
        if (displayPlan.requiresDerivedDisplayFile && displayPlan.displayDerivedPath) {
          thumbSrcPath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
        } else {
          thumbSrcPath = absolutePath;
        }

        thumbnailDerivedPath = buildThumbnailDerivedRelativePath(originalContentHash);
        thumbnailFileFormat = 'jpg';
        const thumbnailAbsPath = resolveDerivedAbsolutePath(thumbnailDerivedPath);
        await generateJpegThumbnail({ sourceAbsolutePath: thumbSrcPath, targetAbsolutePath: thumbnailAbsPath });
      }

      // Inherit location: prefer EXIF from edited file, fall back to source asset
      const locationLatitude = (exif.locationLatitude != null) ? exif.locationLatitude : (sourceAsset.locationLatitude ?? null);
      const locationLongitude = (exif.locationLongitude != null) ? exif.locationLongitude : (sourceAsset.locationLongitude ?? null);
      const locationLabel = (locationLatitude != null)
        ? ((exif.locationLabel != null) ? exif.locationLabel : (sourceAsset.locationLabel ?? null))
        : null;
      const city = (locationLatitude != null)
        ? ((exif.city != null) ? exif.city : (sourceAsset.city ?? null))
        : null;
      const state = (locationLatitude != null)
        ? ((exif.state != null) ? exif.state : (sourceAsset.state ?? null))
        : null;
      const country = (locationLatitude != null)
        ? ((exif.country != null) ? exif.country : (sourceAsset.country ?? null))
        : null;

      // Inherit captureDateTime: prefer EXIF from edited file, fall back to source asset
      const sourceCaptureDateTime: Date | null = (() => {
        const v = sourceAsset.captureDateTime;
        if (!v) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
      })();
      const captureDateTime = exif.captureDateTime ?? sourceCaptureDateTime;
      // Edited files often have stripped EXIF; when the date is inherited from the
      // source asset, inherit its provenance too.
      const captureDateTimeSource = exif.captureDateTime
        ? classifyExtractedCaptureDate(exif)
        : (sourceAsset.captureDateTimeSource ?? null);

      // Inherit album memberships from source.
      // Use albumIds directly since albumMemberships may not be populated for older assets.
      const sourceAlbumIds = Array.isArray(sourceAsset.albumIds) ? sourceAsset.albumIds : [];
      const albumMemberships: MediaAssetAlbumMembership[] = sourceAlbumIds.map((albumId) => ({
        albumId,
        manualSortOrdinal: null,
        forceManualOrder: null,
        manualSortTime: null,
      }));
      const albumIds = sourceAlbumIds;

      // Inherit keywords
      const keywordIds = Array.isArray(sourceAsset.keywordIds) ? [...sourceAsset.keywordIds] : [];

      // Copy into the source asset's folder (never overwriting), create the records,
      // and only then delete the file from the return folder. Any failure rolls the
      // copy back and leaves the return file in place for a retry.
      const placement = await placeEditedFile(absolutePath, destAbsolutePath, async () => {
      let createdAssetId: string | null = null;
      try {
      // Create asset — photoState starts as New
      const newAsset = await createMediaAsset({
        filename: editedFilename,
        mediaType: mediaSupport.mediaType as MediaType,
        photoState: PhotoState.New,
        captureDateTime,
        captureDateTimeSource,
        exifCaptureDateTime: exif.captureDateTime,
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        width: exif.width ?? null,
        height: exif.height ?? null,
        locationLabel,
        locationLatitude,
        locationLongitude,
        city,
        state,
        country,
        importedAt: new Date(),
        originalStorageRootId: sourceStorageRoot.id,
        originalArchivePath: relativeToRoot,
        originalFileSizeBytes: fileStat.size,
        originalContentHash,
        originalFileFormat,
        displayStorageType: displayPlan.displayStorageType,
        displayStorageRootId: displayPlan.displayStorageRootId,
        displayArchivePath: displayPlan.displayArchivePath,
        displayDerivedPath: displayPlan.displayDerivedPath,
        displayFileFormat: displayPlan.displayFileFormat,
        thumbnailStorageType: thumbnailDerivedPath ? 'derived-root' : null,
        thumbnailDerivedPath,
        thumbnailFileFormat,
        thumbnailUrl: null,
        albumIds,
        albumMemberships,
        keywordIds,
        sourceAssetId: sourceAsset.id,
        editMethod,
      });
      createdAssetId = newAsset.id;

      // Inherit people from source
      const sourcePeople: MediaAssetPerson[] = (sourceAsset.people ?? []).map((p) => ({
        personId: p.personId,
        displayName: p.displayName,
        source: 'manual-asset-tag' as const,
        confirmedAt: null,
      }));
      if (sourcePeople.length > 0) {
        await updateMediaAssetPeople(newAsset.id, sourcePeople);
      }

      // Link the edited asset back to the source, and remove the now-completed queue entry.
      await Promise.all([
        addEditedAssetId(sourceAsset.id, newAsset.id),
        removeQueueEntry(sourceAsset.id),
      ]);
      return newAsset;
      } catch (err) {
        if (createdAssetId) {
          await deleteAssetsByIds([createdAssetId]).catch((cleanupErr) =>
            log.error(`Failed to roll back asset ${createdAssetId} after import error`, cleanupErr)
          );
        }
        throw err;
      }
      });
      const newAsset = placement.value;

      // Record in history
      await createEditHistoryEntry({
        sourceAssetId: sourceAsset.id,
        sourceFilename: sourceAsset.filename,
        note: manifestEntry.note,
        editedFilename,
        status: 'succeeded',
        errorMessage: null,
        editedAssetId: newAsset.id,
        editMethod,
      });

      log.info(`Imported edited file ${editedFilename} as asset ${newAsset.id}`);
      results.push({
        filename: editedFilename,
        status: 'imported',
        assetId: newAsset.id,
        destPath: sourceFileDir,
        ...(placement.returnFileRemoved
          ? {}
          : { message: 'Imported, but the file could not be deleted from the return folder; remove it manually.' }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Failed to import ${editedFilename}`, err);
      await createEditHistoryEntry({
        sourceAssetId: manifestEntry.sourceAssetId,
        sourceFilename: manifestEntry.originalFilename,
        note: manifestEntry.note,
        editedFilename,
        status: 'failed',
        errorMessage: message,
        editMethod,
      });
      results.push({ filename: editedFilename, status: 'error', message });
    }
  }

  const importedCount = results.filter((r) => r.status === 'imported').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  res.json({ results, importedCount, errorCount });
});

// ─── PATCH /assets/:assetId/edit-method — reclassify an edited copy's method ──

editQueueRoutes.patch('/assets/:assetId/edit-method', requireFeature('maintenance'), async (req, res) => {
  const { assetId } = req.params;
  const { editMethod } = req.body as { editMethod?: string };
  if (editMethod !== 'ai' && editMethod !== 'manual') {
    res.status(400).json({ error: 'editMethod must be "ai" or "manual"' });
    return;
  }

  try {
    const asset = await findById(assetId as string);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    if (asset.sourceAssetId == null) {
      res.status(400).json({ error: 'Only edited-copy assets (with a sourceAssetId) have an edit method' });
      return;
    }
    await setMediaAssetEditMethod(assetId as string, editMethod);
    res.json({ ok: true, editMethod });
  } catch (error) {
    log.error(`Failed to update edit method for asset ${assetId}`, error);
    res.status(500).json({ error: 'Failed to update edit method' });
  }
});

// ─── PATCH /:assetId/edit-type — set an edit queue entry's edit type ─────────

editQueueRoutes.patch('/:assetId/edit-type', requireFeature('maintenance'), async (req, res) => {
  const { assetId } = req.params;
  const { editType } = req.body as { editType?: string };
  if (!EDIT_TYPE_VALUES.includes(editType as EditType)) {
    res.status(400).json({ error: `editType must be one of: ${EDIT_TYPE_VALUES.join(', ')}` });
    return;
  }

  try {
    await updateQueueEntryEditType(assetId as string, editType as EditType);
    res.json({ ok: true, editType });
  } catch (error) {
    log.error(`Failed to update edit type for asset ${assetId}`, error);
    res.status(500).json({ error: 'Failed to update edit type' });
  }
});
