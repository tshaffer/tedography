import { Router, type Router as RouterType } from 'express';
import { findByIds } from '../repositories/assetRepository.js';
import { detectLabelsForAssets } from '../import/labelDetectionService.js';
import { log } from '../logger.js';

export const labelDetectionRoutes: RouterType = Router();

labelDetectionRoutes.post('/', async (req, res) => {
  const { assetIds, minConfidence } = req.body as { assetIds?: string[]; minConfidence?: number };

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    res.status(400).json({ error: 'assetIds must be a non-empty array' });
    return;
  }

  try {
    const assets = await findByIds(assetIds);
    if (assets.length === 0) {
      res.status(404).json({ error: 'No matching assets found' });
      return;
    }

    const { report, outputPath } = await detectLabelsForAssets(
      assets,
      typeof minConfidence === 'number' ? minConfidence : 70
    );

    res.json({
      outputPath,
      assetCount: report.assetCount,
      labelledCount: report.files.filter((f) => f.labels.length > 0).length,
      errorCount: report.files.filter((f) => f.error !== null).length,
    });
  } catch (error) {
    log.error('Label detection failed', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Label detection failed' });
  }
});
