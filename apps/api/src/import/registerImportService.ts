import fs from 'node:fs/promises';
import { MediaType, PhotoState, type MediaAsset, type RegisterImportFileResultDto, type RegisterImportResponse } from '@tedography/domain';
import { createMediaAsset, findByContentHashes, findByStorageRootAndArchivePaths } from '../repositories/assetRepository.js';
import { extractImportMetadata } from './exifMetadata.js';
import { computeSha256ForFile } from './fileHash.js';
import { getStorageRootById, getStorageRoots } from './storageRoots.js';
import { normalizeRelativePath, resolveSafeAbsolutePath } from './storagePathUtils.js';
import { getMediaSupport } from './supportedMedia.js';

export type RegisterErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';

export class RegisterImportServiceError extends Error {
  public readonly code: RegisterErrorCode;

  constructor(code: RegisterErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toRegisteredAsset(asset: MediaAsset, relativePath: string): { id: string; filename: string; relativePath: string } {
  return {
    id: asset.id,
    filename: asset.filename,
    relativePath
  };
}

function buildImportedThumbnailUrl(rootId: string, relativePath: string): string {
  return `/api/import/media?rootId=${encodeURIComponent(rootId)}&relativePath=${encodeURIComponent(relativePath)}`;
}

export async function registerImportedFiles(input: {
  rootId: string;
  relativePaths: string[];
}): Promise<RegisterImportResponse> {
  const rootId = input.rootId.trim();
  if (rootId.length === 0) {
    throw new RegisterImportServiceError('INVALID_INPUT', 'rootId is required');
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    throw new RegisterImportServiceError('NOT_FOUND', `Storage root not found: ${rootId}`);
  }

  const rootWithAvailability = getStorageRoots().find((storageRoot) => storageRoot.id === root.id);
  if (!rootWithAvailability?.isAvailable) {
    throw new RegisterImportServiceError('UNAVAILABLE', `Storage root is unavailable: ${root.id}`);
  }

  const results: RegisterImportFileResultDto[] = [];

  const normalizedInputPaths: string[] = [];
  for (const relativePath of input.relativePaths) {
    try {
      const normalized = normalizeRelativePath(relativePath);
      if (normalized.length > 0) {
        normalizedInputPaths.push(normalized);
      }
    } catch {
      // Per-file validation happens in main loop and returns Error.
    }
  }

  const existingByPath = await findByStorageRootAndArchivePaths(
    root.id,
    Array.from(new Set(normalizedInputPaths))
  );

  const existingByPathMap = new Map<string, MediaAsset>();
  for (const asset of existingByPath) {
    if (asset.archivePath) {
      existingByPathMap.set(asset.archivePath, asset);
    }
  }

  const knownContentHashes = Array.from(
    new Set(existingByPath.map((asset) => asset.contentHash).filter((value): value is string => typeof value === 'string' && value.length > 0))
  );
  const existingByKnownContent = await findByContentHashes(knownContentHashes);

  const existingByContentHashMap = new Map<string, MediaAsset>();
  for (const asset of existingByKnownContent) {
    if (asset.contentHash) {
      existingByContentHashMap.set(asset.contentHash, asset);
    }
  }

  for (const requestedRelativePath of input.relativePaths) {
    let normalizedRelativePath = requestedRelativePath;

    try {
      normalizedRelativePath = normalizeRelativePath(requestedRelativePath);
      if (normalizedRelativePath.length === 0) {
        results.push({
          relativePath: requestedRelativePath,
          status: 'Error',
          message: 'relativePath must point to a file'
        });
        continue;
      }
    } catch (error) {
      results.push({
        relativePath: requestedRelativePath,
        status: 'Error',
        message: error instanceof Error ? error.message : 'Invalid relativePath'
      });
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveSafeAbsolutePath(root, normalizedRelativePath);
    } catch (error) {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'Error',
        message: error instanceof Error ? error.message : 'Invalid relativePath'
      });
      continue;
    }

    let fileStat;
    try {
      fileStat = await fs.stat(absolutePath);
    } catch {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'Missing',
        message: 'File not found'
      });
      continue;
    }

    // v1: non-file targets are treated as Missing for deterministic file-oriented behavior.
    if (!fileStat.isFile()) {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'Missing',
        message: 'File not found'
      });
      continue;
    }

    const mediaSupport = getMediaSupport(normalizedRelativePath);
    if (!mediaSupport.isSupportedMedia) {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'Unsupported',
        message: 'Unsupported media type'
      });
      continue;
    }

    const existingByPathAsset = existingByPathMap.get(normalizedRelativePath);
    if (existingByPathAsset) {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'AlreadyImportedByPath',
        asset: toRegisteredAsset(existingByPathAsset, normalizedRelativePath)
      });
      continue;
    }

    try {
      const contentHash = await computeSha256ForFile(absolutePath);
      const existingByContentAsset = existingByContentHashMap.get(contentHash);

      if (existingByContentAsset) {
        results.push({
          relativePath: normalizedRelativePath,
          status: 'DuplicateByContentHash',
          asset: toRegisteredAsset(existingByContentAsset, normalizedRelativePath)
        });
        continue;
      }

      const metadata = await extractImportMetadata(absolutePath);
      const importedAt = new Date();
      const createdAsset = await createMediaAsset({
        filename: normalizedRelativePath.split('/').at(-1) ?? normalizedRelativePath,
        mediaType: mediaSupport.mediaType === 'Unknown' ? MediaType.Photo : mediaSupport.mediaType,
        photoState: PhotoState.Unreviewed,
        captureDateTime: metadata.captureDateTime,
        width: metadata.width,
        height: metadata.height,
        thumbnailUrl: buildImportedThumbnailUrl(root.id, normalizedRelativePath),
        storageRootId: root.id,
        archivePath: normalizedRelativePath,
        fileSizeBytes: fileStat.size,
        contentHash,
        importedAt
      });

      existingByPathMap.set(normalizedRelativePath, createdAsset);
      existingByContentHashMap.set(contentHash, createdAsset);

      results.push({
        relativePath: normalizedRelativePath,
        status: 'Imported',
        asset: toRegisteredAsset(createdAsset, normalizedRelativePath)
      });
    } catch (error) {
      results.push({
        relativePath: normalizedRelativePath,
        status: 'Error',
        message: error instanceof Error ? error.message : 'Failed to register file'
      });
    }
  }

  return {
    importedCount: results.filter((result) => result.status === 'Imported').length,
    skippedAlreadyImportedByPathCount: results.filter((result) => result.status === 'AlreadyImportedByPath').length,
    skippedDuplicateContentCount: results.filter((result) => result.status === 'DuplicateByContentHash').length,
    unsupportedCount: results.filter((result) => result.status === 'Unsupported').length,
    missingCount: results.filter((result) => result.status === 'Missing').length,
    errorCount: results.filter((result) => result.status === 'Error').length,
    results
  };
}
