import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const displayStorageTypes = ['archive-root', 'derived-root'] as const;

const mediaAssetSchema = new Schema<MediaAsset>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    filename: { type: String, required: true, trim: true },
    mediaType: { type: String, required: true, enum: Object.values(MediaType) },
    photoState: { type: String, required: true, enum: Object.values(PhotoState) },
    captureDateTime: { type: String, required: false, trim: true },
    width: { type: Number, required: false },
    height: { type: Number, required: false },
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
    thumbnailUrl: { type: String, required: false, trim: true }
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
