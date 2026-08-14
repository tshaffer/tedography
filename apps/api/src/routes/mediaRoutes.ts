import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Response } from 'express';
import sharp from 'sharp';
import { MediaType, type ImportApiErrorResponse } from '@tedography/domain';
import {
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset,
  resolveThumbnailAbsolutePathForAsset
} from '../media/resolveAssetMediaPath.js';
import { findById } from '../repositories/assetRepository.js';
import { log } from '../logger.js';

export const mediaRoutes: Router = Router();

function getContentTypeForFile(absolutePath: string): string {
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.heic') {
    return 'image/heic';
  }

  return 'application/octet-stream';
}

async function sendResolvedFile(
  res: Response,
  absolutePath: string,
  cacheControl: string
): Promise<void> {
  const targetStat = await fs.stat(absolutePath);
  if (!targetStat.isFile()) {
    throw new Error('File not found');
  }

  res.setHeader('Cache-Control', cacheControl);
  res.type(getContentTypeForFile(absolutePath));
  res.sendFile(absolutePath);
}

mediaRoutes.get('/display/:assetId', async (req, res) => {
  const assetId = req.params.assetId?.trim();
  if (!assetId) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const asset = await findById(assetId);
  if (!asset) {
    const errorResponse: ImportApiErrorResponse = { error: 'Asset not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    const absolutePath = resolveDisplayAbsolutePathForAsset(asset);
    await sendResolvedFile(res, absolutePath, 'public, max-age=31536000, immutable');
  } catch (error) {
    log.error('Failed to resolve display media path', error);
    const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
    res.status(404).json(errorResponse);
  }
});

mediaRoutes.get('/thumbnail/:assetId', async (req, res) => {
  const assetId = req.params.assetId?.trim();
  if (!assetId) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const asset = await findById(assetId);
  if (!asset) {
    const errorResponse: ImportApiErrorResponse = { error: 'Asset not found' };
    res.status(404).json(errorResponse);
    return;
  }

  // v1 fallback strategy: if thumbnail is missing/unavailable, serve display media.
  let absolutePath = resolveThumbnailAbsolutePathForAsset(asset);
  if (!absolutePath) {
    try {
      absolutePath = resolveDisplayAbsolutePathForAsset(asset);
    } catch (error) {
      log.error('Failed to resolve thumbnail fallback display path', error);
      const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
      res.status(404).json(errorResponse);
      return;
    }
  }

  try {
    await sendResolvedFile(res, absolutePath, 'public, max-age=31536000, immutable');
  } catch (error) {
    try {
      const displayAbsolutePath = resolveDisplayAbsolutePathForAsset(asset);
      await sendResolvedFile(res, displayAbsolutePath, 'public, max-age=31536000, immutable');
    } catch (fallbackError) {
      log.error('Failed to resolve thumbnail fallback display path after thumbnail miss', fallbackError);
      const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
      res.status(404).json(errorResponse);
    }
  }
});

mediaRoutes.get('/original/:assetId', async (req, res) => {
  const assetId = req.params.assetId?.trim();
  if (!assetId) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const asset = await findById(assetId);
  if (!asset) {
    const errorResponse: ImportApiErrorResponse = { error: 'Asset not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    const absolutePath = resolveOriginalAbsolutePathForAsset(asset);
    await sendResolvedFile(res, absolutePath, 'public, max-age=86400');
  } catch (error) {
    log.error('Failed to resolve original media path', error);
    const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
    res.status(404).json(errorResponse);
  }
});

mediaRoutes.get('/export/:assetId', async (req, res) => {
  const assetId = req.params.assetId?.trim();
  if (!assetId) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const asset = await findById(assetId);
  if (!asset) {
    const errorResponse: ImportApiErrorResponse = { error: 'Asset not found' };
    res.status(404).json(errorResponse);
    return;
  }

  if (asset.mediaType !== MediaType.Photo) {
    const errorResponse: ImportApiErrorResponse = { error: 'Only photos can be exported' };
    res.status(400).json(errorResponse);
    return;
  }

  const format = req.query.format === 'png' ? 'png' : req.query.format === 'original' ? 'original' : 'jpeg';

  try {
    if (format === 'original') {
      const originalPath = resolveOriginalAbsolutePathForAsset(asset);
      const originalBytes = await fs.readFile(originalPath);
      res.setHeader('Content-Type', getContentTypeForFile(originalPath));
      res.send(originalBytes);
      return;
    }

    const displayPath = resolveDisplayAbsolutePathForAsset(asset);
    const converted = format === 'png'
      ? await sharp(displayPath).png().toBuffer()
      : await sharp(displayPath).jpeg({ quality: 92 }).toBuffer();
    res.setHeader('Content-Type', format === 'png' ? 'image/png' : 'image/jpeg');
    res.send(converted);
  } catch (error) {
    log.error('Failed to export asset', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to export asset' };
    res.status(500).json(errorResponse);
  }
});
