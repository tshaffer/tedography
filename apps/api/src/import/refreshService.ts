import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MediaType,
  type MediaAsset,
  type RefreshFolderRequest,
  type RefreshOperationResponse,
  type RefreshOperationType,
  type RefreshResultDto,
  type RefreshSummaryDto
} from '@tedography/domain';
import {
  findById,
  findByOriginalStorageRootId,
  updateMediaAssetSourceData
} from '../repositories/assetRepository.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { buildDisplayFilePlan } from './displayFilePlanning.js';
import { convertHeicToJpeg } from './heicConversion.js';
import { extractImportMetadata } from './exifMetadata.js';
import { computeSha256ForFile } from './fileHash.js';
import {
  buildThumbnailDerivedRelativePath,
  resolveDerivedAbsolutePath
} from './derivedStorage.js';
import { walkImportFiles } from './importFileWalker.js';
import { getStorageRootById, getStorageRoots } from './storageRoots.js';
import { normalizeRelativePath, resolveSafeAbsolutePath } from './storagePathUtils.js';
import { getMediaSupport } from './supportedMedia.js';
import { generateJpegThumbnail } from './thumbnailGeneration.js';

export type RefreshServiceErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';

export class RefreshServiceError extends Error {
  public readonly code: RefreshServiceErrorCode;

  constructor(code: RefreshServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type RefreshMode = 'reimport' | 'rebuild-derived';

function createEmptySummary(): RefreshSummaryDto {
  return {
    totalCandidates: 0,
    succeededCount: 0,
    skippedCount: 0,
    failedCount: 0,
    sourceMissingCount: 0,
    reimportedCount: 0,
    rebuiltCount: 0
  };
}

function getOriginalFileFormat(extension: string | null): string {
  if (!extension) {
    return 'unknown';
  }

  return extension.replace('.', '').toLowerCase();
}

function getDirectChildRelativePathSet(relativePaths: string[]): Set<string> {
  return new Set(relativePaths);
}

function isDirectChildOfFolder(assetArchivePath: string, folderRelativePath: string): boolean {
  const normalizedFolderPath = normalizeRelativePath(folderRelativePath);
  if (normalizedFolderPath.length === 0) {
    return !assetArchivePath.includes('/');
  }

  if (!assetArchivePath.startsWith(`${normalizedFolderPath}/`)) {
    return false;
  }

  const remainder = assetArchivePath.slice(normalizedFolderPath.length + 1);
  return remainder.length > 0 && !remainder.includes('/');
}

async function validateFolderRequest(input: RefreshFolderRequest): Promise<{
  rootId: string;
  rootLabel: string;
  scanTargetRelativePath: string;
  absoluteTargetPath: string;
}> {
  const rootId = input.rootId.trim();
  if (rootId.length === 0) {
    throw new RefreshServiceError('INVALID_INPUT', 'rootId is required');
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    throw new RefreshServiceError('NOT_FOUND', `Storage root not found: ${rootId}`);
  }

  const rootWithAvailability = getStorageRoots().find((storageRoot) => storageRoot.id === root.id);
  if (!rootWithAvailability?.isAvailable) {
    throw new RefreshServiceError('UNAVAILABLE', `Storage root is unavailable: ${root.id}`);
  }

  let scanTargetRelativePath: string;
  let absoluteTargetPath: string;
  try {
    scanTargetRelativePath = normalizeRelativePath(input.relativePath);
    absoluteTargetPath = resolveSafeAbsolutePath(root, scanTargetRelativePath);
  } catch (error) {
    throw new RefreshServiceError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid relativePath'
    );
  }

  let targetStat;
  try {
    targetStat = await fs.stat(absoluteTargetPath);
  } catch {
    throw new RefreshServiceError('NOT_FOUND', 'Folder not found');
  }

  if (!targetStat.isDirectory()) {
    throw new RefreshServiceError('NOT_FOUND', 'Folder not found');
  }

  return {
    rootId: root.id,
    rootLabel: root.label,
    scanTargetRelativePath,
    absoluteTargetPath
  };
}

async function processAssetRefresh(
  asset: MediaAsset,
  mode: RefreshMode
): Promise<RefreshResultDto> {
  const relativePath = asset.originalArchivePath;
  const filename = asset.filename;

  let originalAbsolutePath: string;
  try {
    originalAbsolutePath = resolveOriginalAbsolutePathForAsset(asset);
  } catch (error) {
    return {
      assetId: asset.id,
      filename,
      relativePath,
      status: 'Error',
      message: error instanceof Error ? error.message : 'Original source reference is invalid'
    };
  }

  let fileStat;
  try {
    fileStat = await fs.stat(originalAbsolutePath);
  } catch {
    return {
      assetId: asset.id,
      filename,
      relativePath,
      status: 'SourceMissing',
      message: 'Source file not found'
    };
  }

  if (!fileStat.isFile()) {
    return {
      assetId: asset.id,
      filename,
      relativePath,
      status: 'SourceMissing',
      message: 'Source file not found'
    };
  }

  const mediaSupport = getMediaSupport(relativePath);
  if (!mediaSupport.isSupportedMedia) {
    return {
      assetId: asset.id,
      filename,
      relativePath,
      status: 'Skipped',
      message: 'Unsupported media type'
    };
  }

  try {
    const originalContentHash = await computeSha256ForFile(originalAbsolutePath);
    const originalFileFormat = getOriginalFileFormat(mediaSupport.extension);
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
      throw new Error('Derived display path could not be determined for this file');
    }

    if (displayPlan.requiresDerivedDisplayFile && displayPlan.displayDerivedPath) {
      const targetAbsolutePath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
      await convertHeicToJpeg({
        sourceAbsolutePath: originalAbsolutePath,
        targetAbsolutePath,
        forceRegenerate: mode === 'rebuild-derived'
      });
    }

    let thumbnailStorageType: 'derived-root' | null = null;
    let thumbnailDerivedPath: string | null = null;
    let thumbnailFileFormat: string | null = null;
    let thumbnailUrl: string | null = null;

    if (mediaSupport.mediaType === MediaType.Photo) {
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
      } else if (
        displayPlan.displayStorageType === 'derived-root' &&
        displayPlan.displayDerivedPath
      ) {
        thumbnailSourceAbsolutePath = resolveDerivedAbsolutePath(displayPlan.displayDerivedPath);
      } else {
        throw new Error('Unable to determine thumbnail source path for asset');
      }

      thumbnailDerivedPath = buildThumbnailDerivedRelativePath(originalContentHash);
      const thumbnailAbsolutePath = resolveDerivedAbsolutePath(thumbnailDerivedPath);
      await generateJpegThumbnail({
        sourceAbsolutePath: thumbnailSourceAbsolutePath,
        targetAbsolutePath: thumbnailAbsolutePath,
        forceRegenerate: mode === 'rebuild-derived'
      });

      thumbnailStorageType = 'derived-root';
      thumbnailFileFormat = 'jpg';
    }

