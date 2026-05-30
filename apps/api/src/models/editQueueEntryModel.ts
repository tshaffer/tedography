import type { EditQueueEntry } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const editQueueEntrySchema = new Schema<EditQueueEntry>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    assetId: { type: String, required: true, unique: true, index: true, trim: true },
    prompt: { type: String, required: true, trim: true, default: '' },
    createdAt: { type: String, required: true, trim: true },
  },
  {
    collection: 'editQueue',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

export const EditQueueEntryModel: Model<EditQueueEntry> =
  (mongoose.models.EditQueueEntry as Model<EditQueueEntry> | undefined) ??
  mongoose.model<EditQueueEntry>('EditQueueEntry', editQueueEntrySchema);
