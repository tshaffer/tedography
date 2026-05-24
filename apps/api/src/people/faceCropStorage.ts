import fs from 'node:fs/promises';
import path from 'node:path';
import type { FaceDetection, MediaAsset } from '@tedography/domain';
import { buildPeopleFaceCropDerivedRelativePath, resolveDerivedAbsolutePath } from '../import/derivedStorage.js';

type SharpLikeModule = {
  default: (input: string) => SharpLikePipeline;
};

type SharpLikePipeline = {
  metadata(): Promise<{ width?: number; height?: number; orientation?: number }>;
  rotate(): SharpLikePipeline;
  extract(region: { left: number; top: number; width: number; height: number }): SharpLikePipeline;
  resize(options: { width?: number; height?: number; fit?: string; withoutEnlargement?: boolean }): SharpLikePipeline;
  jpeg(options?: { quality?: number }): SharpLikePipeline;
  toFile(filePath: string): Promise<unknown>;
};

// Minimum face crop dimension sent to Rekognition. Crops smaller than this
// get upsampled so the face recognition API has enough pixels to work with.
const MIN_FACE_CROP_PX = 160;

let sharpModulePromise: Promise<SharpLikeModule> | null = null;

async function loadSharp(): Promise<SharpLikeModule> {
  if (!sharpModulePromise) {
    const moduleName = 'sharp';
    sharpModulePromise = import(moduleName) as Promise<SharpLikeModule>;
  }

  return sharpModulePromise;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function usesSwappedDimensionsForOrientation(orientation: number | undefined): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
}

export function resolveOrientedImageDimensions(input: {
  metadataWidth?: number | undefined;
  metadataHeight?: number | undefined;
  metadataOrientation?: number | undefined;
  assetWidth?: number | null;
  assetHeight?: number | null;
}): { width: number; height: number } | null {
  const rawWidth = input.metadataWidth ?? input.assetWidth ?? null;
  const rawHeight = input.metadataHeight ?? input.assetHeight ?? null;
  if (!rawWidth || !rawHeight || rawWidth <= 0 || rawHeight <= 0) {
    return null;
  }

  if (usesSwappedDimensionsForOrientation(input.metadataOrientation)) {
    return { width: rawHeight, height: rawWidth };
  }

  return { width: rawWidth, height: rawHeight };
}

export async function generateFaceCropForAsset(input: {
  asset: MediaAsset;
  imagePath: string;
  detection: Pick<FaceDetection, 'faceIndex' | 'boundingBox'>;
  pipelineVersion: string;
  forceRegenerate?: boolean;
}): Promise<{ relativePath: string; absolutePath: string }> {
  const relativePath = buildPeopleFaceCropDerivedRelativePath({
    originalContentHash: input.asset.originalContentHash,
    pipelineVersion: input.pipelineVersion,
    faceIndex: input.detection.faceIndex
  });
  const absolutePath = resolveDerivedAbsolutePath(relativePath);

  if (!input.forceRegenerate) {
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isFile() && stat.size > 0) {
        return { relativePath, absolutePath };
      }
    } catch {
      // Generate below.
    }
  }

  const parentDirectory = path.dirname(absolutePath);
  await fs.mkdir(parentDirectory, { recursive: true });

  const sharpModule = await loadSharp();
  const metaPipeline = sharpModule.default(input.imagePath) as SharpLikePipeline;
  const metadata = await metaPipeline.metadata();
  const dimensions = resolveOrientedImageDimensions({
    metadataWidth: metadata.width,
    metadataHeight: metadata.height,
    metadataOrientation: metadata.orientation,
    assetWidth: input.asset.width ?? null,
    assetHeight: input.asset.height ?? null
  });
  if (!dimensions) {
    throw new Error(`Unable to determine crop dimensions for asset ${input.asset.id}`);
  }
  const { width, height } = dimensions;

  const left = Math.floor(clamp(input.detection.boundingBox.left * width, 0, width - 1));
  const top = Math.floor(clamp(input.detection.boundingBox.top * height, 0, height - 1));
  const cropWidth = Math.max(1, Math.floor(clamp(input.detection.boundingBox.width * width, 1, width - left)));
  const cropHeight = Math.max(1, Math.floor(clamp(input.detection.boundingBox.height * height, 1, height - top)));

  // Upsample small crops so Rekognition has enough pixels to match reliably.
  const needsUpscale = cropWidth < MIN_FACE_CROP_PX || cropHeight < MIN_FACE_CROP_PX;
  let pipeline = (sharpModule.default(input.imagePath) as SharpLikePipeline)
    .rotate()
    .extract({ left, top, width: cropWidth, height: cropHeight });

  if (needsUpscale) {
    pipeline = pipeline.resize({
      width: MIN_FACE_CROP_PX,
      height: MIN_FACE_CROP_PX,
      fit: 'inside',
      withoutEnlargement: false
    });
  }

  await pipeline.jpeg({ quality: 92 }).toFile(absolutePath);

  return { relativePath, absolutePath };
}