    const metadata =
      mode === 'reimport'
        ? await extractImportMetadata(originalAbsolutePath)
        : {
            captureDateTime: asset.captureDateTime ? new Date(asset.captureDateTime) : null,
            width: asset.width ?? null,
            height: asset.height ?? null,
            locationLabel: asset.locationLabel ?? null,
            locationLatitude: asset.locationLatitude ?? null,
            locationLongitude: asset.locationLongitude ?? null
          };

    const updatedAsset = await updateMediaAssetSourceData({
      id: asset.id,
      filename: path.basename(relativePath),
      mediaType: mediaSupport.mediaType === 'Unknown' ? asset.mediaType : mediaSupport.mediaType,
      captureDateTime: metadata.captureDateTime,
      width: metadata.width,
      height: metadata.height,
      locationLabel: metadata.locationLabel,
      locationLatitude: metadata.locationLatitude,
      locationLongitude: metadata.locationLongitude,
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
    });

    if (!updatedAsset) {
      throw new Error(`Asset not found: ${asset.id}`);
    }

    return {
      assetId: asset.id,
      filename: updatedAsset.filename,
      relativePath,
      status: mode === 'reimport' ? 'Reimported' : 'RebuiltDerivedFiles'
    };
  } catch (error) {
    return {
      assetId: asset.id,
      filename,
      relativePath,
      status: 'Error',
      message: error instanceof Error ? error.message : 'Refresh operation failed'
    };
  }
}

function finalizeSummary(
  operation: RefreshOperationType,
  summary: RefreshSummaryDto,
  results: RefreshResultDto[],
  context?: {
    rootId: string;
    rootLabel: string;
    scanTargetRelativePath: string;
  }
): RefreshOperationResponse {
  return {
    operation,
    ...(context
      ? {
          root: {
            id: context.rootId,
            label: context.rootLabel
          },
          scanTargetRelativePath: context.scanTargetRelativePath
        }
      : {}),
    summary,
    results
  };
}

