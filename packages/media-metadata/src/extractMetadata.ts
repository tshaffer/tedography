export interface ExtractedMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  captureDateTime?: string;
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
  }

  return undefined;
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

export async function extractMetadata(filePath: string): Promise<ExtractedMetadata> {
  const runtime = await getExiftoolRuntime();
  if (!runtime) {
    return {};
  }

  try {
    const tags = await runtime.read(filePath);

    const width =
      toFiniteNumber(tags.ImageWidth) ??
      toFiniteNumber(tags.ExifImageWidth) ??
      toFiniteNumber(tags.SourceImageWidth);

    const height =
      toFiniteNumber(tags.ImageHeight) ??
      toFiniteNumber(tags.ExifImageHeight) ??
      toFiniteNumber(tags.SourceImageHeight);

    const captureDateTime =
      toIsoDate(tags.DateTimeOriginal) ??
      toIsoDate(tags.CreateDate) ??
      toIsoDate(tags.MediaCreateDate) ??
      toIsoDate(tags.SubSecDateTimeOriginal) ??
      toIsoDate(tags.TrackCreateDate) ??
      toIsoDate(tags.ModifyDate);

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
