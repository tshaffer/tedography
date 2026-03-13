export interface ExtractedImportMetadata {
  captureDateTime: Date | null;
  width: number | null;
  height: number | null;
  locationLabel: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

type ExifDateLike = {
  toDate: () => Date;
};

type ExiftoolRuntime = {
  read: (filePath: string) => Promise<Record<string, unknown>>;
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

function toFiniteNumber(value: unknown): number | null {
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
      return null;
    }

    const tokenAsNumber = Number(firstNumericToken);
    if (Number.isFinite(tokenAsNumber)) {
      return tokenAsNumber;
    }
  }

  return null;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSizePair(value: unknown): { width: number | null; height: number | null } {
  if (typeof value !== 'string') {
    return { width: null, height: null };
  }

  const matched = value.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (!matched) {
    return { width: null, height: null };
  }

  const width = Number(matched[1]);
  const height = Number(matched[2]);

  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  if (typeof value === 'object' && 'toDate' in value && typeof (value as ExifDateLike).toDate === 'function') {
    const parsed = (value as ExifDateLike).toDate();
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function parseGpsCoordinate(value: unknown): number | null {
  const numericValue = toFiniteNumber(value);
  if (numericValue !== null) {
    return numericValue;
  }

  const stringValue = toTrimmedString(value);
  if (!stringValue) {
    return null;
  }

  const hemisphereMatch = stringValue.match(/\b([NSEW])\b/i);
  const hemisphere = hemisphereMatch?.[1]?.toUpperCase() ?? null;

  const degreeMinuteSecondMatch = stringValue.match(
    /(-?\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?\D*([NSEW])?/i
  );

  if (degreeMinuteSecondMatch) {
    const degrees = Number(degreeMinuteSecondMatch[1]);
    const minutes = Number(degreeMinuteSecondMatch[2] ?? '0');
    const seconds = Number(degreeMinuteSecondMatch[3] ?? '0');

    if (Number.isFinite(degrees) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
      let decimalDegrees =
        Math.abs(degrees) + minutes / 60 + seconds / 3600;

      if (degrees < 0) {
        decimalDegrees *= -1;
      }

      const direction = (degreeMinuteSecondMatch[4] ?? hemisphere)?.toUpperCase();
      if (direction === 'S' || direction === 'W') {
        decimalDegrees = -Math.abs(decimalDegrees);
      }

      return decimalDegrees;
    }
  }

  return null;
}

function deriveLocationLabel(tags: Record<string, unknown>): string | null {
  const locationParts = [
    toTrimmedString(tags.SubLocation),
    toTrimmedString(tags.City),
    toTrimmedString(tags.State),
    toTrimmedString(tags['Country-PrimaryLocationName']),
    toTrimmedString(tags.Country)
  ].filter((value, index, all): value is string => value !== null && all.indexOf(value) === index);

  if (locationParts.length > 0) {
    return locationParts.join(', ');
  }

  return toTrimmedString(tags.GPSPosition);
}

export async function extractImportMetadata(absolutePath: string): Promise<ExtractedImportMetadata> {
  const runtime = await getExiftoolRuntime();
  if (!runtime) {
    return {
      captureDateTime: null,
      width: null,
      height: null,
      locationLabel: null,
      locationLatitude: null,
      locationLongitude: null
    };
  }

  try {
    const tags = await runtime.read(absolutePath);
    const sizePair = parseSizePair(tags.ImageSize ?? tags.SourceImageSize);

    const width =
      toFiniteNumber(tags.ImageWidth) ??
      toFiniteNumber(tags.ExifImageWidth) ??
      toFiniteNumber(tags.SourceImageWidth) ??
      sizePair.width;

    const height =
      toFiniteNumber(tags.ImageHeight) ??
      toFiniteNumber(tags.ExifImageHeight) ??
      toFiniteNumber(tags.SourceImageHeight) ??
      sizePair.height;

    const captureDateTime =
      toDate(tags.DateTimeOriginal) ??
      toDate(tags.CreateDate) ??
      toDate(tags.MediaCreateDate) ??
      toDate(tags.SubSecDateTimeOriginal) ??
      toDate(tags.TrackCreateDate) ??
      toDate(tags.ModifyDate);

    const locationLatitude =
      parseGpsCoordinate(tags['GPSLatitude#']) ??
      parseGpsCoordinate(tags.GPSLatitude);

    const locationLongitude =
      parseGpsCoordinate(tags['GPSLongitude#']) ??
      parseGpsCoordinate(tags.GPSLongitude);

    const locationLabel = deriveLocationLabel(tags);

    return {
      captureDateTime,
      width,
      height,
      locationLabel,
      locationLatitude,
      locationLongitude
    };
  } catch {
    // Missing/invalid metadata should not fail a full scan; return null fields.
    return {
      captureDateTime: null,
      width: null,
      height: null,
      locationLabel: null,
      locationLatitude: null,
      locationLongitude: null
    };
  }
}
