import fs from 'node:fs';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import type { MediaAsset } from '@tedography/domain';
import { config } from '../config.js';
import { findById } from '../repositories/assetRepository.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { reimportAssetById } from './refreshService.js';

const SUPPORTED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export class AiEditError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_FOUND' | 'UNSUPPORTED_FORMAT' | 'NOT_CONFIGURED' | 'OPENAI_ERROR' | 'IO_ERROR'
  ) {
    super(message);
    this.name = 'AiEditError';
  }
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
}

function mimeTypeForFormat(fmt: string): string {
  switch (fmt) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export async function aiEditAsset(
  assetId: string,
  prompt: string
): Promise<{ asset: MediaAsset; backupPath: string }> {
  if (!config.openAiApiKey) {
    throw new AiEditError(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to the API environment.',
      'NOT_CONFIGURED'
    );
  }

  const asset = await findById(assetId);
  if (!asset) {
    throw new AiEditError(`Asset not found: ${assetId}`, 'NOT_FOUND');
  }

  const originalPath = resolveOriginalAbsolutePathForAsset(asset);
  const fmt = asset.originalFileFormat.toLowerCase();

  if (!SUPPORTED_FORMATS.has(fmt)) {
    throw new AiEditError(
      `AI editing supports JPEG, PNG, and WebP files. This asset is ${asset.originalFileFormat.toUpperCase()}.`,
      'UNSUPPORTED_FORMAT'
    );
  }

  const ext = path.extname(originalPath);
  const basePath = originalPath.slice(0, -ext.length);
  const backupPath = `${basePath}.bak.${formatTimestamp()}${ext}`;

  fs.copyFileSync(originalPath, backupPath);

  try {
    const openai = new OpenAI({ apiKey: config.openAiApiKey });
    const imageBytes = fs.readFileSync(originalPath);
    const imageFile = await toFile(imageBytes, path.basename(originalPath), {
      type: mimeTypeForFormat(fmt)
    });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new AiEditError('OpenAI returned no image data.', 'OPENAI_ERROR');
    }

    const resultBuffer = Buffer.from(b64, 'base64');
    const sharpInstance = sharp(resultBuffer);

    if (fmt === 'jpg' || fmt === 'jpeg') {
      await sharpInstance.jpeg({ quality: 92 }).toFile(originalPath);
    } else if (fmt === 'png') {
      await sharpInstance.png().toFile(originalPath);
    } else {
      await sharpInstance.webp({ quality: 92 }).toFile(originalPath);
    }
  } catch (error) {
    try { fs.copyFileSync(backupPath, originalPath); } catch { /* ignore */ }
    try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
    if (error instanceof AiEditError) {
      throw error;
    }
    throw new AiEditError(
      error instanceof Error ? error.message : 'Unknown error during AI edit',
      'OPENAI_ERROR'
    );
  }

  await reimportAssetById(assetId);

  const updated = await findById(assetId);
  if (!updated) {
    throw new AiEditError('Asset not found after reimport', 'IO_ERROR');
  }

  return { asset: updated, backupPath };
}
