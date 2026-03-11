import type { DisplayStorageType } from '@tedography/domain';
import { buildDisplayJpegDerivedRelativePath } from './derivedStorage.js';

export interface DisplayFilePlan {
  requiresDerivedDisplayFile: boolean;
  displayStorageType: DisplayStorageType;
  displayStorageRootId: string | null;
  displayArchivePath: string | null;
  displayDerivedPath: string | null;
  displayFileFormat: string;
}

export function buildDisplayFilePlan(input: {
  originalStorageRootId: string;
  originalArchivePath: string;
  originalContentHash: string;
  originalFileFormat: string;
}): DisplayFilePlan {
  const normalizedOriginalFileFormat = input.originalFileFormat.toLowerCase();

  if (normalizedOriginalFileFormat === 'heic') {
    return {
      requiresDerivedDisplayFile: true,
      displayStorageType: 'derived-root',
      displayStorageRootId: null,
      displayArchivePath: null,
      displayDerivedPath: buildDisplayJpegDerivedRelativePath(input.originalContentHash),
      displayFileFormat: 'jpg'
    };
  }

  if (
    normalizedOriginalFileFormat === 'jpg' ||
    normalizedOriginalFileFormat === 'jpeg' ||
    normalizedOriginalFileFormat === 'png'
  ) {
    return {
      requiresDerivedDisplayFile: false,
      displayStorageType: 'archive-root',
      displayStorageRootId: input.originalStorageRootId,
      displayArchivePath: input.originalArchivePath,
      displayDerivedPath: null,
      displayFileFormat: normalizedOriginalFileFormat
    };
  }

  return {
    requiresDerivedDisplayFile: false,
    displayStorageType: 'archive-root',
    displayStorageRootId: input.originalStorageRootId,
    displayArchivePath: input.originalArchivePath,
    displayDerivedPath: null,
    displayFileFormat: normalizedOriginalFileFormat
  };
}
