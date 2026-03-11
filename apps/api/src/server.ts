import cors from 'cors';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhotoState } from '@tedography/domain';
import { config } from './config.js';
import { importFromLocalFolder, listImportableFiles } from './import/importFromLocalFolder.js';
import { log } from './logger.js';
import { getAllAssets, updatePhotoState } from './repositories/assetRepository.js';
import { importRoutes } from './routes/importRoutes.js';

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
  app.use('/api/import', importRoutes);
  app.use('/media', express.static(mockMediaDir));
  if (config.importRoot) {
    app.use('/import-media', express.static(config.importRoot));
  }

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

  app.get('/api/import/local/files', async (_req, res) => {
    if (!config.importRoot) {
      res.status(400).json({
        error: 'TEDOGRAPHY_IMPORT_ROOT is required to list local import files'
      });
      return;
    }

    try {
      const files = await listImportableFiles(config.importRoot);
      res.json({ files });
    } catch (error) {
      log.error('Failed to list local import files', error);
      res.status(500).json({ error: 'Failed to list local import files' });
    }
  });

  app.get('/api/import/local/info', (_req, res) => {
    if (!config.importRoot) {
      res.status(400).json({
        error: 'TEDOGRAPHY_IMPORT_ROOT is required to provide local import info'
      });
      return;
    }

    res.json({ importRoot: config.importRoot });
  });

  app.post('/api/import/local', async (req, res) => {
    if (!config.importRoot) {
      res.status(400).json({
        error: 'TEDOGRAPHY_IMPORT_ROOT is required to run local import'
      });
      return;
    }

    const selectedRelativePathsValue = (req.body as { selectedRelativePaths?: unknown }).selectedRelativePaths;
    if (
      selectedRelativePathsValue !== undefined &&
      (!Array.isArray(selectedRelativePathsValue) ||
        selectedRelativePathsValue.some((value) => typeof value !== 'string'))
    ) {
      res.status(400).json({ error: 'selectedRelativePaths must be an array of strings' });
      return;
    }

    try {
      const summary = await importFromLocalFolder(
        config.importRoot,
        selectedRelativePathsValue as string[] | undefined
      );
      res.json(summary);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid selected path')) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.message.startsWith('Selected file not found')) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof Error && error.message.startsWith('Unsupported file type')) {
        res.status(400).json({ error: error.message });
        return;
      }

      log.error('Failed to import from local folder', error);
      res.status(500).json({ error: 'Failed to import local folder' });
    }
  });

  return app;
}
