import cors from 'cors';
import express, { type Express } from 'express';
import { PhotoState, normalizePhotoState } from '@tedography/domain';
import type { RefreshOperationResponse } from '@tedography/domain';
import { log } from './logger.js';
import {
  rotateAssetClockwise,
  rotateAssetCounterclockwise,
  AssetRotationServiceError
} from './import/assetRotationService.js';
import {
  rebuildDerivedFilesForAsset,
  RefreshServiceError,
  reimportAssetById
} from './import/refreshService.js';
import {
  findById,
  getAssetPageForLibrary,
  updateCaptureDatesPreservingTimes,
  updateCaptureDateTimes,
  updatePhotoState
} from './repositories/assetRepository.js';
import { albumMembershipRoutes, albumTreeRoutes } from './routes/albumTreeRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { assetKeywordRoutes, keywordRoutes } from './routes/keywordRoutes.js';
import { mediaRoutes } from './routes/mediaRoutes.js';
import { peoplePipelineRoutes } from './routes/peoplePipelineRoutes.js';
import { smartAlbumRoutes } from './routes/smartAlbumRoutes.js';

function parsePhotoState(value: unknown): PhotoState | null {
  return normalizePhotoState(value);
}

function parseCaptureDateTime(value: unknown): Date | null | undefined | 'invalid' {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'invalid';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'invalid';
  }

  return parsed;
}

