import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { MediaAsset, PrintCrop, PrintCropMode, PrintOrderItem, PrintSize } from '@tedography/domain';
import { MIN_RESOLUTION_PX } from '@tedography/domain';
import {
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset,
} from '../media/resolveAssetMediaPath.js';
import type { ResolvedPrintItem } from './printTypes.js';

// ─── Print dimensions at 300 dpi ─────────────────────────────────────────────

const PRINT_PX: Record<PrintSize, { short: number; long: number }> = {
  '4x6':   { short: 1200, long: 1800 },
  '5x7':   { short: 1500, long: 2100 },
  '8x10':  { short: 2400, long: 3000 },
  '11x14': { short: 3300, long: 4200 },
};

const NATIVE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);

function printPixelDimensions(size: PrintSize, landscape: boolean): { w: number; h: number } {
  const { short, long } = PRINT_PX[size];
  return landscape ? { w: long, h: short } : { w: short, h: long };
}

function checkResolution(
  srcW: number,
  srcH: number,
  size: PrintSize,
  landscape: boolean
): string[] {
  const warnings: string[] = [];
  const { short, long } = MIN_RESOLUTION_PX[size];
  const [minW, minH] = landscape ? [long, short] : [short, long];
  if (srcW < minW || srcH < minH) {
    warnings.push(
      `Image (${srcW}×${srcH}px) may be too low resolution for a ${size} print (needs ~${minW}×${minH}px at 300 dpi).`
    );
  }
  return warnings;
}

export function resolveSourcePath(asset: MediaAsset): { filePath: string; mimeType: string } {
  const fmt = (asset.originalFileFormat ?? '').toLowerCase();
  if (NATIVE_FORMATS.has(fmt)) {
    return {
      filePath: resolveOriginalAbsolutePathForAsset(asset),
      mimeType: fmt === 'jpg' || fmt === 'jpeg' ? 'image/jpeg' : `image/${fmt}`,
    };
  }
  return {
    filePath: resolveDisplayAbsolutePathForAsset(asset),
    mimeType: 'image/jpeg',
  };
}

export function buildResolvedItem(
  item: PrintOrderItem,
  asset: MediaAsset
): ResolvedPrintItem {
  const { filePath, mimeType } = resolveSourcePath(asset);
  const srcW = asset.width ?? 0;
  const srcH = asset.height ?? 0;
  const landscape = srcW > srcH;
  const resolutionWarnings = srcW > 0 && srcH > 0
    ? checkResolution(srcW, srcH, item.size, landscape)
    : ['Image dimensions unknown — resolution cannot be validated.'];

  return {
    item,
    asset,
    sourceFilePath: filePath,
    sourceMimeType: mimeType,
    sourceWidth: srcW,
    sourceHeight: srcH,
    resolutionWarnings,
  };
}

// ─── Sharp-based image export ─────────────────────────────────────────────────

export async function exportPrintJpeg(
  resolved: ResolvedPrintItem,
  outputPath: string,
  preview = false
): Promise<void> {
  const { sourceFilePath, sourceWidth, sourceHeight, item } = resolved;

  // Read EXIF orientation first so we can determine the post-rotation dimensions.
  // EXIF orientations 5–8 swap width and height (e.g. iPhone landscape shots stored portrait).
  const meta = await sharp(sourceFilePath).metadata();
  const orientation = meta.orientation ?? 1;
  const swapDims = orientation >= 5 && orientation <= 8;
  const effectiveW = swapDims ? (meta.height ?? sourceWidth) : (meta.width ?? sourceWidth);
  const effectiveH = swapDims ? (meta.width ?? sourceHeight) : (meta.height ?? sourceHeight);

  // Use effective (post-rotation) dimensions to decide print orientation.
  const landscape = effectiveW > effectiveH;
  const { w: printW, h: printH } = printPixelDimensions(item.size, landscape);

  let pipeline = sharp(sourceFilePath).rotate(); // auto-correct EXIF orientation

  if (item.cropMode === 'fill' && item.crop) {
    const crop = item.crop;
    const left = Math.round(crop.x * effectiveW);
    const top = Math.round(crop.y * effectiveH);
    const width = Math.max(1, Math.min(Math.round(crop.width * effectiveW), effectiveW - left));
    const height = Math.max(1, Math.min(Math.round(crop.height * effectiveH), effectiveH - top));
    pipeline = pipeline.extract({ left, top, width, height });
  }

  if (preview) {
    pipeline = pipeline.resize(800, 800, { fit: 'inside' });
  } else if (item.cropMode === 'fill') {
    pipeline = pipeline.resize(printW, printH, { fit: 'fill' });
  } else {
    // fit mode: letterbox/pillarbox with white background
    pipeline = pipeline.resize(printW, printH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } });
  }

  await pipeline.jpeg({ quality: 95 }).toFile(outputPath);
}

export function defaultCenterCrop(srcW: number, srcH: number, printAspect: number): PrintCrop {
  const srcAspect = srcW / srcH;
  let cropW: number;
  let cropH: number;
  if (srcAspect > printAspect) {
    cropH = 1.0;
    cropW = printAspect / srcAspect;
  } else {
    cropW = 1.0;
    cropH = srcAspect / printAspect;
  }
  return {
    x: (1 - cropW) / 2,
    y: (1 - cropH) / 2,
    width: cropW,
    height: cropH,
  };
}

export function printAspectRatio(size: PrintSize, landscape: boolean): number {
  const { w, h } = printPixelDimensions(size, landscape);
  return w / h;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function sequencedFilename(seq: number, baseName: string, size: PrintSize, finish: string, suffix = ''): string {
  const stem = baseName.replace(/\.[^.]+$/, '');
  return `${String(seq).padStart(3, '0')}__${stem}__${size}__${finish}${suffix}.jpg`;
}
