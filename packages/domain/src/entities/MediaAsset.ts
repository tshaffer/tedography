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

/**
 * Where an asset's location metadata came from.
 * - 'exif': GPS coordinates (optionally reverse-geocoded to city/state/country) read from the file at import
 * - 'manual': set through Tedography's Set Location dialog
 * - 'inherited': applied from a nearby sibling asset's location via the "Fill Missing Locations" suggestion
 * - 'none': no location
 */
export type LocationSource = 'exif' | 'manual' | 'inherited' | 'none';

/**
 * Which piece of a location the Location field shows. Set per album (applies
 * to its photos) or globally; a photo can override with its own choice.
 * - 'placeName': the place's name, e.g. "Garrapata State Park"
 * - 'placeNameAndCity': e.g. "Garrapata State Park, Carmel, California"
 * - 'address': the full address/label, e.g. "34500 CA-1, Carmel, CA 93923, USA"
 * - 'cityStateCountry': e.g. "Carmel, California, United States"
 */
export const locationDisplayModes = ['placeName', 'placeNameAndCity', 'address', 'cityStateCountry'] as const;
export type LocationDisplayMode = (typeof locationDisplayModes)[number];

/** A photo's own display choice: one of the album-level modes, or its own custom text. */
export const assetLocationDisplayModes = [...locationDisplayModes, 'custom'] as const;
export type AssetLocationDisplayMode = (typeof assetLocationDisplayModes)[number];

export interface MediaAssetAlbumMembership {
  albumId: string;
  // Legacy two-bucket ordering (pre-interleaving); still used as a fallback
  // tiebreaker for memberships that have no manualSortTime.
  manualSortOrdinal?: number | null;
  forceManualOrder?: boolean | null;
  // Virtual sort timestamp (epoch ms; fractional values allowed so midpoints
  // between any two distinct times always exist). A photo with a manualSortTime
  // sorts interleaved with capture-time photos at this instant.
  manualSortTime?: number | null;
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

  // How this asset was produced, when it's an edited copy of a sourceAssetId. Absent on originals.
  editMethod?: 'ai' | 'manual';

  // Ids of edited versions imported for this asset, if any (an original can have more than one).
  editedAssetIds?: string[];

  // Star rating, 0-5. Null/undefined means unrated. Independent of PhotoState.
  rating?: number | null;

  // Optional capture location metadata when available.
  locationLabel?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  locationSource?: LocationSource | null;
  // Name of the place (Google Places displayName), e.g. "Garrapata State Park".
  // Set only by the Set Location dialog; null for EXIF/Nominatim locations.
  placeName?: string | null;
  // Per-photo override of what the Location field shows; null = use the
  // album's (or the global) LocationDisplayMode.
  locationDisplayMode?: AssetLocationDisplayMode | null;
  // Free text shown when locationDisplayMode is 'custom'. Independent of the
  // stored place, and may be set on a photo with no place at all.
  customLocationLabel?: string | null;

  // Temporary compatibility fields while API/frontend finish migrating
  // away from the previous single-file reference naming.
  storageRootId?: string;
  archivePath?: string;
  fileSizeBytes?: number;
  contentHash?: string;
}
