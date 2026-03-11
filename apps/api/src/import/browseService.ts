import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowseDirectoryResponse } from '@tedography/domain';
import { getParentRelativePath, normalizeRelativePath, resolveSafeAbsolutePath } from './storagePathUtils.js';
import { getStorageRootById, getStorageRoots } from './storageRoots.js';
import { getMediaSupport, isIgnorableFileName } from './supportedMedia.js';

export type BrowseErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';

export class BrowseServiceError extends Error {
  public readonly code: BrowseErrorCode;

  constructor(code: BrowseErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toRelativePath(rootAbsolutePath: string, entryAbsolutePath: string): string {
  const relative = path.relative(rootAbsolutePath, entryAbsolutePath);
  return normalizeRelativePath(relative);
}

export async function browseDirectory(input: {
  rootId: string;
  relativePath?: string;
}): Promise<BrowseDirectoryResponse> {
  const rootId = input.rootId.trim();
  if (rootId.length === 0) {
    throw new BrowseServiceError('INVALID_INPUT', 'rootId is required');
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    throw new BrowseServiceError('NOT_FOUND', `Storage root not found: ${rootId}`);
  }

  const rootWithAvailability = getStorageRoots().find((storageRoot) => storageRoot.id === root.id);
  if (!rootWithAvailability?.isAvailable) {
    throw new BrowseServiceError('UNAVAILABLE', `Storage root is unavailable: ${root.id}`);
  }

  let normalizedRelativePath: string;
  let absolutePath: string;
  try {
    normalizedRelativePath = normalizeRelativePath(input.relativePath);
    absolutePath = resolveSafeAbsolutePath(root, normalizedRelativePath);
  } catch (error) {
    throw new BrowseServiceError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid relativePath'
    );
  }

  let directoryStat;
  try {
    directoryStat = await fs.stat(absolutePath);
  } catch {
    throw new BrowseServiceError('NOT_FOUND', 'Directory not found');
  }

  if (!directoryStat.isDirectory()) {
    throw new BrowseServiceError('NOT_FOUND', 'Directory not found');
  }

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  const directories: BrowseDirectoryResponse['directories'] = [];
  const files: BrowseDirectoryResponse['files'] = [];

  for (const entry of entries) {
    if (isIgnorableFileName(entry.name)) {
      continue;
    }

    const entryAbsolutePath = path.join(absolutePath, entry.name);
    const entryRelativePath = toRelativePath(root.absolutePath, entryAbsolutePath);

    if (entry.isDirectory()) {
      const directoryEntryStat = await fs.stat(entryAbsolutePath);
      directories.push({
        name: entry.name,
        relativePath: entryRelativePath,
        modifiedAt: directoryEntryStat.mtime.toISOString()
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileEntryStat = await fs.stat(entryAbsolutePath);
    const mediaSupport = getMediaSupport(entry.name);

    files.push({
      name: entry.name,
      relativePath: entryRelativePath,
      extension: mediaSupport.extension,
      sizeBytes: fileEntryStat.size,
      modifiedAt: fileEntryStat.mtime.toISOString(),
      isSupportedMedia: mediaSupport.isSupportedMedia,
      mediaType: mediaSupport.mediaType
    });
  }

  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    root: {
      id: root.id,
      label: root.label
    },
    currentRelativePath: normalizedRelativePath,
    parentRelativePath: getParentRelativePath(normalizedRelativePath),
    directories,
    files
  };
}
