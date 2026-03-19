import mongoose, { type Model, Schema } from 'mongoose';

const duplicateActionPlanStatuses = [
  'proposed',
  'needs_manual_review',
  'approved',
  'rejected'
] as const;

const duplicateActionTypes = [
  'KEEP_CANONICAL',
  'PROPOSE_ARCHIVE_SECONDARY',
  'NEEDS_MANUAL_REVIEW'
] as const;

const executionReadinessValues = ['eligible_for_future_execution', 'blocked'] as const;

export interface DuplicateActionPlanDocument {
  groupKey: string;
  canonicalAssetId: string;
  secondaryAssetIds: string[];
  primaryActionType: (typeof duplicateActionTypes)[number];
  planStatus: (typeof duplicateActionPlanStatuses)[number];
  executionReadiness: (typeof executionReadinessValues)[number];
  actionItems: Array<{
    assetId: string;
    actionType: (typeof duplicateActionTypes)[number];
    rationale: string[];
  }>;
  rationale: string[];
  reviewNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const duplicateActionPlanSchema = new Schema<DuplicateActionPlanDocument>(
  {
    groupKey: { type: String, required: true, unique: true, index: true, trim: true },
    canonicalAssetId: { type: String, required: true, trim: true },
    secondaryAssetIds: { type: [String], required: true, default: [] },
    primaryActionType: {
      type: String,
      required: true,
      enum: duplicateActionTypes
    },
    planStatus: {
      type: String,
      required: true,
      enum: duplicateActionPlanStatuses
    },
    executionReadiness: {
      type: String,
      required: true,
      enum: executionReadinessValues
    },
    actionItems: {
      type: [
        new Schema(
          {
            assetId: { type: String, required: true, trim: true },
            actionType: { type: String, required: true, enum: duplicateActionTypes },
            rationale: { type: [String], required: true, default: [] }
          },
          { _id: false }
        )
      ],
      required: true,
      default: []
    },
    rationale: { type: [String], required: true, default: [] },
    reviewNote: { type: String, required: false, default: null, trim: true }
  },
  {
    collection: 'duplicateActionPlans',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

duplicateActionPlanSchema.index({ planStatus: 1, primaryActionType: 1 });
duplicateActionPlanSchema.index({ canonicalAssetId: 1 });
duplicateActionPlanSchema.index({ secondaryAssetIds: 1 });

export const DuplicateActionPlanModel: Model<DuplicateActionPlanDocument> =
  (mongoose.models.DuplicateActionPlan as Model<DuplicateActionPlanDocument> | undefined) ??
  mongoose.model<DuplicateActionPlanDocument>('DuplicateActionPlan', duplicateActionPlanSchema);
