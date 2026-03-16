import fs from 'node:fs/promises';
import type { ScanFileStatus, ScannedCandidateFileDto, ScanImportResponse } from '@tedography/domain';
import {
  findByOriginalContentHashes,
  findByOriginalStorageRootAndArchivePaths
} from '../repositories/assetRepository.js';
import { buildDisplayFilePlan } from './displayFilePlanning.js';
import { extractImportMetadata } from './exifMetadata.js';
import { computeSha256ForFile } from './fileHash.js';
import { type DiscoveredFile, walkImportFiles } from './importFileWalker.js';
import { getStorageRootById, getStorageRoots } from './storageRoots.js';
import { normalizeRelativePath, resolveSafeAbsolutePath } from './storagePathUtils.js';
import { getMediaSupport } from './supportedMedia.js';

export type ScanErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';

export class ScanServiceError extends Error {
  public readonly code: ScanErrorCode;

  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type SupportedScannedFile = {
  discovered: DiscoveredFile;
  contentHash: string;
  captureDateTime: string | null;
  width: number | null;
  height: number | null;
  locationLabel: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  requiresDerivedDisplayFile: boolean;
};

function resolveStatus(input: {
  isSupportedMedia: boolean;
  alreadyImportedByPath: boolean;
  duplicateByContentHash: boolean;
}): ScanFileStatus {
  if (!input.isSupportedMedia) {
    return 'Unsupported';
  }

  if (input.alreadyImportedByPath) {
    return 'AlreadyImportedByPath';
  }

  if (input.duplicateByContentHash) {
    return 'DuplicateByContentHash';
  }

  return 'Importable';
}

function getOriginalFileFormat(extension: string | null): string {
  if (!extension) {
    return 'unknown';
  }

  return extension.replace('.', '').toLowerCase();
}

export async function scanImportTarget(input: {
  rootId: string;
  relativePath: string;
}): Promise<ScanImportResponse> {
  const rootId = input.rootId.trim();
  if (rootId.length === 0) {
    throw new ScanServiceError('INVALID_INPUT', 'rootId is required');
  }

  if (typeof input.relativePath !== 'string') {
    throw new ScanServiceError('INVALID_INPUT', 'relativePath is required');
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    throw new ScanServiceError('NOT_FOUND', `Storage root not found: ${rootId}`);
  }

  const rootWithAvailability = getStorageRoots().find((storageRoot) => storageRoot.id === root.id);
  if (!rootWithAvailability?.isAvailable) {
    throw new ScanServiceError('UNAVAILABLE', `Storage root is unavailable: ${root.id}`);
  }

  let scanTargetRelativePath: string;
  let absoluteTargetPath: string;
  try {
    scanTargetRelativePath = normalizeRelativePath(input.relativePath);
    absoluteTargetPath = resolveSafeAbsolutePath(root, scanTargetRelativePath);
  } catch (error) {
    throw new ScanServiceError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid relativePath'
    );
  }

  let targetStat;
  try {
    targetStat = await fs.stat(absoluteTargetPath);
  } catch {
    throw new ScanServiceError('NOT_FOUND', 'Scan target directory not found');
  }

  if (!targetStat.isDirectory()) {
    throw new ScanServiceError('NOT_FOUND', 'Scan target directory not found');
  }

  const walkResult = await walkImportFiles({
    absoluteBasePath: absoluteTargetPath,
    relativeBasePath: scanTargetRelativePath
  });

  const supportedFileMap = new Map<string, SupportedScannedFile>();

  for (const discoveredFile of walkResult.files) {
    const mediaSupport = getMediaSupport(discoveredFile.filename);
    if (!mediaSupport.isSupportedMedia) {
      continue;
    }

    const contentHash = await computeSha256ForFile(discoveredFile.absolutePath);
    const metadata = await extractImportMetadata(discoveredFile.absolutePath);
    const displayPlan = buildDisplayFilePlan({
      originalStorageRootId: root.id,
      originalArchivePath: discoveredFile.relativePath,
      originalContentHash: contentHash,
      originalFileFormat: getOriginalFileFormat(mediaSupport.extension)
    });

    supportedFileMap.set(discoveredFile.relativePath, {
      discovered: discoveredFile,
      contentHash,
      captureDateTime: metadata.captureDateTime ? metadata.captureDateTime.toISOString() : null,
      width: metadata.width,
      height: metadata.height,
      locationLabel: metadata.locationLabel,
      locationLatitude: metadata.locationLatitude,
      locationLongitude: metadata.locationLongitude,
      requiresDerivedDisplayFile: displayPlan.requiresDerivedDisplayFile
    });
  }

