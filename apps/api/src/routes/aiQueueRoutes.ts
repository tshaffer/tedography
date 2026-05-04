import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Router as RouterType } from 'express';
import { config } from '../config.js';
import { log } from '../logger.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { findById } from '../repositories/assetRepository.js';
import {
  clearQueue,
  getQueueEntries,
  removeQueueEntry,
  upsertQueueEntry,
} from '../repositories/aiQueueRepository.js';

export const aiQueueRoutes: RouterType = Router();

aiQueueRoutes.get('/', async (_req, res) => {
  try {
    const entries = await getQueueEntries();
    res.json(entries);
  } catch (error) {
    log.error('Failed to get AI queue', error);
    res.status(500).json({ error: 'Failed to get AI queue' });
  }
});

aiQueueRoutes.post('/', async (req, res) => {
  const { assetId, prompt } = req.body as { assetId?: string; prompt?: string };
  if (!assetId) {
    res.status(400).json({ error: 'assetId is required' });
    return;
  }
  try {
    const entry = await upsertQueueEntry(assetId, prompt ?? '');
    res.json(entry);
  } catch (error) {
    log.error('Failed to add to AI queue', error);
    res.status(500).json({ error: 'Failed to add to AI queue' });
  }
});

aiQueueRoutes.delete('/', async (_req, res) => {
  try {
    await clearQueue();
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to clear AI queue', error);
    res.status(500).json({ error: 'Failed to clear AI queue' });
  }
});

aiQueueRoutes.delete('/:assetId', async (req, res) => {
  try {
    await removeQueueEntry(req.params.assetId);
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to remove from AI queue', error);
    res.status(500).json({ error: 'Failed to remove from AI queue' });
  }
});

aiQueueRoutes.post('/export', async (_req, res) => {
  const exportPath = config.aiQueueExportPath;
  if (!exportPath) {
    res.status(400).json({ error: 'TEDOGRAPHY_AI_QUEUE_EXPORT_PATH is not configured in .env' });
    return;
  }
  try {
    await fs.mkdir(exportPath, { recursive: true });
    const entries = await getQueueEntries();
    const lines: string[] = [];
    for (const entry of entries) {
      const asset = await findById(entry.assetId);
      if (!asset) continue;
      try {
        const srcPath = resolveOriginalAbsolutePathForAsset(asset);
        const destPath = path.join(exportPath, asset.filename);
        await fs.copyFile(srcPath, destPath);
        lines.push(`${asset.filename}: ${entry.prompt || '(no prompt)'}`);
      } catch (err) {
        log.error(`Failed to copy asset ${entry.assetId}`, err);
        lines.push(`${asset.filename ?? entry.assetId}: ERROR - could not copy file`);
      }
    }
    await fs.writeFile(path.join(exportPath, 'prompts.txt'), lines.join('\n') + '\n', 'utf-8');
    res.json({ exportPath, count: entries.length });
  } catch (error) {
    log.error('Failed to export AI queue', error);
    res.status(500).json({ error: 'Failed to export AI queue' });
  }
});
