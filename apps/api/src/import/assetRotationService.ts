import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { MediaType, type MediaAsset } from '@tedography/domain';
import {
  findById,
  updateMediaAssetSourceData
} from '../repositories/assetRepository.js';
import { config } from '../config.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { buildDisplayFilePlan } from './displayFilePlanning.js';
import { resolveDerivedAbsolutePath, buildThumbnailDerivedRelativePath } from './derivedStorage.js';
import { extractImportMetadata } from './exifMetadata.js';
import { computeSha256ForFile } from './fileHash.js';
import { generateJpegThumbnail } from './thumbnailGeneration.js';
import { getMediaSupport } from './supportedMedia.js';
import { getStorageRootById } from './storageRoots.js';
import { resolveSafeAbsolutePath } from './storagePathUtils.js';

export type AssetRotationServiceErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE';
export type AssetRotationDirection = 'clockwise' | 'counterclockwise' | '180';

export class AssetRotationServiceError extends Error {
  public readonly code: AssetRotationServiceErrorCode;

  constructor(code: AssetRotationServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function getSipsRotateDegrees(direction: AssetRotationDirection): '90' | '180' | '270' {
  if (direction === 'clockwise') return '90';
  if (direction === '180') return '180';
  return '270';
}

function execFilePromise(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, _stdout, stderr) => {
      if (error) {
        const stderrMessage = stderr?.trim();
        reject(
          new Error(
            stderrMessage && stderrMessage.length > 0
              ? stderrMessage
              : error.message
          )
        );
        return;
      }

      resolve();
    });
  });
}

function getOriginalFileFormat(asset: MediaAsset): string {
  const extension = path.extname(asset.originalArchivePath).trim().toLowerCase();
  if (extension.startsWith('.')) {
    return extension.slice(1);
  }

  return asset.originalFileFormat.trim().toLowerCase();
}

