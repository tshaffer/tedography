import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Router as RouterType, type Response } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { PhotoState, MediaType, type MediaAssetAlbumMembership, type MediaAssetPerson } from '@tedography/domain';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import {
  findById,
  createMediaAsset,
  updateMediaAssetAlbumIds,
  updateMediaAssetPeople,
  addEditedAssetId,
  setMediaAssetEditMethod,
} from '../repositories/assetRepository.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';
import {
  clearQueue,
  getQueueEntries,
  removeQueueEntry,
  upsertQueueEntry,
} from '../repositories/editQueueRepository.js';
import { createEditHistoryEntry } from '../repositories/editHistoryRepository.js';
import { buildDisplayFilePlan } from '../import/displayFilePlanning.js';
import { convertHeicToJpeg } from '../import/heicConversion.js';
import { extractImportMetadata } from '../import/exifMetadata.js';
import { classifyExtractedCaptureDate } from '../import/captureProvenance.js';
import { computeSha256ForFile } from '../import/fileHash.js';
import {
  buildThumbnailDerivedRelativePath,
  resolveDerivedAbsolutePath,
} from '../import/derivedStorage.js';
import { getStorageRoots, getStorageRootById } from '../import/storageRoots.js';
import { getMediaSupport } from '../import/supportedMedia.js';
import { generateJpegThumbnail } from '../import/thumbnailGeneration.js';

export const editQueueRoutes: RouterType = Router();

// ─── Manifest type ───────────────────────────────────────────────────────────

interface ManifestEntry {
  sourceAssetId: string;
  originalFilename: string;
  originalBasename: string;
  note: string;
}

