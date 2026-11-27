import mongoose, { type Model, Schema } from 'mongoose';
import type { ExportNameRecord } from '../editQueue/exportNames.js';

export interface EditExportNameDocument extends ExportNameRecord {
  // Lowercased filename without its extension.
  nameKey: string;
  coded: boolean;
}

// One permanent record per exported asset. Records are never deleted, including
// when the asset is trashed, so a working filename is never reassigned.
// Filenames are stored untrimmed: they must match the files exactly.
const editExportNameSchema = new Schema<EditExportNameDocument>(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    exportedFilename: { type: String, required: true },
    originalFilename: { type: String, required: true },
    nameKey: { type: String, required: true },
    coded: { type: Boolean, required: true },
    exported: { type: Boolean, required: true, default: false },
    createdAt: { type: String, required: true },
  },
  {
    collection: 'editExportNames',
    versionKey: false,
    strict: true,
    minimize: false,
  }
);

// No two assets can hold the same coded name. Older plain names are exempt: they
// predate this rule, and ambiguity between them is detected at import.
editExportNameSchema.index({ nameKey: 1 }, { unique: true, partialFilterExpression: { coded: true } });

export const EditExportNameModel: Model<EditExportNameDocument> =
  (mongoose.models.EditExportName as Model<EditExportNameDocument> | undefined) ??
  mongoose.model<EditExportNameDocument>('EditExportName', editExportNameSchema);
