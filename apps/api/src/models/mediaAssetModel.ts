import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const mediaAssetSchema = new Schema<MediaAsset>(
  {
    id: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    mediaType: { type: String, required: true, enum: Object.values(MediaType) },
    photoState: { type: String, required: true, enum: Object.values(PhotoState) },
    captureDateTime: { type: String, required: true },
    thumbnailUrl: { type: String, required: false },
    width: { type: Number, required: false },
    height: { type: Number, required: false }
  },
  {
    collection: 'mediaAssets',
    versionKey: false
  }
);

export const MediaAssetModel: Model<MediaAsset> =
  (mongoose.models.MediaAsset as Model<MediaAsset> | undefined) ??
  mongoose.model<MediaAsset>('MediaAsset', mediaAssetSchema);
