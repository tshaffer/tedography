import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const displayStorageTypes = ['archive-root', 'derived-root'] as const;
const thumbnailStorageTypes = ['derived-root'] as const;

const mediaAssetSchema = new Schema<MediaAsset>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    filename: { type: String, required: true, trim: true },
    mediaType: { type: String, required: true, enum: Object.values(MediaType) },
    photoState: { type: String, required: true, enum: Object.values(PhotoState) },
    captureDateTime: { type: String, required: false, trim: true },
    width: { type: Number, required: false },
    height: { type: Number, required: false },
    locationLabel: { type: String, required: false, trim: true },
    locationLatitude: { type: Number, required: false },
    locationLongitude: { type: Number, required: false },
    importedAt: { type: String, required: true, trim: true },
    originalStorageRootId: { type: String, required: true, trim: true },
    originalArchivePath: { type: String, required: true, trim: true },
    originalFileSizeBytes: { type: Number, required: true },
    originalContentHash: { type: String, required: true, trim: true },
    originalFileFormat: { type: String, required: true, trim: true },
    displayStorageType: {
      type: String,
      required: true,
      enum: displayStorageTypes
    },
    displayStorageRootId: { type: String, required: false, trim: true },
    displayArchivePath: { type: String, required: false, trim: true },
    displayDerivedPath: { type: String, required: false, trim: true },
    displayFileFormat: { type: String, required: true, trim: true },
    thumbnailStorageType: {
      type: String,
      required: false,
      enum: thumbnailStorageTypes
    },
    thumbnailDerivedPath: { type: String, required: false, trim: true },
    thumbnailFileFormat: { type: String, required: false, trim: true },
    thumbnailUrl: { type: String, required: false, trim: true },
    albumIds: {
      type: [String],
      required: true,
      default: []
    },
    people: {
      type: [
        new Schema(
          {
            personId: { type: String, required: true, trim: true },
            displayName: { type: String, required: true, trim: true },
            source: {
              type: String,
              required: true,
              enum: ['confirmed-face-detection', 'imported-shafferography', 'manual-asset-tag']
            },
            confirmedAt: { type: String, required: false, trim: true }
          },
          { _id: false }
        )
      ],
      required: true,
      default: []
    }
  },
  {
    collection: 'mediaAssets',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

mediaAssetSchema.index({ originalStorageRootId: 1, originalArchivePath: 1 }, { unique: true });
mediaAssetSchema.index({ originalContentHash: 1 });

export const MediaAssetModel: Model<MediaAsset> =
  (mongoose.models.MediaAsset as Model<MediaAsset> | undefined) ??
  mongoose.model<MediaAsset>('MediaAsset', mediaAssetSchema);
