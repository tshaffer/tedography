import type { CaptureDateTimeSource, LocationSource } from '@tedography/domain';
import type { CaptureDateTag, ExtractedCaptureDateFields, ExtractedImportMetadata } from './exifMetadata.js';

export type ExtractedCaptureDateTimeSource = Extract<
  CaptureDateTimeSource,
  'exif-original' | 'exif-weak' | 'none'
>;

/**
 * Classify the trustworthiness of a capture date extracted from a file, per the
 * table in Docs/ORDERING_PLAN.md: DateTimeOriginal is trustworthy on its own;
 * the CreateDate family only when a camera demonstrably wrote the file;
 * ModifyDate never.
 */
export function classifyExtractedCaptureDate(
  fields: Pick<ExtractedCaptureDateFields, 'captureDateTimeTag' | 'cameraMake' | 'cameraModel'>
): ExtractedCaptureDateTimeSource {
  const tag: CaptureDateTag | null = fields.captureDateTimeTag;
  if (tag === null) {
    return 'none';
  }

  if (tag === 'DateTimeOriginal' || tag === 'SubSecDateTimeOriginal') {
    return 'exif-original';
  }

  if (tag === 'ModifyDate') {
    return 'exif-weak';
  }

  const hasCameraTags =
    (fields.cameraMake ?? '').trim().length > 0 || (fields.cameraModel ?? '').trim().length > 0;
  return hasCameraTags ? 'exif-original' : 'exif-weak';
}

/**
 * Classify the source of a location extracted from a file: 'exif' when the file
 * itself supplied GPS coordinates or a location label (reverse-geocoding just
 * enriches those coordinates into city/state/country, it isn't its own source),
 * 'none' otherwise.
 */
export function classifyExtractedLocation(
  metadata: Pick<ExtractedImportMetadata, 'locationLatitude' | 'locationLongitude' | 'locationLabel'>
): LocationSource {
  const hasCoordinates = metadata.locationLatitude != null && metadata.locationLongitude != null;
  const hasLabel = typeof metadata.locationLabel === 'string' && metadata.locationLabel.trim().length > 0;
  return hasCoordinates || hasLabel ? 'exif' : 'none';
}

/**
 * Classify a stored asset against the date currently in its original file.
 * The stored and file dates "match" only when they refer to the same instant.
 */
export function classifyStoredCaptureDate(input: {
  storedCaptureDateTime: Date | null;
  fileFields: ExtractedCaptureDateFields;
}): Exclude<CaptureDateTimeSource, 'manual'> {
  const stored = input.storedCaptureDateTime;
  const fileDate = input.fileFields.captureDateTime;

  if (stored === null && fileDate === null) {
    return 'none';
  }

  if (stored === null || fileDate === null || stored.getTime() !== fileDate.getTime()) {
    return 'changed-after-import';
  }

  const classified = classifyExtractedCaptureDate(input.fileFields);
  // Both dates are present and equal, so the file produced a date; 'none' is unreachable.
  return classified === 'none' ? 'exif-weak' : classified;
}