  const archivePaths = walkResult.files.map((file) => file.relativePath);
  const contentHashes = Array.from(
    new Set(Array.from(supportedFileMap.values()).map((file) => file.contentHash))
  );

  const existingByPath = await findByOriginalStorageRootAndArchivePaths(root.id, archivePaths);
  const existingByContentHash = await findByOriginalContentHashes(contentHashes);

  const existingByPathMap = new Map<string, string>();
  for (const existingAsset of existingByPath) {
    existingByPathMap.set(existingAsset.originalArchivePath, existingAsset.id);
  }

  const existingByContentMap = new Map<string, string>();
  for (const existingAsset of existingByContentHash) {
    existingByContentMap.set(existingAsset.originalContentHash, existingAsset.id);
  }

  const files: ScannedCandidateFileDto[] = walkResult.files.map((discoveredFile) => {
    const mediaSupport = getMediaSupport(discoveredFile.filename);
    const supported = supportedFileMap.get(discoveredFile.relativePath);
    const existingAssetIdByPath = existingByPathMap.get(discoveredFile.relativePath);
    const existingAssetIdByContentHash =
      supported?.contentHash ? existingByContentMap.get(supported.contentHash) : undefined;

    const alreadyImportedByPath = existingByPathMap.has(discoveredFile.relativePath);
    const duplicateByContentHash =
      supported?.contentHash ? existingByContentMap.has(supported.contentHash) : false;

    const status = resolveStatus({
      isSupportedMedia: mediaSupport.isSupportedMedia,
      alreadyImportedByPath,
      duplicateByContentHash
    });

    return {
      relativePath: discoveredFile.relativePath,
      filename: discoveredFile.filename,
      extension: mediaSupport.extension,
      sizeBytes: discoveredFile.sizeBytes,
      modifiedAt: discoveredFile.modifiedAt.toISOString(),
      mediaType: mediaSupport.mediaType,
      isSupportedMedia: mediaSupport.isSupportedMedia,
      alreadyImportedByPath,
      duplicateByContentHash,
      ...(typeof existingAssetIdByPath === 'string' ? { existingAssetIdByPath } : {}),
      ...(typeof existingAssetIdByContentHash === 'string'
        ? { existingAssetIdByContentHash }
        : {}),
      status,
      ...(mediaSupport.isSupportedMedia
        ? {
            captureDateTime: supported?.captureDateTime ?? null,
            width: supported?.width ?? null,
            height: supported?.height ?? null,
            locationLabel: supported?.locationLabel ?? null,
            locationLatitude: supported?.locationLatitude ?? null,
            locationLongitude: supported?.locationLongitude ?? null,
            contentHash: supported?.contentHash ?? null,
            requiresDerivedDisplayFile: supported?.requiresDerivedDisplayFile ?? false
          }
        : {
            captureDateTime: null,
            width: null,
            height: null,
            locationLabel: null,
            locationLatitude: null,
            locationLongitude: null,
            contentHash: null,
            requiresDerivedDisplayFile: false
          })
    };
  });

  const supportedMediaFileCount = files.filter((file) => file.isSupportedMedia).length;
  const unsupportedFileCount = files.filter((file) => file.status === 'Unsupported').length;
  const alreadyImportedPathCount = files.filter(
    (file) => file.status === 'AlreadyImportedByPath'
  ).length;
  const duplicateContentCount = files.filter(
    (file) => file.status === 'DuplicateByContentHash'
  ).length;
  const importableCount = files.filter((file) => file.status === 'Importable').length;

  return {
    root: {
      id: root.id,
      label: root.label
    },
    scanTargetRelativePath,
    summary: {
      totalFilesystemEntriesSeen: walkResult.totalFilesystemEntriesSeen,
      totalFilesSeen: files.length,
      supportedMediaFileCount,
      unsupportedFileCount,
      alreadyImportedPathCount,
      duplicateContentCount,
      importableCount
    },
    files
  };
}
