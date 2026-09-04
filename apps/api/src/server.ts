import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import express, { type Express } from 'express';
import { PhotoState, normalizePhotoState } from '@tedography/domain';
import type { RefreshOperationResponse } from '@tedography/domain';
import { config } from './config.js';
import { log } from './logger.js';
import {
  rotateAssetClockwise,
  rotateAssetCounterclockwise,
  rotateAsset180,
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
  bulkUpdatePhotoState,
  updateCaptureDateTimeMarkedWrong,
  updateCaptureDateTimes,
  updatePhotoState,
  updateRating
} from './repositories/assetRepository.js';
import { listAssetIdsWithReviewableDetections } from './repositories/faceDetectionRepository.js';
import { editHistoryRoutes } from './routes/editHistoryRoutes.js';
import { editQueueRoutes } from './routes/editQueueRoutes.js';
import { nlSearchRoutes } from './routes/nlSearchRoutes.js';
import { helpRoutes } from './routes/helpRoutes.js';
import { googlePhotosRoutes } from './routes/googlePhotosRoutes.js';
import { printRoutes } from './routes/printRoutes.js';
import { albumMembershipRoutes, albumTreeRoutes } from './routes/albumTreeRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { assetKeywordRoutes, keywordRoutes } from './routes/keywordRoutes.js';
import { mediaRoutes } from './routes/mediaRoutes.js';
import { peoplePipelineRoutes } from './routes/peoplePipelineRoutes.js';
import { smartAlbumRoutes } from './routes/smartAlbumRoutes.js';
import { resolveOriginalAbsolutePathForAsset } from './media/resolveAssetMediaPath.js';
import { authRoutes } from './routes/authRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireFeature } from './middleware/requireFeature.js';

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

  app.use(cors({ credentials: true, origin: true }));
  app.use(express.json());

  // Session middleware — must come before auth routes and requireAuth
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,  // home network only; set true if TLS is added
        maxAge: undefined, // indefinite (browser-session lifetime)
        sameSite: 'lax',
      },
      store: MongoStore.create({
        mongoUrl: config.mongoUri,
        collectionName: 'sessions',
        // ttl omitted → connect-mongo default of 14 days; long enough for home use
      }),
    })
  );

  // Auth routes are public (no requireAuth)
  app.use('/api/auth', authRoutes);

  // All other /api routes require authentication
  app.use('/api', requireAuth);

  app.use('/api/import', importRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/album-tree', albumTreeRoutes);
  app.use('/api/albums', albumMembershipRoutes);
  app.use('/api/keywords', keywordRoutes);
  app.use('/api/smart-albums', smartAlbumRoutes);
  app.use('/api/assets', assetKeywordRoutes);
  app.use('/api/people-pipeline', peoplePipelineRoutes);
  app.use('/api/edit-queue', editQueueRoutes);
  app.use('/api/edit-history', editHistoryRoutes);
  app.use('/api/search', nlSearchRoutes);
  app.use('/api/help', helpRoutes);
  app.use('/api/google-photos', googlePhotosRoutes);
  app.use('/api/print', printRoutes);

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

  app.get('/api/assets/reviewable-detections', async (_req, res) => {
    try {
      const assetIds = await listAssetIdsWithReviewableDetections();
      res.json({ assetIds });
    } catch (error) {
      log.error('Failed to list assets with reviewable detections', error);
      res.status(500).json({ error: 'Failed to list assets with reviewable detections' });
    }
  });

  app.get('/api/assets/:id', async (req, res) => {
    try {
      const asset = await findById(req.params.id as string);
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

  app.patch('/api/assets/photoState/bulk', requireFeature('set-photo-state', (req) => {
    const body = req.body as { assetIds?: unknown };
    return Array.isArray(body.assetIds) ? (body.assetIds as string[]) : [];
  }), async (req, res) => {
    const body = req.body as { assetIds?: unknown; photoState?: unknown };
    const photoState = parsePhotoState(body.photoState);
    if (!photoState) {
      res.status(400).json({ error: 'photoState must be one of New, Pending, Keep, Discard' });
      return;
    }
    if (!Array.isArray(body.assetIds) || body.assetIds.length === 0) {
      res.status(400).json({ error: 'assetIds must be a non-empty array' });
      return;
    }

    try {
      const updatedAssets = await bulkUpdatePhotoState(body.assetIds as string[], photoState);
      res.json(updatedAssets);
    } catch (error) {
      log.error('Failed to bulk update asset photoState', error);
      res.status(500).json({ error: 'Failed to update assets' });
    }
  });

  app.patch('/api/assets/:id/photoState', requireFeature('set-photo-state', (req) => [req.params.id as string]), async (req, res) => {
    const photoState = parsePhotoState((req.body as { photoState?: unknown }).photoState);
    if (!photoState) {
      res.status(400).json({ error: 'photoState must be one of New, Pending, Keep, Discard' });
      return;
    }

    try {
      const updatedAsset = await updatePhotoState(req.params.id as string, photoState);

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

  app.patch('/api/assets/:id/rating', requireFeature('set-photo-state', (req) => [req.params.id as string]), async (req, res) => {
    const { rating } = req.body as { rating?: unknown };
    if (rating !== null && (typeof rating !== 'number' || rating < 0 || rating > 5 || !Number.isInteger(rating))) {
      res.status(400).json({ error: 'rating must be an integer 0-5, or null' });
      return;
    }

    try {
      const updatedAsset = await updateRating(req.params.id as string, rating);

      if (!updatedAsset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }

      res.json(updatedAsset);
    } catch (error) {
      log.error('Failed to update asset rating', error);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  app.patch('/api/assets/capture-date', requireFeature('set-photo-state', (req) => {
    const body = req.body as { assetIds?: unknown };
    return Array.isArray(body.assetIds)
      ? body.assetIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
  }), async (req, res) => {
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

  app.patch('/api/assets/capture-date-marked-wrong', requireFeature('set-photo-state', (req) => {
    const body = req.body as { assetIds?: unknown };
    return Array.isArray(body.assetIds)
      ? body.assetIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
  }), async (req, res) => {
    const payload = req.body as { assetIds?: unknown; markedWrong?: unknown };
    const assetIds = Array.isArray(payload.assetIds)
      ? payload.assetIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (assetIds.length === 0) {
      res.status(400).json({ error: 'assetIds must contain at least one asset id' });
      return;
    }

    if (typeof payload.markedWrong !== 'boolean') {
      res.status(400).json({ error: 'markedWrong is required' });
      return;
    }

    try {
      const updatedAssets = await updateCaptureDateTimeMarkedWrong(assetIds, payload.markedWrong);
      res.json(updatedAssets);
    } catch (error) {
      log.error('Failed to update captureDateTimeMarkedWrong', error);
      res.status(500).json({ error: 'Failed to update capture date marked-wrong flag' });
    }
  });

  app.post('/api/assets/:id/reimport', requireFeature('maintenance'), async (req, res) => {
    try {
      const response: RefreshOperationResponse = await reimportAssetById(req.params.id as string);
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

  app.post('/api/assets/:id/rebuild-derived', requireFeature('maintenance'), async (req, res) => {
    try {
      const response: RefreshOperationResponse = await rebuildDerivedFilesForAsset(req.params.id as string);
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

  app.post('/api/assets/:id/rotate-clockwise', requireFeature('rotate-and-crop', (req) => [req.params.id as string]), async (req, res) => {
    try {
      const updatedAsset = await rotateAssetClockwise(req.params.id as string);
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

  app.post('/api/assets/:id/rotate-counterclockwise', requireFeature('rotate-and-crop', (req) => [req.params.id as string]), async (req, res) => {
    try {
      const updatedAsset = await rotateAssetCounterclockwise(req.params.id as string);
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

  app.post('/api/assets/:id/rotate-180', requireFeature('rotate-and-crop', (req) => [req.params.id as string]), async (req, res) => {
    try {
      const updatedAsset = await rotateAsset180(req.params.id as string);
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

      log.error('Failed to rotate asset 180 degrees', error);
      res.status(500).json({ error: 'Failed to rotate asset' });
    }
  });

  const PREVIEW_APPLESCRIPT = `
on run argv
  set p to POSIX file (item 1 of argv)
  tell application "Preview"
    activate
    open p
  end tell
  delay 0.3
  tell application "System Events"
    tell process "Preview"
      try
        tell menu bar 1 to tell menu bar item "View" to tell menu 1
          if exists menu item "Show Markup Toolbar" then click menu item "Show Markup Toolbar"
        end tell
      end try
      try
        tell menu bar 1 to tell menu bar item "Tools" to tell menu 1
          if exists menu item "Rectangular Selection" then click menu item "Rectangular Selection"
        end tell
      end try
      keystroke "a" using {command down}
    end tell
  end tell
end run
`;

  app.post('/api/assets/:id/open-in-preview', requireFeature('rotate-and-crop'), async (req, res) => {
    try {
      const asset = await findById(req.params.id as string);
      if (!asset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }

      const filePath = resolveOriginalAbsolutePathForAsset(asset);
      const child = spawn('osascript', ['-e', PREVIEW_APPLESCRIPT, filePath], {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();

      res.json({ ok: true });
    } catch (error) {
      log.error('Failed to open asset in Preview', error);
      res.status(500).json({ error: 'Failed to open asset in Preview' });
    }
  });

  app.get('/api/assets/:id/file-stat', async (req, res) => {
    try {
      const asset = await findById(req.params.id as string);
      if (!asset) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }

      const filePath = resolveOriginalAbsolutePathForAsset(asset);
      const stat = await fs.stat(filePath);
      res.json({ mtimeMs: stat.mtimeMs });
    } catch (error) {
      log.error('Failed to stat asset file', error);
      res.status(500).json({ error: 'Failed to stat asset file' });
    }
  });

  return app;
}
