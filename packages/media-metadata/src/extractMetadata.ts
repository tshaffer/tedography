export interface ExtractedMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  captureDateTime?: string;
  locationLabel?: string;
  locationLatitude?: number;
  locationLongitude?: number;
}

type ExifDateLike = {
  toDate: () => Date;
};

type ExiftoolRuntime = {
  read: (filePath: string) => Promise<Record<string, unknown>>;
  end: () => Promise<number>;
};

let exiftoolRuntime: ExiftoolRuntime | null | undefined;

async function getExiftoolRuntime(): Promise<ExiftoolRuntime | null> {
  if (exiftoolRuntime !== undefined) {
    return exiftoolRuntime;
  }

  try {
    const moduleName = 'exiftool-vendored';
    const exiftoolModule = (await import(moduleName)) as {
      exiftool?: ExiftoolRuntime;
    };

    exiftoolRuntime = exiftoolModule.exiftool ?? null;
  } catch {
    exiftoolRuntime = null;
  }

  return exiftoolRuntime;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    const firstNumericToken = value.match(/-?\d+(\.\d+)?/)?.[0];
    if (!firstNumericToken) {
      return undefined;
    }

    const tokenAsNumber = Number(firstNumericToken);
    if (Number.isFinite(tokenAsNumber)) {
      return tokenAsNumber;
    }
  }

  return undefined;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSizePair(value: unknown): { width?: number; height?: number } {
  if (typeof value !== 'string') {
    return {};
  }

  const matched = value.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (!matched) {
    return {};
  }

  const width = Number(matched[1]);
  const height = Number(matched[2]);
  const parsed: { width?: number; height?: number } = {};
  if (Number.isFinite(width)) {
    parsed.width = width;
  }
  if (Number.isFinite(height)) {
    parsed.height = height;
  }
  return parsed;
}

function toIsoDate(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return undefined;
  }

  if (typeof value === 'object' && 'toDate' in value && typeof (value as ExifDateLike).toDate === 'function') {
    const dateValue = (value as ExifDateLike).toDate();
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toISOString();
    }
  }

  return undefined;
}

function parseGpsCoordinate(value: unknown): number | undefined {
  const numericValue = toFiniteNumber(value);
  if (numericValue !== undefined) {
    return numericValue;
  }

  const stringValue = toTrimmedString(value);
  if (!stringValue) {
    return undefined;
  }

  const hemisphereMatch = stringValue.match(/\b([NSEW])\b/i);
  const hemisphere = hemisphereMatch?.[1]?.toUpperCase() ?? undefined;

  const degreeMinuteSecondMatch = stringValue.match(
    /(-?\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?\D*([NSEW])?/i
  );

  if (!degreeMinuteSecondMatch) {
    return undefined;
  }

  const degrees = Number(degreeMinuteSecondMatch[1]);
  const minutes = Number(degreeMinuteSecondMatch[2] ?? '0');
  const seconds = Number(degreeMinuteSecondMatch[3] ?? '0');

  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return undefined;
  }

  let decimalDegrees = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (degrees < 0) {
    decimalDegrees *= -1;
  }

  const direction = (degreeMinuteSecondMatch[4] ?? hemisphere)?.toUpperCase();
  if (direction === 'S' || direction === 'W') {
    decimalDegrees = -Math.abs(decimalDegrees);
  }

  return decimalDegrees;
}

function deriveLocationLabel(tags: Record<string, unknown>): string | undefined {
  const locationParts = [
    toTrimmedString(tags.SubLocation),
    toTrimmedString(tags.City),
    toTrimmedString(tags.State),
    toTrimmedString(tags['Country-PrimaryLocationName']),
    toTrimmedString(tags.Country)
  ].filter((value, index, all): value is string => value !== undefined && all.indexOf(value) === index);

  if (locationParts.length > 0) {
    return locationParts.join(', ');
  }

  return toTrimmedString(tags.GPSPosition);
}

export async function extractMetadata(filePath: string): Promise<ExtractedMetadata> {
  const runtime = await getExiftoolRuntime();
  if (!runtime) {
    return {};
  }

  try {
    const tags = await runtime.read(filePath);
    const compositeSize = parseSizePair(tags.ImageSize ?? tags.SourceImageSize);

    const width =
      toFiniteNumber(tags.ImageWidth) ??
      toFiniteNumber(tags.ExifImageWidth) ??
      toFiniteNumber(tags.SourceImageWidth) ??
      compositeSize.width;

    const height =
      toFiniteNumber(tags.ImageHeight) ??
      toFiniteNumber(tags.ExifImageHeight) ??
      toFiniteNumber(tags.SourceImageHeight) ??
      compositeSize.height;

    const captureDateTime =
      toIsoDate(tags.DateTimeOriginal) ??
      toIsoDate(tags.CreateDate) ??
      toIsoDate(tags.MediaCreateDate) ??
      toIsoDate(tags.SubSecDateTimeOriginal) ??
      toIsoDate(tags.TrackCreateDate) ??
      toIsoDate(tags.ModifyDate);

    const locationLatitude =
      parseGpsCoordinate(tags['GPSLatitude#']) ??
      parseGpsCoordinate(tags.GPSLatitude);

    const locationLongitude =
      parseGpsCoordinate(tags['GPSLongitude#']) ??
      parseGpsCoordinate(tags.GPSLongitude);

    const locationLabel = deriveLocationLabel(tags);

    const metadata: ExtractedMetadata = {};
    if (width !== undefined) {
      metadata.width = width;
    }
    if (height !== undefined) {
      metadata.height = height;
    }
    if (captureDateTime !== undefined) {
      metadata.captureDateTime = captureDateTime;
    }
    if (locationLabel !== undefined) {
      metadata.locationLabel = locationLabel;
    }
    if (locationLatitude !== undefined) {
      metadata.locationLatitude = locationLatitude;
    }
    if (locationLongitude !== undefined) {
      metadata.locationLongitude = locationLongitude;
    }

    return metadata;
  } catch {
    // Import flow should stay resilient if metadata is unreadable.
    return {};
  }
}

export async function shutdownMetadataExtractor(): Promise<void> {
  const runtime = await getExiftoolRuntime();
  if (!runtime) {
    return;
  }

  await runtime.end();
}
