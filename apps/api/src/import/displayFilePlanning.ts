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

  const formatsRequiringDerivedDisplay = new Set(['heic', 'tif', 'tiff', 'nef', 'dng']);

  if (formatsRequiringDerivedDisplay.has(normalizedOriginalFileFormat)) {
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
