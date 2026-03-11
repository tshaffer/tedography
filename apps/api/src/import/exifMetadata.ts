export interface ExtractedImportMetadata {
  captureDateTime: Date | null;
  width: number | null;
  height: number | null;
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

export async function extractImportMetadata(absolutePath: string): Promise<ExtractedImportMetadata> {
  const runtime = await getExiftoolRuntime();
  if (!runtime) {
    return { captureDateTime: null, width: null, height: null };
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

    return {
      captureDateTime,
      width,
      height
    };
  } catch {
    // Missing/invalid metadata should not fail a full scan; return null fields.
    return { captureDateTime: null, width: null, height: null };
  }
}
