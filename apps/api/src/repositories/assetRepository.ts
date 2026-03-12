import {
  MediaType,
  PhotoState,
  type DisplayStorageType,
  type MediaAsset
} from '@tedography/domain';
import { randomUUID } from 'node:crypto';
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

export async function findPhotoAssets(): Promise<MediaAsset[]> {
  return MediaAssetModel.find({ mediaType: MediaType.Photo }, { _id: 0 })
    .sort({ id: 1 })
    .lean<MediaAsset[]>();
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
  thumbnailStorageType: 'derived-root' | null;
  thumbnailDerivedPath: string | null;
  thumbnailFileFormat: string | null;
  thumbnailUrl: string | null;
}

export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
  const id = randomUUID();

  const createPayload: Record<string, string | number | null | MediaType | PhotoState> = {
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
    displayFileFormat: input.displayFileFormat
  };

  if (input.thumbnailStorageType) {
    createPayload.thumbnailStorageType = input.thumbnailStorageType;
  }

  if (input.thumbnailDerivedPath) {
    createPayload.thumbnailDerivedPath = input.thumbnailDerivedPath;
  }

  if (input.thumbnailFileFormat) {
    createPayload.thumbnailFileFormat = input.thumbnailFileFormat;
  }

  if (input.thumbnailUrl) {
    createPayload.thumbnailUrl = input.thumbnailUrl;
  }

  await MediaAssetModel.create(createPayload);

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

export async function updateThumbnailReferenceFields(input: {
  id: string;
  thumbnailStorageType: 'derived-root';
  thumbnailDerivedPath: string;
  thumbnailFileFormat: string;
}): Promise<MediaAsset | null> {
  return MediaAssetModel.findOneAndUpdate(
    { id: input.id },
    {
      $set: {
        thumbnailStorageType: input.thumbnailStorageType,
        thumbnailDerivedPath: input.thumbnailDerivedPath,
        thumbnailFileFormat: input.thumbnailFileFormat
      }
    },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();
}
