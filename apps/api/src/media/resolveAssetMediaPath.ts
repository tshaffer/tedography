import type { MediaAsset } from '@tedography/domain';
import { resolveDerivedAbsolutePath } from '../import/derivedStorage.js';
import { getStorageRootById } from '../import/storageRoots.js';
import { resolveSafeAbsolutePath } from '../import/storagePathUtils.js';

export class AssetMediaPathResolutionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function resolveArchiveAbsolutePath(storageRootId: string, archivePath: string): string {
  const storageRoot = getStorageRootById(storageRootId);
  if (!storageRoot) {
    throw new AssetMediaPathResolutionError(`Storage root not found: ${storageRootId}`);
  }

  return resolveSafeAbsolutePath(storageRoot, archivePath);
}

export function resolveOriginalAbsolutePathForAsset(asset: MediaAsset): string {
  if (
    typeof asset.originalStorageRootId === 'string' &&
    asset.originalStorageRootId.length > 0 &&
    typeof asset.originalArchivePath === 'string' &&
    asset.originalArchivePath.length > 0
  ) {
    return resolveArchiveAbsolutePath(asset.originalStorageRootId, asset.originalArchivePath);
  }

  if (
    typeof asset.storageRootId === 'string' &&
    asset.storageRootId.length > 0 &&
    typeof asset.archivePath === 'string' &&
    asset.archivePath.length > 0
  ) {
    return resolveArchiveAbsolutePath(asset.storageRootId, asset.archivePath);
  }

  throw new AssetMediaPathResolutionError('Asset does not contain a resolvable original file reference');
}

export function resolveDisplayAbsolutePathForAsset(asset: MediaAsset): string {
  if (asset.displayStorageType === 'archive-root') {
    if (
      typeof asset.displayStorageRootId === 'string' &&
      asset.displayStorageRootId.length > 0 &&
      typeof asset.displayArchivePath === 'string' &&
      asset.displayArchivePath.length > 0
    ) {
      return resolveArchiveAbsolutePath(asset.displayStorageRootId, asset.displayArchivePath);
    }

    throw new AssetMediaPathResolutionError('Asset display reference is missing archive-root fields');
  }

  if (asset.displayStorageType === 'derived-root') {
    if (typeof asset.displayDerivedPath === 'string' && asset.displayDerivedPath.length > 0) {
      return resolveDerivedAbsolutePath(asset.displayDerivedPath);
    }

    throw new AssetMediaPathResolutionError('Asset display reference is missing derived-root path');
  }

  if (
    typeof asset.storageRootId === 'string' &&
    asset.storageRootId.length > 0 &&
    typeof asset.archivePath === 'string' &&
    asset.archivePath.length > 0
  ) {
    return resolveArchiveAbsolutePath(asset.storageRootId, asset.archivePath);
  }

  throw new AssetMediaPathResolutionError('Asset does not contain a resolvable display file reference');
}
