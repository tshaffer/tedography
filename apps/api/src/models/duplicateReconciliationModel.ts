import mongoose, { type Model, Schema } from 'mongoose';

const duplicateReconciliationStatuses = ['auto_applied', 'no_changes'] as const;
const duplicateReconciliationFieldNames = ['albumIds'] as const;

export interface DuplicateReconciliationDocument {
  groupKey: string;
  canonicalAssetId: string;
  sourceSecondaryAssetIds: string[];
  status: (typeof duplicateReconciliationStatuses)[number];
  entries: Array<{
    fieldName: (typeof duplicateReconciliationFieldNames)[number];
    originalCanonicalValue: string[];
    reconciledValue: string[];
    addedValues: string[];
    contributedAssetIds: string[];
    rationale: string[];
    status: (typeof duplicateReconciliationStatuses)[number];
  }>;
  rationale: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const duplicateReconciliationSchema = new Schema<DuplicateReconciliationDocument>(
  {
    groupKey: { type: String, required: true, unique: true, index: true, trim: true },
    canonicalAssetId: { type: String, required: true, trim: true, index: true },
    sourceSecondaryAssetIds: { type: [String], required: true, default: [] },
    status: {
      type: String,
      required: true,
      enum: duplicateReconciliationStatuses
    },
    entries: {
      type: [
        new Schema(
          {
            fieldName: {
              type: String,
              required: true,
              enum: duplicateReconciliationFieldNames
            },
            originalCanonicalValue: { type: [String], required: true, default: [] },
            reconciledValue: { type: [String], required: true, default: [] },
            addedValues: { type: [String], required: true, default: [] },
            contributedAssetIds: { type: [String], required: true, default: [] },
            rationale: { type: [String], required: true, default: [] },
            status: {
              type: String,
              required: true,
              enum: duplicateReconciliationStatuses
            }
          },
          { _id: false }
        )
      ],
      required: true,
      default: []
    },
    rationale: { type: [String], required: true, default: [] }
  },
  {
    collection: 'duplicateReconciliations',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

duplicateReconciliationSchema.index({ status: 1, updatedAt: -1 });
duplicateReconciliationSchema.index({ sourceSecondaryAssetIds: 1 });

export const DuplicateReconciliationModel: Model<DuplicateReconciliationDocument> =
  (mongoose.models.DuplicateReconciliation as Model<DuplicateReconciliationDocument> | undefined) ??
  mongoose.model<DuplicateReconciliationDocument>(
    'DuplicateReconciliation',
    duplicateReconciliationSchema
  );
