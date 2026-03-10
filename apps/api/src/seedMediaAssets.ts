import { mockAssets } from './data/mockAssets.js';
import { log } from './logger.js';
import { MediaAssetModel } from './models/mediaAssetModel.js';

export async function seedMediaAssetsIfEmpty(): Promise<void> {
  const count = await MediaAssetModel.countDocuments();
  if (count > 0) {
    return;
  }

  await MediaAssetModel.insertMany(mockAssets);
  log.info(`Seeded ${mockAssets.length} mediaAssets records`);
}
