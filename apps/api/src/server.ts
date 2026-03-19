import cors from 'cors';
import express, { type Express } from 'express';
import { PhotoState, normalizePhotoState } from '@tedography/domain';
import type { RefreshOperationResponse } from '@tedography/domain';
import { log } from './logger.js';
import {
  rebuildDerivedFilesForAsset,
  RefreshServiceError,
  reimportAssetById
} from './import/refreshService.js';
import { getAllAssets, updatePhotoState } from './repositories/assetRepository.js';
import { albumMembershipRoutes, albumTreeRoutes } from './routes/albumTreeRoutes.js';
import { duplicateActionExecutionRoutes } from './routes/duplicateActionExecutionRoutes.js';
import { duplicateActionPlanRoutes } from './routes/duplicateActionPlanRoutes.js';
import { duplicateCandidatePairRoutes } from './routes/duplicateCandidatePairRoutes.js';
import { duplicateReconciliationRoutes } from './routes/duplicateReconciliationRoutes.js';
import { importRoutes } from './routes/importRoutes.js';
import { mediaRoutes } from './routes/mediaRoutes.js';

function parsePhotoState(value: unknown): PhotoState | null {
  return normalizePhotoState(value);
}

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/api/import', importRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/album-tree', albumTreeRoutes);
  app.use('/api/albums', albumMembershipRoutes);
  app.use('/api/duplicate-candidate-pairs', duplicateCandidatePairRoutes);
  app.use('/api/duplicate-action-plans', duplicateActionPlanRoutes);
  app.use('/api/duplicate-action-executions', duplicateActionExecutionRoutes);
  app.use('/api/duplicate-reconciliations', duplicateReconciliationRoutes);

  app.get('/api/health', (_req, res) => {
    // Keep both fields for backward compatibility across frontend iterations.
    log.info('Health check received');
    res.json({ ok: true, status: 'ok', service: 'tedography-api' });
  });

  app.get('/api/assets', async (_req, res) => {
    try {
      const assets = await getAllAssets();
      res.json(assets);
    } catch (error) {
      log.error('Failed to read assets', error);
      res.status(500).json({ error: 'Failed to load assets' });
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

  return app;
}