function parseCaptureDate(value: unknown): { year: number; month: number; day: number } | undefined | 'invalid' {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return 'invalid';
  }

  if (typeof value !== 'string') {
    return 'invalid';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return 'invalid';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return 'invalid';
  }

  return { year, month, day };
}

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/api/import', importRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/album-tree', albumTreeRoutes);
  app.use('/api/albums', albumMembershipRoutes);
  app.use('/api/keywords', keywordRoutes);
  app.use('/api/smart-albums', smartAlbumRoutes);
  app.use('/api/assets', assetKeywordRoutes);
  app.use('/api/people-pipeline', peoplePipelineRoutes);

  app.get('/api/health', (_req, res) => {
    // Keep both fields for backward compatibility across frontend iterations.
    log.info('Health check received');
    res.json({ ok: true, status: 'ok', service: 'tedography-api' });
  });

  app.get('/api/assets', async (_req, res) => {
    const startedAt = Date.now();
    try {
      const rawOffset = typeof _req.query.offset === 'string' ? Number(_req.query.offset) : 0;
      const rawLimit = typeof _req.query.limit === 'string' ? Number(_req.query.limit) : 1000;
      const albumIds =
        typeof _req.query.albumIds === 'string'
          ? _req.query.albumIds
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
      const response = await getAssetPageForLibrary({
        offset: Number.isFinite(rawOffset) ? rawOffset : 0,
        limit: Number.isFinite(rawLimit) ? rawLimit : 1000,
        albumIds
      });
      log.info(
        `GET /api/assets loaded ${response.items.length} assets at offset ${response.offset} in ${Date.now() - startedAt}ms before JSON response${albumIds.length > 0 ? ` (album scoped: ${albumIds.length})` : ''}`
      );
      res.json(response);
    } catch (error) {
      log.error('Failed to read assets', error);
      res.status(500).json({ error: 'Failed to load assets' });
    }
  });

  app.get('/api/assets/:id', async (req, res) => {
    try {
      const asset = await findById(req.params.id);
      if (!asset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }

      res.json(asset);
    } catch (error) {
      log.error('Failed to read asset details', error);
      res.status(500).json({ error: 'Failed to load asset details' });
    }
  });

  app.patch('/api/assets/:id/photoState', async (req, res) => {
    const photoState = parsePhotoState((req.body as { photoState?: unknown }).photoState);
    if (!photoState) {
      res.status(400).json({ error: 'photoState must be one of New, Pending, Keep, Discard' });
      return;
    }

    try {
      const updatedAsset = await updatePhotoState(req.params.id, photoState);

      if (!updatedAsset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }

      res.json(updatedAsset);
    } catch (error) {
      log.error('Failed to update asset photoState', error);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  app.patch('/api/assets/capture-date', async (req, res) => {
    const payload = req.body as { assetIds?: unknown; captureDateTime?: unknown; captureDate?: unknown };
    const assetIds = Array.isArray(payload.assetIds)
      ? payload.assetIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (assetIds.length === 0) {
      res.status(400).json({ error: 'assetIds must contain at least one asset id' });
      return;
    }

    const captureDateTime = parseCaptureDateTime(payload.captureDateTime);
    const captureDate = parseCaptureDate(payload.captureDate);
    if (captureDateTime === 'invalid') {
      res.status(400).json({ error: 'captureDateTime must be a valid datetime string or null' });
      return;
    }
    if (captureDate === 'invalid') {
      res.status(400).json({ error: 'captureDate must be a valid YYYY-MM-DD string' });
      return;
    }

    if (captureDateTime !== undefined && captureDate !== undefined) {
      res.status(400).json({ error: 'Specify either captureDateTime or captureDate, not both' });
      return;
    }
    if (captureDateTime === undefined && captureDate === undefined) {
      res.status(400).json({ error: 'Provide captureDateTime, captureDate, or null to clear' });
      return;
    }

    try {
      const updatedAssets =
        captureDate !== undefined
          ? await updateCaptureDatesPreservingTimes(assetIds, captureDate)
          : await updateCaptureDateTimes(assetIds, captureDateTime ?? null);
      res.json(updatedAssets);
    } catch (error) {
      log.error('Failed to update asset captureDateTime', error);
      res.status(500).json({ error: 'Failed to update asset capture date' });
    }
  });

  app.post('/api/assets/:id/reimport', async (req, res) => {
    try {
      const response: RefreshOperationResponse = await reimportAssetById(req.params.id);
      res.json(response);
    } catch (error) {
      if (error instanceof RefreshServiceError) {
        res.status(error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_INPUT' ? 400 : 409).json({
          error: error.message
        });
        return;
      }

      log.error('Failed to reimport asset', error);
      res.status(500).json({ error: 'Failed to reimport asset' });
    }
  });

  app.post('/api/assets/:id/rebuild-derived', async (req, res) => {
    try {
      const response: RefreshOperationResponse = await rebuildDerivedFilesForAsset(req.params.id);
      res.json(response);
    } catch (error) {
      if (error instanceof RefreshServiceError) {
        res.status(error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_INPUT' ? 400 : 409).json({
          error: error.message
        });
        return;
      }

      log.error('Failed to rebuild asset derived files', error);
      res.status(500).json({ error: 'Failed to rebuild asset derived files' });
    }
  });

  app.post('/api/assets/:id/rotate-clockwise', async (req, res) => {
    try {
      const updatedAsset = await rotateAssetClockwise(req.params.id);
      res.json(updatedAsset);
    } catch (error) {
      if (error instanceof AssetRotationServiceError) {
        const status =
          error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'INVALID_INPUT'
              ? 400
              : 409;
        res.status(status).json({ error: error.message });
        return;
      }

      log.error('Failed to rotate asset clockwise', error);
      res.status(500).json({ error: 'Failed to rotate asset' });
    }
  });

  app.post('/api/assets/:id/rotate-counterclockwise', async (req, res) => {
    try {
      const updatedAsset = await rotateAssetCounterclockwise(req.params.id);
      res.json(updatedAsset);
    } catch (error) {
      if (error instanceof AssetRotationServiceError) {
        const status =
          error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'INVALID_INPUT'
              ? 400
              : 409;
        res.status(status).json({ error: error.message });
        return;
      }

      log.error('Failed to rotate asset counterclockwise', error);
      res.status(500).json({ error: 'Failed to rotate asset' });
    }
  });

  return app;
}
