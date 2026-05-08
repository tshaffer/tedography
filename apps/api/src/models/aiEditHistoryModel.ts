import type { AiEditHistoryEntry } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const aiEditHistorySchema = new Schema<AiEditHistoryEntry>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    sourceAssetId: { type: String, required: true, index: true, trim: true },
    sourceFilename: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true, default: '' },
    generatedFilename: { type: String, required: true, trim: true },
    generatedAssetId: { type: String, default: null },
    status: { type: String, required: true, enum: ['succeeded', 'failed'] },
    errorMessage: { type: String, default: null },
    processedAt: { type: String, required: true, trim: true },
  },
  {
    collection: 'aiEditHistory',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

export const AiEditHistoryModel: Model<AiEditHistoryEntry> =
  (mongoose.models.AiEditHistoryEntry as Model<AiEditHistoryEntry> | undefined) ??
  mongoose.model<AiEditHistoryEntry>('AiEditHistoryEntry', aiEditHistorySchema);
