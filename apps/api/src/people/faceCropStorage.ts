import fs from 'node:fs/promises';
import path from 'node:path';
import type { FaceDetection, MediaAsset } from '@tedography/domain';
import { buildPeopleFaceCropDerivedRelativePath, resolveDerivedAbsolutePath } from '../import/derivedStorage.js';

type SharpLikeModule = {
  default: (input: string) => SharpLikePipeline;
};

type SharpLikePipeline = {
  metadata(): Promise<{ width?: number; height?: number }>;
  extract(region: { left: number; top: number; width: number; height: number }): SharpLikePipeline;
  jpeg(options?: { quality?: number }): SharpLikePipeline;
  toFile(filePath: string): Promise<unknown>;
};

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
  const pipeline = sharpModule.default(input.imagePath) as SharpLikePipeline;
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? input.asset.width ?? null;
  const height = metadata.height ?? input.asset.height ?? null;
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error(`Unable to determine crop dimensions for asset ${input.asset.id}`);
  }

  const left = Math.floor(clamp(input.detection.boundingBox.left * width, 0, width - 1));
  const top = Math.floor(clamp(input.detection.boundingBox.top * height, 0, height - 1));
  const cropWidth = Math.max(1, Math.floor(clamp(input.detection.boundingBox.width * width, 1, width - left)));
  const cropHeight = Math.max(1, Math.floor(clamp(input.detection.boundingBox.height * height, 1, height - top)));

  await (sharpModule.default(input.imagePath) as SharpLikePipeline)
    .extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight
    })
    .jpeg({ quality: 92 })
    .toFile(absolutePath);

  return { relativePath, absolutePath };
}
