import { MediaType } from '../enums/MediaType.js';
import { PhotoState } from '../enums/PhotoState.js';
import type { AssetKeywordAssignmentStatus } from '../enums/KeywordAssignmentStatus.js';

export type DisplayStorageType = 'archive-root' | 'derived-root';

export type MediaAssetPersonSource =
  | 'confirmed-face-detection'
  | 'imported-shafferography'
  | 'manual-asset-tag';

/**
 * Where captureDateTime came from (see Docs/ORDERING_PLAN.md Phase 1).
 * - 'exif-original': trustworthy camera date (DateTimeOriginal, or CreateDate family with camera Make/Model)
 * - 'exif-weak': date matches the file but its EXIF pedigree is dubious (ModifyDate, or CreateDate family without camera tags)
 * - 'changed-after-import': the stored date no longer matches the original file's EXIF
 * - 'manual': set through tedography's Set Capture Date after provenance stamping began
 * - 'none': no capture date
 */
export type CaptureDateTimeSource =
  | 'exif-original'
  | 'exif-weak'
  | 'changed-after-import'
  | 'manual'
  | 'none';

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
  captureDateTimeSource?: CaptureDateTimeSource | null;
  // The capture date as it exists in the original file's EXIF; preserved evidence,
  // independent of captureDateTime edits.
  exifCaptureDateTime?: string | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  // User judgment that a genuine EXIF date is inaccurate (e.g. wrong camera clock).
  // Independent of captureDateTimeSource.
  captureDateTimeMarkedWrong?: boolean | null;
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
  keywordAssignmentStatus?: AssetKeywordAssignmentStatus | null;

  // Derived convenience field populated from confirmed person assignments.
  people?: MediaAssetPerson[];

  // Derived face-review summary fields used by Library/Search flows.
  detectionsCount?: number;
  reviewableDetectionsCount?: number;
  confirmedDetectionsCount?: number;
  peopleRecognitionRanAt?: string | null;

  // When this asset was generated from another asset (e.g. AI editing), the source asset's id.
  sourceAssetId?: string | null;

  // When an edited version of this asset has been imported, the edited asset's id.
  editedAssetId?: string | null;

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