interface Manifest {
  exportedAt: string;
  entries: ManifestEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEditPath(): string | null {
  return config.editPath;
}

function requireEditPath(res: Response): string | null {
  const editPath = getEditPath();
  if (!editPath) {
    res.status(400).json({
      error: 'TEDOGRAPHY_EDIT_PATH (or TEDOGRAPHY_AI_QUEUE_EXPORT_PATH) is not configured in .env',
    });
    return null;
  }
  return editPath;
}

/** Find the registered storage root whose absolutePath is a prefix of the edit path. */
function findStorageRootForEditPath(editPath: string): { id: string; absolutePath: string } | null {
  const roots = getStorageRoots();
  // Prefer the longest matching prefix so nested roots win.
  const match = roots
    .filter((r) => editPath.startsWith(r.absolutePath))
    .sort((a, b) => b.absolutePath.length - a.absolutePath.length)[0];
  return match ?? null;
}

function basenameWithoutExt(filename: string): string {
  const ext = path.extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/** Move a file, falling back to copy+delete if src and dest are on different volumes. */
async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
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

/**
 * Matches an edited filename's basename against manifest entries whose original
 * basename is followed immediately by "_edited" (optionally with more characters
 * after, e.g. "_edited_ai", "_edited-2") — this lets more than one edited output
 * exist for the same original, as long as each has a distinct filename. When more
 * than one entry's basename qualifies, the longest one wins to avoid ambiguity.
 */
function findManifestMatchForFilename(filename: string, manifestEntries: ManifestEntry[]): ManifestEntry | null {
  const base = basenameWithoutExt(filename).toLowerCase();
  const matches = manifestEntries.filter((entry) =>
    base.startsWith(`${entry.originalBasename.toLowerCase()}_edited`)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.originalBasename.length - a.originalBasename.length)[0]!;
}

async function readManifest(editPath: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(path.join(editPath, 'manifest.json'), 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

type EditedFileCandidate = { filename: string; manifestEntry: ManifestEntry };

async function findEditedFileCandidates(
  editPath: string
): Promise<{ ok: true; candidates: EditedFileCandidate[] } | { ok: false; error: string }> {
  const manifest = await readManifest(editPath);
  if (!manifest) {
    return { ok: false, error: 'manifest.json not found in edit path. Run Export first.' };
  }

  let allFiles: string[];
  try {
    allFiles = await fs.readdir(editPath);
  } catch {
    return { ok: false, error: 'Failed to read edit path directory' };
  }

  const candidates: EditedFileCandidate[] = [];
  for (const filename of allFiles) {
    const base = basenameWithoutExt(filename).toLowerCase();
    if (!base.includes('_edited')) continue;
    const manifestEntry = findManifestMatchForFilename(filename, manifest.entries);
    if (manifestEntry) {
      candidates.push({ filename, manifestEntry });
    }
  }

  return { ok: true, candidates };
}

// ─── GET / — list queue entries with filenames and album path ────────────────

editQueueRoutes.get('/', async (_req, res) => {
  try {
    const [entries, allNodes] = await Promise.all([getQueueEntries(), listAlbumTreeNodes()]);
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));

    const withDetails = await Promise.all(
      entries.map(async (entry) => {
        const asset = await findById(entry.assetId);
        const filename = asset?.filename ?? entry.assetId;
        const albumIds = asset?.albumIds ?? [];
        const albumId = albumIds[0] ?? null;
        const albumPath = albumId ? buildAlbumPath(albumId, nodesById) : null;
        return { ...entry, filename, albumId, albumPath };
      })
    );
    res.json(withDetails);
  } catch (error) {
    log.error('Failed to get edit queue', error);
    res.status(500).json({ error: 'Failed to get edit queue' });
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

// ─── DELETE /edit-folder — clear all files from edit path ────────────────────

editQueueRoutes.delete('/edit-folder', requireFeature('maintenance'), async (_req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  try {
    const entries = await fs.readdir(editPath, { withFileTypes: true });
    const fileEntries = entries.filter((e) => e.isFile());
    await Promise.all(fileEntries.map((e) => fs.unlink(path.join(editPath, e.name))));
    res.json({ ok: true, deletedCount: fileEntries.length });
  } catch (error) {
    log.error('Failed to clear edit folder', error);
    res.status(500).json({ error: 'Failed to clear edit folder' });
  }
});

// ─── GET /edit-folder — list files currently sitting in the edit folder ──────

editQueueRoutes.get('/edit-folder', requireFeature('maintenance'), async (_req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  try {
    const entries = await fs.readdir(editPath, { withFileTypes: true });
    const fileEntries = entries.filter((e) => e.isFile());
    const files = await Promise.all(
      fileEntries.map(async (e) => {
        const stat = await fs.stat(path.join(editPath, e.name));
        return { filename: e.name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
    );
    files.sort((a, b) => a.filename.localeCompare(b.filename));
    res.json({ files });
  } catch (error) {
    log.error('Failed to list edit folder', error);
    res.status(500).json({ error: 'Failed to list edit folder' });
  }
});

// ─── DELETE /edit-folder/:filename — delete a single file from the edit folder ─

editQueueRoutes.delete('/edit-folder/:filename', requireFeature('maintenance'), async (req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  const filename = req.params.filename as string;
  const targetAbsolutePath = path.resolve(path.join(editPath, filename));
  const editPathResolved = path.resolve(editPath);
  const isDirectChild =
    path.dirname(targetAbsolutePath) === editPathResolved && !filename.includes('/') && !filename.includes('\\');
  if (!isDirectChild) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  try {
    await fs.unlink(targetAbsolutePath);
    res.json({ ok: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    log.error(`Failed to delete edit folder file "${filename}"`, error);
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

// ─── POST /export — copy files + write manifest.json + notes.txt ────────────

editQueueRoutes.post('/export', requireFeature('maintenance'), async (req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  const { assetIds } = req.body as { assetIds?: string[] };
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    res.status(400).json({ error: 'assetIds must be a non-empty array' });
    return;
  }

  try {
    await fs.mkdir(editPath, { recursive: true });
    const entries = await getQueueEntries();
    const entryMap = new Map(entries.map((e) => [e.assetId, e]));

    const noteLines: string[] = [];
    const manifestEntries: ManifestEntry[] = [];

    for (const assetId of assetIds) {
      const entry = entryMap.get(assetId);
      if (!entry) continue;
      const asset = await findById(assetId);
      if (!asset) continue;

      try {
        const srcPath = resolveOriginalAbsolutePathForAsset(asset);
        const destPath = path.join(editPath, asset.filename);
        await fs.copyFile(srcPath, destPath);
        noteLines.push(`${asset.filename}: ${entry.note || '(no note)'}`);
        manifestEntries.push({
          sourceAssetId: asset.id,
          originalFilename: asset.filename,
          originalBasename: basenameWithoutExt(asset.filename),
          note: entry.note,
        });
      } catch (err) {
        log.error(`Failed to copy asset ${assetId}`, err);
        noteLines.push(`${asset.filename}: ERROR - could not copy file`);
      }
    }

    await fs.writeFile(
      path.join(editPath, 'notes.txt'),
      noteLines.join('\n') + '\n',
      'utf-8'
    );

    const manifest: Manifest = { exportedAt: new Date().toISOString(), entries: manifestEntries };
    await fs.writeFile(
      path.join(editPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    res.json({ editPath, count: manifestEntries.length });
  } catch (error) {
    log.error('Failed to export edit queue', error);
    res.status(500).json({ error: 'Failed to export edit queue' });
  }
});

// ─── GET /import/scan — find candidate _edited files, no side effects ───────

editQueueRoutes.get('/import/scan', requireFeature('maintenance'), async (_req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  const result = await findEditedFileCandidates(editPath);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    files: result.candidates.map((c) => ({
      filename: c.filename,
      sourceAssetId: c.manifestEntry.sourceAssetId,
      sourceFilename: c.manifestEntry.originalFilename,
    })),
  });
});

// ─── POST /import — import the given classified _edited files ───────────────

editQueueRoutes.post('/import', requireFeature('maintenance'), async (req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

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

  const scanResult = await findEditedFileCandidates(editPath);
  if (!scanResult.ok) {
    res.status(400).json({ error: scanResult.error });
    return;
  }
  const candidateByFilename = new Map(scanResult.candidates.map((c) => [c.filename, c.manifestEntry]));

  const results: Array<{
    filename: string;
    status: 'imported' | 'skipped' | 'error';
    assetId?: string;
    destPath?: string;
    message?: string;
  }> = [];

  for (const { filename: editedFilename, editMethod } of requestedFiles) {
    const absolutePath = path.join(editPath, editedFilename);

    const manifestEntry = candidateByFilename.get(editedFilename);
    if (!manifestEntry) {
      results.push({ filename: editedFilename, status: 'skipped', message: 'No matching manifest entry for source basename' });
      continue;
    }

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

      // Convert HEIC → JPEG display if needed
      if (displayPlan.requiresDerivedDisplayFile && displayPlan.displayDerivedPath) {
        const targetAbsPath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
        await convertHeicToJpeg({ sourceAbsolutePath: absolutePath, targetAbsolutePath: targetAbsPath });
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

      // Move the edited file from the edit folder to the source asset's folder
      await moveFile(absolutePath, destAbsolutePath);

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
      results.push({ filename: editedFilename, status: 'imported', assetId: newAsset.id, destPath: sourceFileDir });
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
