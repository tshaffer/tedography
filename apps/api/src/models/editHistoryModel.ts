import type { EditHistoryEntry } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const editHistorySchema = new Schema<EditHistoryEntry>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    sourceAssetId: { type: String, required: true, index: true, trim: true },
    sourceFilename: { type: String, required: true, trim: true },
    prompt: { type: String, required: false, trim: true, default: '' },
    editedFilename: { type: String, required: true, trim: true },
    editedAssetId: { type: String, default: null },
    status: { type: String, required: true, enum: ['succeeded', 'failed'] },
    errorMessage: { type: String, default: null },
    processedAt: { type: String, required: true, trim: true },
  },
  {
    collection: 'editHistory',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

export const EditHistoryModel: Model<EditHistoryEntry> =
  (mongoose.models.EditHistoryEntry as Model<EditHistoryEntry> | undefined) ??
  mongoose.model<EditHistoryEntry>('EditHistoryEntry', editHistorySchema);
