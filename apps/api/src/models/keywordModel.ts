import { type Keyword } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const keywordSchema = new Schema<Keyword>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    label: { type: String, required: true, trim: true },
    normalizedLabel: { type: String, required: true, unique: true, index: true, trim: true },
    parentKeywordId: { type: String, default: null, index: true, trim: true },
    createdAt: { type: String, required: true, trim: true },
    updatedAt: { type: String, required: true, trim: true }
  },
  {
    collection: 'keywords',
    versionKey: false,
    strict: true,
    minimize: false
  }
);

export const KeywordModel: Model<Keyword> =
  (mongoose.models.Keyword as Model<Keyword> | undefined) ??
  mongoose.model<Keyword>('Keyword', keywordSchema);
