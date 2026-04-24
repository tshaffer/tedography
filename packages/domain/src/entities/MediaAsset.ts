import { MediaType } from '../enums/MediaType.js';
import { PhotoState } from '../enums/PhotoState.js';

export type DisplayStorageType = 'archive-root' | 'derived-root';

export type MediaAssetPersonSource =
  | 'confirmed-face-detection'
  | 'imported-shafferography'
  | 'manual-asset-tag';

export interface MediaAssetAlbumMembership {
  albumId: string;
  manualSortOrdinal?: number | null;
  forceManualOrder?: boolean | null;
}

export interface MediaAssetPerson {
  personId: string;
  displayName: string;
  source: MediaAssetPersonSource;
  confirmedAt?: string | null;
}

export interface MediaAsset {
  id: string;

  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime?: string | null;
  width?: number | null;
  height?: number | null;
  importedAt: string;

  // Original/source file reference.
  originalStorageRootId: string;
  originalArchivePath: string;
  originalFileSizeBytes: number;
  originalContentHash: string;
  originalFileFormat: string;

  // Display/render file reference.
  displayStorageType: DisplayStorageType;
  displayStorageRootId?: string | null;
  displayArchivePath?: string | null;
  displayDerivedPath?: string | null;
  displayFileFormat: string;

  // Thumbnail file reference.
  thumbnailStorageType?: 'derived-root' | null;
  thumbnailDerivedPath?: string | null;
  thumbnailFileFormat?: string | null;

  // Legacy compatibility for older compile/runtime paths.
  thumbnailUrl?: string | null;

  // Virtual organization only; does not affect filesystem storage layout.
  albumIds?: string[];
  albumMemberships?: MediaAssetAlbumMembership[];
  keywordIds?: string[];

  // Derived convenience field populated from confirmed person assignments.
  people?: MediaAssetPerson[];

  // Derived face-review summary fields used by Library/Search flows.
  detectionsCount?: number;
  reviewableDetectionsCount?: number;
  confirmedDetectionsCount?: number;

  // Optional capture location metadata when available.
  locationLabel?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;

  // Temporary compatibility fields while API/frontend finish migrating
  // away from the previous single-file reference naming.
  storageRootId?: string;
  archivePath?: string;
  fileSizeBytes?: number;
  contentHash?: string;
}