async function ensureBackupTargetDoesNotExist(backupAbsolutePath: string): Promise<void> {
  try {
    await fs.stat(backupAbsolutePath);
    throw new AssetRotationServiceError(
      'CONFLICT',
      `Cannot rotate asset because backup target already exists: ${backupAbsolutePath}`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    if (error instanceof AssetRotationServiceError) {
      throw error;
    }

    throw error;
  }
}

async function buildUpdatedSourceData(asset: MediaAsset, originalAbsolutePath: string) {
  const originalContentHash = await computeSha256ForFile(originalAbsolutePath);
  const originalFileFormat = getOriginalFileFormat(asset);
  const displayPlan = buildDisplayFilePlan({
    originalStorageRootId: asset.originalStorageRootId,
    originalArchivePath: asset.originalArchivePath,
    originalContentHash,
    originalFileFormat
  });

  if (
    displayPlan.requiresDerivedDisplayFile &&
    (!displayPlan.displayDerivedPath || displayPlan.displayDerivedPath.length === 0)
  ) {
    throw new Error('Derived display path could not be determined for rotated asset');
  }

  if (displayPlan.requiresDerivedDisplayFile && displayPlan.displayDerivedPath) {
    const targetAbsolutePath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
    await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
    await execFilePromise('sips', ['-s', 'format', 'jpeg', originalAbsolutePath, '--out', targetAbsolutePath]);
  }

  let thumbnailStorageType: 'derived-root' | null = null;
  let thumbnailDerivedPath: string | null = null;
  let thumbnailFileFormat: string | null = null;
  let thumbnailUrl: string | null = null;

  if (asset.mediaType === MediaType.Photo) {
    let thumbnailSourceAbsolutePath: string;
    if (
      displayPlan.displayStorageType === 'archive-root' &&
      displayPlan.displayArchivePath &&
      displayPlan.displayStorageRootId === asset.originalStorageRootId
    ) {
      const originalRoot = getStorageRootById(asset.originalStorageRootId);
      if (!originalRoot) {
        throw new Error(`Storage root not found: ${asset.originalStorageRootId}`);
      }

      thumbnailSourceAbsolutePath = resolveSafeAbsolutePath(originalRoot, displayPlan.displayArchivePath);
    } else if (displayPlan.displayStorageType === 'derived-root' && displayPlan.displayDerivedPath) {
      thumbnailSourceAbsolutePath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
    } else {
      throw new Error('Unable to determine thumbnail source path for rotated asset');
    }

    thumbnailDerivedPath = buildThumbnailDerivedRelativePath(originalContentHash);
    const thumbnailAbsolutePath = resolveDerivedAbsolutePath(thumbnailDerivedPath);
    await generateJpegThumbnail({
      sourceAbsolutePath: thumbnailSourceAbsolutePath,
      targetAbsolutePath: thumbnailAbsolutePath,
      forceRegenerate: true
    });

    thumbnailStorageType = 'derived-root';
    thumbnailFileFormat = 'jpg';
  }

  const metadata = await extractImportMetadata(originalAbsolutePath, { includeReverseGeocode: false });
  const fileStat = await fs.stat(originalAbsolutePath);

  return {
    filename: path.basename(asset.originalArchivePath),
    mediaType: asset.mediaType,
    captureDateTime: metadata.captureDateTime,
    width: metadata.width,
    height: metadata.height,
    locationLabel: metadata.locationLabel,
    locationLatitude: metadata.locationLatitude,
    locationLongitude: metadata.locationLongitude,
    city: metadata.city,
    state: metadata.state,
    country: metadata.country,
    originalFileSizeBytes: fileStat.size,
    originalContentHash,
    originalFileFormat,
    displayStorageType: displayPlan.displayStorageType,
    displayStorageRootId: displayPlan.displayStorageRootId,
    displayArchivePath: displayPlan.displayArchivePath,
    displayDerivedPath: displayPlan.displayDerivedPath,
    displayFileFormat: displayPlan.displayFileFormat,
    thumbnailStorageType,
    thumbnailDerivedPath,
    thumbnailFileFormat,
    thumbnailUrl
  };
}

export async function rotateAsset(assetId: string, direction: AssetRotationDirection): Promise<MediaAsset> {
  if (!config.unrotatedRoot) {
    throw new AssetRotationServiceError(
      'UNAVAILABLE',
      'TEDOGRAPHY_UNROTATED_ROOT must be configured before rotating assets'
    );
  }

  const asset = await findById(assetId);
  if (!asset) {
    throw new AssetRotationServiceError('NOT_FOUND', 'Asset not found');
  }

  const mediaSupport = getMediaSupport(asset.originalArchivePath);
  if (!mediaSupport.isSupportedMedia || mediaSupport.mediaType !== MediaType.Photo) {
    throw new AssetRotationServiceError('INVALID_INPUT', 'Only supported photo assets can be rotated');
  }

  const originalAbsolutePath = resolveOriginalAbsolutePathForAsset(asset);
  const backupAbsolutePath = path.join(config.unrotatedRoot, asset.originalArchivePath);
  await ensureBackupTargetDoesNotExist(backupAbsolutePath);
  await fs.mkdir(path.dirname(backupAbsolutePath), { recursive: true });

  await fs.rename(originalAbsolutePath, backupAbsolutePath);
  let originalRewritten = false;

  try {
    await execFilePromise(
      'sips',
      ['--rotate', getSipsRotateDegrees(direction), backupAbsolutePath, '--out', originalAbsolutePath]
    );
    originalRewritten = true;

    const updatedSourceData = await buildUpdatedSourceData(asset, originalAbsolutePath);
    const updatedAsset = await updateMediaAssetSourceData({
      id: asset.id,
      ...updatedSourceData
    });

    if (!updatedAsset) {
      throw new Error(`Asset not found after rotate update: ${asset.id}`);
    }

    return updatedAsset;
  } catch (error) {
    if (!originalRewritten) {
      try {
        await fs.rename(backupAbsolutePath, originalAbsolutePath);
      } catch {
        // Preserve original error; rollback failure only affects manual recovery.
      }
    }

    if (error instanceof AssetRotationServiceError) {
      throw error;
    }

    throw new AssetRotationServiceError(
      'CONFLICT',
      error instanceof Error ? error.message : 'Failed to rotate asset'
    );
  }
}

export async function rotateAssetClockwise(assetId: string): Promise<MediaAsset> {
  return rotateAsset(assetId, 'clockwise');
}

export async function rotateAssetCounterclockwise(assetId: string): Promise<MediaAsset> {
  return rotateAsset(assetId, 'counterclockwise');
}

export async function rotateAsset180(assetId: string): Promise<MediaAsset> {
  return rotateAsset(assetId, '180');
}
