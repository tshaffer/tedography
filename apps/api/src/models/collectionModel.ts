import { type Collection } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const collectionSchema = new Schema<Collection>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    createdAt: { type: String, required: true, trim: true },
    updatedAt: { type: String, required: true, trim: true }
  },
  {
    collection: 'collections',
    versionKey: false,
    strict: true,
    minimize: false
  }
);

collectionSchema.index({ name: 1 }, { unique: true });

export const CollectionModel: Model<Collection> =
  (mongoose.models.Collection as Model<Collection> | undefined) ??
  mongoose.model<Collection>('Collection', collectionSchema);
