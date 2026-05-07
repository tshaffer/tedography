import type { KeywordChangeEvent } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const keywordChangeEventSchema = new Schema<KeywordChangeEvent>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    assetId: { type: String, required: true, trim: true },
    keywordId: { type: String, required: true, trim: true },
    action: { type: String, required: true, enum: ['added', 'removed'] },
    changedAt: { type: String, required: true, trim: true }
  },
  {
    collection: 'keywordChangeEvents',
    versionKey: false,
    strict: true,
    minimize: false
  }
);

keywordChangeEventSchema.index({ assetId: 1 });
keywordChangeEventSchema.index({ keywordId: 1 });
keywordChangeEventSchema.index({ changedAt: 1 });

export const KeywordChangeEventModel: Model<KeywordChangeEvent> =
  (mongoose.models.KeywordChangeEvent as Model<KeywordChangeEvent> | undefined) ??
  mongoose.model<KeywordChangeEvent>('KeywordChangeEvent', keywordChangeEventSchema);
