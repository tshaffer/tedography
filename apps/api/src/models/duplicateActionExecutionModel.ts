import mongoose, { type Model, Schema } from 'mongoose';

const duplicateActionExecutionStatuses = [
  'pending',
  'running',
  'completed',
  'partially_failed',
  'failed'
] as const;

const duplicateActionExecutionItemStatuses = ['succeeded', 'failed', 'skipped'] as const;
const duplicateActionExecutionOperations = ['MOVE_TO_QUARANTINE'] as const;

export interface DuplicateActionExecutionDocument {
  executionId: string;
  planId: string;
  groupKey: string;
  operation: (typeof duplicateActionExecutionOperations)[number];
  status: (typeof duplicateActionExecutionStatuses)[number];
  itemResults: Array<{
    assetId: string;
    sourceStorageRootId: string;
    sourceArchivePath: string;
    destinationStorageRootId: string;
    destinationArchivePath: string;
    status: (typeof duplicateActionExecutionItemStatuses)[number];
    errorMessage?: string | null;
  }>;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const duplicateActionExecutionSchema = new Schema<DuplicateActionExecutionDocument>(
  {
    executionId: { type: String, required: true, unique: true, index: true, trim: true },
    planId: { type: String, required: true, index: true, trim: true },
    groupKey: { type: String, required: true, index: true, trim: true },
    operation: {
      type: String,
      required: true,
      enum: duplicateActionExecutionOperations
    },
    status: {
      type: String,
      required: true,
      enum: duplicateActionExecutionStatuses
    },
    itemResults: {
      type: [
        new Schema(
          {
            assetId: { type: String, required: true, trim: true },
            sourceStorageRootId: { type: String, required: true, trim: true },
            sourceArchivePath: { type: String, required: true, trim: true },
            destinationStorageRootId: { type: String, required: true, trim: true },
            destinationArchivePath: { type: String, required: true, trim: true },
            status: { type: String, required: true, enum: duplicateActionExecutionItemStatuses },
            errorMessage: { type: String, required: false, default: null, trim: true }
          },
          { _id: false }
        )
      ],
      required: true,
      default: []
    },
    succeededCount: { type: Number, required: true, default: 0 },
    failedCount: { type: Number, required: true, default: 0 },
    skippedCount: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, required: false, default: null },
    completedAt: { type: Date, required: false, default: null }
  },
  {
    collection: 'duplicateActionExecutions',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

duplicateActionExecutionSchema.index({ planId: 1, createdAt: -1 });
duplicateActionExecutionSchema.index({ groupKey: 1, createdAt: -1 });

export const DuplicateActionExecutionModel: Model<DuplicateActionExecutionDocument> =
  (mongoose.models.DuplicateActionExecution as Model<DuplicateActionExecutionDocument> | undefined) ??
  mongoose.model<DuplicateActionExecutionDocument>(
    'DuplicateActionExecution',
    duplicateActionExecutionSchema
  );
