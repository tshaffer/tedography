import type { EditHistoryArchive } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const editHistoryArchiveSchema = new Schema<EditHistoryArchive>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    createdAt: { type: String, required: true, trim: true },
    itemCount: { type: Number, required: true, default: 0 },
  },
  {
    collection: 'editHistoryArchives',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

export const EditHistoryArchiveModel: Model<EditHistoryArchive> =
  (mongoose.models.EditHistoryArchive as Model<EditHistoryArchive> | undefined) ??
  mongoose.model<EditHistoryArchive>('EditHistoryArchive', editHistoryArchiveSchema);
