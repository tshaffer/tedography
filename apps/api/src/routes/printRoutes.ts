import path from 'node:path';
import { Router, type Router as RouterType } from 'express';
import type { PrintJobRequest } from '@tedography/domain';
import { config } from '../config.js';
import { log } from '../logger.js';
import { findByIds } from '../repositories/assetRepository.js';
import { buildResolvedItem } from '../print/printJobService.js';
import { getProviderById, getProviders } from '../print/printProviderRegistry.js';
import { requireFeature } from '../middleware/requireFeature.js';

export const printRoutes: RouterType = Router();

printRoutes.get('/providers', (_req, res) => {
  const providers = getProviders().map((p) => p.info);
  res.json({ providers });
});

printRoutes.post('/jobs', requireFeature('print', (req) => {
  const items = (req.body as { items?: unknown }).items;
  return Array.isArray(items) ? items.map((i) => String((i as { assetId?: unknown }).assetId ?? '')).filter(Boolean) : [];
}), async (req, res) => {
  const body = req.body as Partial<PrintJobRequest>;

  if (!body.providerId) {
    res.status(400).json({ error: 'providerId is required' });
    return;
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'items must be a non-empty array' });
    return;
  }

  const provider = getProviderById(body.providerId);
  if (!provider) {
    res.status(404).json({ error: `Unknown provider: ${body.providerId}` });
    return;
  }

  const root = config.printOrdersRoot;
  if (!root) {
    res.status(400).json({ error: 'TEDOGRAPHY_PRINT_ORDERS_ROOT is not configured in .env' });
    return;
  }

  try {
    const assetIds = body.items.map((i) => i.assetId);
    const assets = await findByIds(assetIds);
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    const resolvedItems = [];
    for (const item of body.items) {
      const asset = assetMap.get(item.assetId);
      if (!asset) {
        res.status(404).json({ error: `Asset not found: ${item.assetId}` });
        return;
      }
      resolvedItems.push(buildResolvedItem(item, asset));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = path.join(root, `${provider.info.folderPrefix}_${timestamp}`);

    const result = await provider.exportPackage(resolvedItems, outputDir);
    res.json(result);
  } catch (error) {
    log.error('Print job failed', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Print job failed: ${message}` });
  }
});
