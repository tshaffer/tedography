import {
  MediaType,
  PhotoState,
  normalizePhotoState,
  type MediaAssetPerson,
  type DisplayStorageType,
  type MediaAsset
} from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { summarizeFaceDetectionsByAssetIds } from './faceDetectionRepository.js';

export async function syncMediaAssetIndexes(): Promise<void> {
  await MediaAssetModel.syncIndexes();
  log.info('Synchronized mediaAssets indexes');
}

function normalizeMediaAsset(asset: MediaAsset): MediaAsset {
  return {
    ...asset,
    photoState: normalizePhotoState(asset.photoState) ?? PhotoState.New
  };
}

function normalizeMediaAssets(assets: MediaAsset[]): MediaAsset[] {
  return assets.map(normalizeMediaAsset);
}

export async function getAllAssets(): Promise<MediaAsset[]> {
  const assets = await MediaAssetModel.find({}, { _id: 0 }).sort({ id: 1 }).lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function getAllAssetsForLibrary(): Promise<MediaAsset[]> {
  const assets = await MediaAssetModel.find(
    {},
    {
      _id: 0,
      id: 1,
      filename: 1,
      mediaType: 1,
      photoState: 1,
      captureDateTime: 1,
      width: 1,
      height: 1,
      importedAt: 1,
      originalFileFormat: 1,
      displayFileFormat: 1,
      albumIds: 1,
      people: 1
    }
  )
    .sort({ id: 1 })
    .lean<MediaAsset[]>();
  const normalizedAssets = normalizeMediaAssets(assets);
  const summariesByAssetId = await summarizeFaceDetectionsByAssetIds(normalizedAssets.map((asset) => asset.id));

  return normalizedAssets.map((asset) => ({
    ...asset,
    detectionsCount: summariesByAssetId[asset.id]?.detectionsCount ?? 0,
    reviewableDetectionsCount: summariesByAssetId[asset.id]?.reviewableDetectionsCount ?? 0,
    confirmedDetectionsCount: summariesByAssetId[asset.id]?.confirmedDetectionsCount ?? 0
  }));
}

export async function findById(id: string): Promise<MediaAsset | null> {
  const asset = await MediaAssetModel.findOne({ id }, { _id: 0 }).lean<MediaAsset | null>();
  return asset ? normalizeMediaAsset(asset) : null;
}

export async function findByIds(ids: string[]): Promise<MediaAsset[]> {
  if (ids.length === 0) {
    return [];
  }

  const assets = await MediaAssetModel.find({ id: { $in: ids } }, { _id: 0 })
    .sort({ id: 1 })
    .lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function findByOriginalStorageRootAndArchivePaths(
  originalStorageRootId: string,
  originalArchivePaths: string[]
): Promise<MediaAsset[]> {
  if (originalArchivePaths.length === 0) {
    return [];
  }

  const assets = await MediaAssetModel.find(
    { originalStorageRootId, originalArchivePath: { $in: originalArchivePaths } },
    { _id: 0 }
  ).lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function findByOriginalStorageRootId(
  originalStorageRootId: string
): Promise<MediaAsset[]> {
  const assets = await MediaAssetModel.find(
    { originalStorageRootId },
    { _id: 0 }
  ).lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function findByOriginalContentHashes(
  originalContentHashes: string[]
): Promise<MediaAsset[]> {
  if (originalContentHashes.length === 0) {
    return [];
  }

  const assets = await MediaAssetModel.find(
    { originalContentHash: { $in: originalContentHashes } },
    { _id: 0 }
  ).lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function findPhotoAssets(): Promise<MediaAsset[]> {
  const assets = await MediaAssetModel.find({ mediaType: MediaType.Photo }, { _id: 0 })
    .sort({ id: 1 })
    .lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export async function findRecentPhotoAssets(limit = 20): Promise<MediaAsset[]> {
  const assets = await MediaAssetModel.find({ mediaType: MediaType.Photo }, { _id: 0 })
    .sort({ importedAt: -1, captureDateTime: -1, id: -1 })
    .limit(limit)
    .lean<MediaAsset[]>();
  return normalizeMediaAssets(assets);
}

export interface CreateMediaAssetInput {
  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime: Date | null;
  width: number | null;
  height: number | null;
  locationLabel: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
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
  albumIds?: string[];
}

export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
  const id = randomUUID();

  const createPayload: Record<
    string,
    string | number | null | string[] | MediaAssetPerson[] | MediaType | PhotoState
  > = {
    id,
    filename: input.filename,
    mediaType: input.mediaType,
    photoState: input.photoState,
    captureDateTime: input.captureDateTime?.toISOString() ?? null,
    width: input.width,
    height: input.height,
    locationLabel: input.locationLabel,
    locationLatitude: input.locationLatitude,
    locationLongitude: input.locationLongitude,
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
    albumIds: input.albumIds ?? [],
    people: []
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

  return normalizeMediaAsset(createdAsset);
}

export async function updatePhotoState(id: string, photoState: PhotoState): Promise<MediaAsset | null> {
  const asset = await MediaAssetModel.findOneAndUpdate(
    { id },
    { $set: { photoState } },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();
  return asset ? normalizeMediaAsset(asset) : null;
}

export async function updateThumbnailReferenceFields(input: {
  id: string;
  thumbnailStorageType: 'derived-root';
  thumbnailDerivedPath: string;
  thumbnailFileFormat: string;
}): Promise<MediaAsset | null> {
  const asset = await MediaAssetModel.findOneAndUpdate(
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
  return asset ? normalizeMediaAsset(asset) : null;
}

export interface UpdateMediaAssetSourceDataInput {
  id: string;
  filename: string;
  mediaType: MediaType;
  captureDateTime: Date | null;
  width: number | null;
  height: number | null;
  locationLabel: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
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

export async function updateMediaAssetSourceData(
  input: UpdateMediaAssetSourceDataInput
): Promise<MediaAsset | null> {
  const updatePayload: Record<string, string | number | null | MediaType> = {
    filename: input.filename,
    mediaType: input.mediaType,
    captureDateTime: input.captureDateTime?.toISOString() ?? null,
    width: input.width,
    height: input.height,
    locationLabel: input.locationLabel,
    locationLatitude: input.locationLatitude,
    locationLongitude: input.locationLongitude,
    originalFileSizeBytes: input.originalFileSizeBytes,
    originalContentHash: input.originalContentHash,
    originalFileFormat: input.originalFileFormat,
    displayStorageType: input.displayStorageType,
    displayStorageRootId: input.displayStorageRootId,
    displayArchivePath: input.displayArchivePath,
    displayDerivedPath: input.displayDerivedPath,
    displayFileFormat: input.displayFileFormat,
    thumbnailStorageType: input.thumbnailStorageType,
    thumbnailDerivedPath: input.thumbnailDerivedPath,
    thumbnailFileFormat: input.thumbnailFileFormat,
    thumbnailUrl: input.thumbnailUrl
  };

  const asset = await MediaAssetModel.findOneAndUpdate(
    { id: input.id },
    { $set: updatePayload },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();
  return asset ? normalizeMediaAsset(asset) : null;
}

export async function updateMediaAssetOriginalArchivePath(input: {
  id: string;
  originalArchivePath: string;
  displayArchivePath?: string | null;
}): Promise<MediaAsset | null> {
  const updatePayload: Record<string, string | null> = {
    originalArchivePath: input.originalArchivePath
  };

  if (input.displayArchivePath !== undefined) {
    updatePayload.displayArchivePath = input.displayArchivePath;
  }

  const asset = await MediaAssetModel.findOneAndUpdate(
    { id: input.id },
    { $set: updatePayload },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();

  return asset ? normalizeMediaAsset(asset) : null;
}

export async function updateMediaAssetAlbumIds(
  id: string,
  albumIds: string[]
): Promise<MediaAsset | null> {
  const normalizedAlbumIds = [...new Set(albumIds.map((albumId) => albumId.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );

  const asset = await MediaAssetModel.findOneAndUpdate(
    { id },
    { $set: { albumIds: normalizedAlbumIds } },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();

  return asset ? normalizeMediaAsset(asset) : null;
}

export async function addAssetToAlbum(assetId: string, albumId: string): Promise<void> {
  await MediaAssetModel.updateOne(
    { id: assetId },
    { $addToSet: { albumIds: albumId } },
    { runValidators: true }
  );
}

export async function removeAssetFromAlbum(assetId: string, albumId: string): Promise<void> {
  await MediaAssetModel.updateOne(
    { id: assetId },
    { $pull: { albumIds: albumId } },
    { runValidators: true }
  );
}

export async function updateMediaAssetPeople(
  id: string,
  people: MediaAssetPerson[]
): Promise<MediaAsset | null> {
  const normalizedPeople = [...people]
    .sort((left, right) =>
      left.displayName === right.displayName
        ? left.personId.localeCompare(right.personId)
        : left.displayName.localeCompare(right.displayName)
    )
    .map((person) => ({
      personId: person.personId,
      displayName: person.displayName,
      source: person.source,
      confirmedAt: person.confirmedAt ?? null
    }));

  const asset = await MediaAssetModel.findOneAndUpdate(
    { id },
    { $set: { people: normalizedPeople } },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<MediaAsset | null>();

  return asset ? normalizeMediaAsset(asset) : null;
}

export async function addAssetsToAlbum(assetIds: string[], albumId: string): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }

  await MediaAssetModel.updateMany(
    { id: { $in: assetIds } },
    { $addToSet: { albumIds: albumId } },
    { runValidators: true }
  );
}

export async function removeAssetsFromAlbum(assetIds: string[], albumId: string): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }

  await MediaAssetModel.updateMany(
    { id: { $in: assetIds } },
    { $pull: { albumIds: albumId } },
    { runValidators: true }
  );
}

export async function removeAlbumIdFromAllAssets(albumId: string): Promise<void> {
  await MediaAssetModel.updateMany(
    { albumIds: albumId },
    { $pull: { albumIds: albumId } },
    { runValidators: true }
  );
}
