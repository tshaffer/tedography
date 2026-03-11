import {
  MediaType,
  PhotoState,
  type DisplayStorageType,
  type MediaAsset
} from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
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

export async function findById(id: string): Promise<MediaAsset | null> {
  return MediaAssetModel.findOne({ id }, { _id: 0 }).lean<MediaAsset | null>();
}

export async function findByOriginalStorageRootAndArchivePaths(
  originalStorageRootId: string,
  originalArchivePaths: string[]
): Promise<MediaAsset[]> {
  if (originalArchivePaths.length === 0) {
    return [];
  }

  return MediaAssetModel.find(
    { originalStorageRootId, originalArchivePath: { $in: originalArchivePaths } },
    { _id: 0 }
  ).lean<MediaAsset[]>();
}

export async function findByOriginalContentHashes(
  originalContentHashes: string[]
): Promise<MediaAsset[]> {
  if (originalContentHashes.length === 0) {
    return [];
  }

  return MediaAssetModel.find(
    { originalContentHash: { $in: originalContentHashes } },
    { _id: 0 }
  ).lean<MediaAsset[]>();
}

export interface CreateMediaAssetInput {
  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime: Date | null;
  width: number | null;
  height: number | null;
  importedAt: Date;
  originalStorageRootId: string;
  originalArchivePath: string;
  originalFileSizeBytes: number;
  originalContentHash: string;
  originalFileFormat: string;
  displayStorageType: DisplayStorageType;
  displayStorageRootId: string | null;
  displayArchivePath: string | null;
  displayDerivedPath: string | null;
  displayFileFormat: string;
  thumbnailUrl: string | null;
}

export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
  const id = randomUUID();
  const thumbnailUrl = input.thumbnailUrl ?? `/api/media/display/${encodeURIComponent(id)}`;

  await MediaAssetModel.create({
    id,
    filename: input.filename,
    mediaType: input.mediaType,
    photoState: input.photoState,
    captureDateTime: input.captureDateTime?.toISOString() ?? null,
    width: input.width,
    height: input.height,
    importedAt: input.importedAt.toISOString(),
    originalStorageRootId: input.originalStorageRootId,
    originalArchivePath: input.originalArchivePath,
    originalFileSizeBytes: input.originalFileSizeBytes,
    originalContentHash: input.originalContentHash,
    originalFileFormat: input.originalFileFormat,
    displayStorageType: input.displayStorageType,
    displayStorageRootId: input.displayStorageRootId,
    displayArchivePath: input.displayArchivePath,
    displayDerivedPath: input.displayDerivedPath,
    displayFileFormat: input.displayFileFormat,
    thumbnailUrl
  });

  const createdAsset = await MediaAssetModel.findOne({ id }, { _id: 0 }).lean<MediaAsset | null>();
  if (!createdAsset) {
    throw new Error(`Failed to load newly created MediaAsset: ${id}`);
  }

  return createdAsset;
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

function toFileFormatFromFilename(filename: string): string {
  const extension = path.extname(filename).toLowerCase().replace('.', '');
  return extension.length > 0 ? extension : 'unknown';
}

export async function upsertImportedAsset(asset: ImportAssetInput): Promise<ImportUpsertOutcome> {
  const fileFormat = toFileFormatFromFilename(asset.filename);

  const setFields: Record<string, string | number | null> = {
    filename: asset.filename,
    captureDateTime: asset.captureDateTime,
    thumbnailUrl: asset.thumbnailUrl,
    importedAt: new Date().toISOString(),
    originalStorageRootId: 'local-import',
    originalArchivePath: asset.id,
    originalFileSizeBytes: 0,
    originalContentHash: asset.id,
    originalFileFormat: fileFormat,
    displayStorageType: 'archive-root',
    displayStorageRootId: 'local-import',
    displayArchivePath: asset.id,
    displayDerivedPath: null,
    displayFileFormat: fileFormat
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
