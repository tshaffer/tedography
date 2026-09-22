import fs from 'node:fs/promises';
import path from 'node:path';
import type { TrashAssetResultDto, TrashAssetsResponse } from '@tedography/domain';
import { deleteAssetsByIds, findByIds } from '../repositories/assetRepository.js';
import { deleteFaceDetectionsForAssetIds } from '../repositories/faceDetectionRepository.js';
import { deleteFaceMatchReviewsForAssetIds } from '../repositories/faceMatchReviewRepository.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { getStorageRootById } from './storageRoots.js';
import { resolveSafeAbsolutePath } from './storagePathUtils.js';

// Originals are moved into a "Trash" subfolder inside their own storage root
// (mirroring their original relative path), never deleted outright, so an
// accidental Trash can still be manually recovered from disk.
const TRASH_SUBFOLDER = 'Trash';

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function findAvailableTrashDestination(preferredAbsolutePath: string): Promise<string> {
  if (!(await pathExists(preferredAbsolutePath))) {
    return preferredAbsolutePath;
  }

  const dir = path.dirname(preferredAbsolutePath);
  const extension = path.extname(preferredAbsolutePath);
  const base = path.basename(preferredAbsolutePath, extension);

  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const candidate = path.join(dir, `${base} (${attempt})${extension}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error('Could not find an available Trash destination filename');
}

async function moveOriginalFileToTrash(input: {
  originalStorageRootId: string;
  originalArchivePath: string;
  originalAbsolutePath: string;
}): Promise<void> {
  const storageRoot = getStorageRootById(input.originalStorageRootId);
  if (!storageRoot) {
    throw new Error(`Storage root not found: ${input.originalStorageRootId}`);
  }

  let sourceIsFile = false;
  try {
    sourceIsFile = (await fs.stat(input.originalAbsolutePath)).isFile();
  } catch {
    sourceIsFile = false;
  }

  if (!sourceIsFile) {
    // Nothing to move — the source file is already gone. Still proceed with
    // deleting the Tedography record so it doesn't linger as a dangling entry.
    return;
  }

  const preferredDestination = resolveSafeAbsolutePath(
    storageRoot,
    `${TRASH_SUBFOLDER}/${input.originalArchivePath}`
  );
  const destination = await findAvailableTrashDestination(preferredDestination);
  await fs.mkdir(path.dirname(destination), { recursive: true });

  try {
    await fs.rename(input.originalAbsolutePath, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(input.originalAbsolutePath, destination);
      await fs.unlink(input.originalAbsolutePath);
    } else {
      throw error;
    }
  }
}

export async function trashAssetsByIds(assetIds: string[]): Promise<TrashAssetsResponse> {
  const normalizedIds = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { results: [] };
  }

  const assets = await findByIds(normalizedIds);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  const results: TrashAssetResultDto[] = [];
  const successfullyTrashedIds: string[] = [];

  for (const assetId of normalizedIds) {
    const asset = assetsById.get(assetId);
    if (!asset) {
      results.push({ assetId, status: 'NotFound', message: 'Asset not found' });
      continue;
    }

    try {
      const originalAbsolutePath = resolveOriginalAbsolutePathForAsset(asset);
      await moveOriginalFileToTrash({
        originalStorageRootId: asset.originalStorageRootId,
        originalArchivePath: asset.originalArchivePath,
        originalAbsolutePath
      });

      results.push({ assetId, filename: asset.filename, status: 'Trashed' });
      successfullyTrashedIds.push(assetId);
    } catch (error) {
      results.push({
        assetId,
        filename: asset.filename,
        status: 'Error',
        message: error instanceof Error ? error.message : 'Failed to trash asset'
      });
    }
  }

  if (successfullyTrashedIds.length > 0) {
    await deleteFaceDetectionsForAssetIds(successfullyTrashedIds);
    await deleteFaceMatchReviewsForAssetIds(successfullyTrashedIds);
    await deleteAssetsByIds(successfullyTrashedIds);
  }

  return { results };
}