function applyResultToSummary(summary: RefreshSummaryDto, result: RefreshResultDto): void {
  summary.totalCandidates += 1;

  if (result.status === 'Reimported') {
    summary.succeededCount += 1;
    summary.reimportedCount += 1;
    return;
  }

  if (result.status === 'RebuiltDerivedFiles') {
    summary.succeededCount += 1;
    summary.rebuiltCount += 1;
    return;
  }

  if (result.status === 'SourceMissing') {
    summary.failedCount += 1;
    summary.sourceMissingCount += 1;
    return;
  }

  if (result.status === 'Skipped') {
    summary.skippedCount += 1;
    return;
  }

  summary.failedCount += 1;
}

export async function reimportKnownAssetsInFolder(
  input: RefreshFolderRequest
): Promise<RefreshOperationResponse> {
  const folder = await validateFolderRequest(input);
  const knownAssets = (await findByOriginalStorageRootId(folder.rootId)).filter((asset) =>
    isDirectChildOfFolder(asset.originalArchivePath, folder.scanTargetRelativePath)
  );

  const walkResult = await walkImportFiles({
    absoluteBasePath: folder.absoluteTargetPath,
    relativeBasePath: folder.scanTargetRelativePath
  });
  const existingSourcePaths = getDirectChildRelativePathSet(
    walkResult.files.map((file) => file.relativePath)
  );

  const summary = createEmptySummary();
  const results: RefreshResultDto[] = [];

  for (const asset of knownAssets) {
    if (!existingSourcePaths.has(asset.originalArchivePath)) {
      const missingResult: RefreshResultDto = {
        assetId: asset.id,
        filename: asset.filename,
        relativePath: asset.originalArchivePath,
        status: 'SourceMissing',
        message: 'Source file not found in selected folder'
      };
      applyResultToSummary(summary, missingResult);
      results.push(missingResult);
      continue;
    }

    const result = await processAssetRefresh(asset, 'reimport');
    applyResultToSummary(summary, result);
    results.push(result);
  }

  return finalizeSummary('ReimportKnownAssetsInFolder', summary, results, folder);
}

export async function rebuildDerivedFilesInFolder(
  input: RefreshFolderRequest
): Promise<RefreshOperationResponse> {
  const folder = await validateFolderRequest(input);
  const knownAssets = (await findByOriginalStorageRootId(folder.rootId)).filter((asset) =>
    isDirectChildOfFolder(asset.originalArchivePath, folder.scanTargetRelativePath)
  );

  const walkResult = await walkImportFiles({
    absoluteBasePath: folder.absoluteTargetPath,
    relativeBasePath: folder.scanTargetRelativePath
  });
  const existingSourcePaths = getDirectChildRelativePathSet(
    walkResult.files.map((file) => file.relativePath)
  );

  const summary = createEmptySummary();
  const results: RefreshResultDto[] = [];

  for (const asset of knownAssets) {
    if (!existingSourcePaths.has(asset.originalArchivePath)) {
      const missingResult: RefreshResultDto = {
        assetId: asset.id,
        filename: asset.filename,
        relativePath: asset.originalArchivePath,
        status: 'SourceMissing',
        message: 'Source file not found in selected folder'
      };
      applyResultToSummary(summary, missingResult);
      results.push(missingResult);
      continue;
    }

    const result = await processAssetRefresh(asset, 'rebuild-derived');
    applyResultToSummary(summary, result);
    results.push(result);
  }

  return finalizeSummary('RebuildDerivedFilesInFolder', summary, results, folder);
}

async function refreshSingleAsset(
  assetId: string,
  operation: RefreshOperationType,
  mode: RefreshMode
): Promise<RefreshOperationResponse> {
  const asset = await findById(assetId);
  if (!asset) {
    throw new RefreshServiceError('NOT_FOUND', 'Asset not found');
  }

  const summary = createEmptySummary();
  const result = await processAssetRefresh(asset, mode);
  applyResultToSummary(summary, result);

  return finalizeSummary(operation, summary, [result]);
}

export async function reimportAssetById(assetId: string): Promise<RefreshOperationResponse> {
  return refreshSingleAsset(assetId, 'ReimportAsset', 'reimport');
}

export async function rebuildDerivedFilesForAsset(
  assetId: string
): Promise<RefreshOperationResponse> {
  return refreshSingleAsset(assetId, 'RebuildDerivedFiles', 'rebuild-derived');
}
