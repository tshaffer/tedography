import { mockAssets } from './data/mockAssets.js';
import { MediaAssetModel } from './models/mediaAssetModel.js';

export async function seedMediaAssetsIfEmpty(): Promise<void> {
  const count = await MediaAssetModel.countDocuments();
  if (count > 0) {
    return;
  }

  await MediaAssetModel.insertMany(mockAssets);
  console.log(`[src] Seeded ${mockAssets.length} mediaAssets records`);
}
