import type { AiEditQueueEntry } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const aiEditQueueEntrySchema = new Schema<AiEditQueueEntry>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    assetId: { type: String, required: true, unique: true, index: true, trim: true },
    prompt: { type: String, required: true, trim: true, default: '' },
    createdAt: { type: String, required: true, trim: true },
  },
  {
    collection: 'aiEditQueue',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

export const AiEditQueueEntryModel: Model<AiEditQueueEntry> =
  (mongoose.models.AiEditQueueEntry as Model<AiEditQueueEntry> | undefined) ??
  mongoose.model<AiEditQueueEntry>('AiEditQueueEntry', aiEditQueueEntrySchema);
