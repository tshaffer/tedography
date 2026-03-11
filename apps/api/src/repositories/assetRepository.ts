import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import { mockAssets } from '../data/mockAssets.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

export async function syncMediaAssetIndexes(): Promise<void> {
  await MediaAssetModel.syncIndexes();
  log.info('Synchronized mediaAssets indexes');
}

export async function seedMediaAssetsIfEmpty(): Promise<void> {
  let insertedCount = 0;

  for (const asset of mockAssets) {
    const result = await MediaAssetModel.updateOne(
      { id: asset.id },
      { $setOnInsert: asset },
      { upsert: true, runValidators: true }
    );

    insertedCount += result.upsertedCount;
  }

  if (insertedCount > 0) {
    log.info(`Seeded ${insertedCount} mediaAssets records`);
    return;
  }

  log.info('Seed check complete; no mediaAssets inserts required');
}

export async function getAllAssets(): Promise<MediaAsset[]> {
  return MediaAssetModel.find({}, { _id: 0 }).sort({ id: 1 }).lean<MediaAsset[]>();
}

export async function updatePhotoState(id: string, photoState: PhotoState): Promise<MediaAsset | null> {
  return MediaAssetModel.findOneAndUpdate(
    { id },
    { $set: { photoState } },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();
}

export type ImportUpsertOutcome = 'inserted' | 'updated' | 'unchanged';

export type ImportAssetInput = {
  id: string;
  filename: string;
  captureDateTime: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
};

export async function upsertImportedAsset(asset: ImportAssetInput): Promise<ImportUpsertOutcome> {
  const setFields: Record<string, string | number> = {
    filename: asset.filename,
    captureDateTime: asset.captureDateTime,
    thumbnailUrl: asset.thumbnailUrl
  };

  if (typeof asset.width === 'number') {
    setFields.width = asset.width;
  }

  if (typeof asset.height === 'number') {
    setFields.height = asset.height;
  }

  const result = await MediaAssetModel.updateOne(
    { id: asset.id },
    {
      $setOnInsert: {
        id: asset.id,
        mediaType: MediaType.Photo,
        photoState: PhotoState.Unreviewed
      },
      $set: setFields
    },
    { upsert: true, runValidators: true }
  );

  if (result.upsertedCount > 0) {
    return 'inserted';
  }

  if (result.modifiedCount > 0) {
    return 'updated';
  }

  return 'unchanged';
}
