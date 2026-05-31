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
} from '../repositories/assetRepository.js';
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
import { computeSha256ForFile } from '../import/fileHash.js';
import {
  buildThumbnailDerivedRelativePath,
  resolveDerivedAbsolutePath,
} from '../import/derivedStorage.js';
import { getStorageRoots } from '../import/storageRoots.js';
import { getMediaSupport } from '../import/supportedMedia.js';
import { generateJpegThumbnail } from '../import/thumbnailGeneration.js';

export const editQueueRoutes: RouterType = Router();

// ─── Manifest type ───────────────────────────────────────────────────────────

interface ManifestEntry {
  sourceAssetId: string;
  originalFilename: string;
  originalBasename: string;
  prompt: string;
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

// ─── GET / — list queue entries with filenames ────────────────────────────────

editQueueRoutes.get('/', async (_req, res) => {
  try {
    const entries = await getQueueEntries();
    const withFilenames = await Promise.all(
      entries.map(async (entry) => {
        const asset = await findById(entry.assetId);
        return { ...entry, filename: asset?.filename ?? entry.assetId };
      })
    );
    res.json(withFilenames);
  } catch (error) {
    log.error('Failed to get edit queue', error);
    res.status(500).json({ error: 'Failed to get edit queue' });
  }
});

// ─── POST / — add/upsert asset ────────────────────────────────────────────────

editQueueRoutes.post('/', requireFeature('maintenance'), async (req, res) => {
  const { assetId, prompt } = req.body as { assetId?: string; prompt?: string };
  if (!assetId) {
    res.status(400).json({ error: 'assetId is required' });
    return;
  }
  try {
    const entry = await upsertQueueEntry(assetId, prompt ?? '');
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

// ─── POST /export — copy files + write manifest.json + prompts.txt ───────────

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

    const promptLines: string[] = [];
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
        promptLines.push(`${asset.filename}: ${entry.prompt || '(no prompt)'}`);
        manifestEntries.push({
          sourceAssetId: asset.id,
          originalFilename: asset.filename,
          originalBasename: basenameWithoutExt(asset.filename),
          prompt: entry.prompt,
        });
      } catch (err) {
        log.error(`Failed to copy asset ${assetId}`, err);
        promptLines.push(`${asset.filename}: ERROR - could not copy file`);
      }
    }

    await fs.writeFile(
      path.join(editPath, 'prompts.txt'),
      promptLines.join('\n') + '\n',
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

// ─── POST /import — import _edited files back into the library ───────────────

editQueueRoutes.post('/import', requireFeature('maintenance'), async (_req, res) => {
  const editPath = requireEditPath(res);
  if (!editPath) return;

  // 1. Read manifest
  let manifest: Manifest;
  try {
    const raw = await fs.readFile(path.join(editPath, 'manifest.json'), 'utf-8');
    manifest = JSON.parse(raw) as Manifest;
  } catch {
    res.status(400).json({ error: 'manifest.json not found in edit path. Run Export first.' });
    return;
  }

  // 2. Determine which storage root contains the edit path
  const storageRoot = findStorageRootForEditPath(editPath);
  if (!storageRoot) {
    res.status(400).json({
      error: `Edit path (${editPath}) is not within any registered storage root. ` +
        'Ensure TEDOGRAPHY_STORAGE_ROOTS includes a root that is a parent of the edit path.',
    });
    return;
  }

  // Build a basename → manifest entry map for fast lookup
  const byBasename = new Map<string, ManifestEntry>();
  for (const entry of manifest.entries) {
    byBasename.set(entry.originalBasename.toLowerCase(), entry);
  }

  // 3. Scan edit path for *_edited.* files
  let allFiles: string[];
  try {
    allFiles = await fs.readdir(editPath);
  } catch {
    res.status(500).json({ error: 'Failed to read edit path directory' });
    return;
  }

  const editedFiles = allFiles.filter((f) => {
    const base = basenameWithoutExt(f).toLowerCase();
    return base.endsWith('_edited');
  });

  if (editedFiles.length === 0) {
    res.json({ results: [], message: 'No _edited files found in edit path.' });
    return;
  }

  const results: Array<{
    filename: string;
    status: 'imported' | 'skipped' | 'error';
    assetId?: string;
    message?: string;
  }> = [];

  for (const editedFilename of editedFiles) {
    const absolutePath = path.join(editPath, editedFilename);
    const base = basenameWithoutExt(editedFilename).toLowerCase(); // e.g. "img_1234_edited"
    const sourceBasename = base.slice(0, -'_edited'.length);        // e.g. "img_1234"

    const manifestEntry = byBasename.get(sourceBasename);
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
      // Hash
      const originalContentHash = await computeSha256ForFile(absolutePath);
      const fileStat = await fs.stat(absolutePath);
      const originalFileFormat = (mediaSupport.extension ?? 'jpg').replace('.', '').toLowerCase();

      // Relative path within the storage root
      const relativeToRoot = path.relative(storageRoot.absolutePath, absolutePath);

      // EXIF metadata — fall back to source asset where edited file likely stripped it
      const exif = await extractImportMetadata(absolutePath);

      // Display file plan
      const displayPlan = buildDisplayFilePlan({
        originalStorageRootId: storageRoot.id,
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

      // Inherit album memberships from source.
      // Use albumIds directly since albumMemberships may not be populated for older assets.
      const sourceAlbumIds = Array.isArray(sourceAsset.albumIds) ? sourceAsset.albumIds : [];
      const albumMemberships: MediaAssetAlbumMembership[] = sourceAlbumIds.map((albumId) => ({
        albumId,
        manualSortOrdinal: null,
        forceManualOrder: null,
      }));
      const albumIds = sourceAlbumIds;

      // Inherit keywords
      const keywordIds = Array.isArray(sourceAsset.keywordIds) ? [...sourceAsset.keywordIds] : [];

      // Create asset — photoState starts as New
      const newAsset = await createMediaAsset({
        filename: editedFilename,
        mediaType: mediaSupport.mediaType as MediaType,
        photoState: PhotoState.New,
        captureDateTime,
        width: exif.width ?? null,
        height: exif.height ?? null,
        locationLabel,
        locationLatitude,
        locationLongitude,
        city,
        state,
        country,
        importedAt: new Date(),
        originalStorageRootId: storageRoot.id,
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

      // Record in history
      await createEditHistoryEntry({
        sourceAssetId: sourceAsset.id,
        sourceFilename: sourceAsset.filename,
        prompt: manifestEntry.prompt,
        editedFilename,
        status: 'succeeded',
        errorMessage: null,
        editedAssetId: newAsset.id,
      });

      log.info(`Imported edited file ${editedFilename} as asset ${newAsset.id}`);
      results.push({ filename: editedFilename, status: 'imported', assetId: newAsset.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Failed to import ${editedFilename}`, err);
      await createEditHistoryEntry({
        sourceAssetId: manifestEntry.sourceAssetId,
        sourceFilename: manifestEntry.originalFilename,
        prompt: manifestEntry.prompt,
        editedFilename,
        status: 'failed',
        errorMessage: message,
      });
      results.push({ filename: editedFilename, status: 'error', message });
    }
  }

  const importedCount = results.filter((r) => r.status === 'imported').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  res.json({ results, importedCount, errorCount });
});
