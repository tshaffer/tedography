import cors from 'cors';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhotoState } from '@tedography/domain';
import { log } from './logger.js';
import { getAllAssets, updatePhotoState } from './repositories/assetRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockMediaDir = path.resolve(__dirname, '../mock-media');

function parsePhotoState(value: unknown): PhotoState | null {
  if (typeof value !== 'string') {
    return null;
  }

  const validStates = Object.values(PhotoState);
  if (!validStates.includes(value as PhotoState)) {
    return null;
  }

  return value as PhotoState;
}

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/media', express.static(mockMediaDir));

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
      res.status(400).json({ error: 'photoState must be one of Unreviewed, Pending, Select, Reject' });
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

  return app;
}
