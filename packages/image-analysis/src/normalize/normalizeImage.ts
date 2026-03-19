export interface NormalizedImageData {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface ImageMetadata {
  width: number;
  height: number;
}

type SharpLikeModule = {
  default: (input: string) => SharpLikePipeline;
};

type SharpLikePipeline = {
  grayscale(): unknown;
  resize(width: number, height: number, options?: { fit?: 'fill' }): unknown;
  raw(): unknown;
  metadata(): Promise<{
    width?: number;
    height?: number;
  }>;
  toBuffer(options: { resolveWithObject: true }): Promise<{
    data: Buffer;
    info: {
      width: number;
      height: number;
      channels: number;
    };
  }>;
};

let sharpModulePromise: Promise<SharpLikeModule> | null = null;

async function loadSharp(): Promise<SharpLikeModule> {
  if (!sharpModulePromise) {
    const moduleName = 'sharp';
    sharpModulePromise = import(moduleName) as Promise<SharpLikeModule>;
  }

  return sharpModulePromise;
}

export async function readImageMetadata(filePath: string): Promise<ImageMetadata> {
  const sharpModule = await loadSharp();
  const pipeline = sharpModule.default(filePath) as SharpLikePipeline;
  const metadata = await pipeline.metadata();

  if (typeof metadata.width !== 'number' || typeof metadata.height !== 'number') {
    throw new Error(`Unable to determine image dimensions for ${filePath}.`);
  }

  return {
    width: metadata.width,
    height: metadata.height
  };
}

export async function normalizeImage(
  filePath: string,
  width: number,
  height: number
): Promise<NormalizedImageData> {
  const sharpModule = await loadSharp();
  const pipeline = sharpModule.default(filePath) as SharpLikePipeline;
  const normalized = await (pipeline
    .grayscale() as SharpLikePipeline)
    .resize(width, height, { fit: 'fill' }) as SharpLikePipeline;
  const rawBuffer = await (normalized
    .raw() as SharpLikePipeline)
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(
    rawBuffer.data.buffer,
    rawBuffer.data.byteOffset,
    rawBuffer.data.byteLength
  );

  if (rawBuffer.info.channels !== 1) {
    throw new Error(`Expected one grayscale channel, received ${String(rawBuffer.info.channels)}.`);
  }

  return {
    width: rawBuffer.info.width,
    height: rawBuffer.info.height,
    pixels
  };
}
