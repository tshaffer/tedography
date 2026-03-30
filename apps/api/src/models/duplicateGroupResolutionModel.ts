import mongoose, { type Model, Schema } from 'mongoose';

const duplicateGroupResolutionStatuses = ['proposed', 'confirmed'] as const;

export interface DuplicateGroupResolutionDocument {
  groupKey: string;
  assetIds: string[];
  proposedCanonicalAssetId: string;
  manualCanonicalAssetId?: string | null;
  resolutionStatus: (typeof duplicateGroupResolutionStatuses)[number];
  confirmedAt?: Date | null;
  rereviewRequiredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const duplicateGroupResolutionSchema = new Schema<DuplicateGroupResolutionDocument>(
  {
    groupKey: { type: String, required: true, unique: true, index: true, trim: true },
    assetIds: { type: [String], required: true, default: [] },
    proposedCanonicalAssetId: { type: String, required: true, trim: true },
    manualCanonicalAssetId: { type: String, required: false, default: null, trim: true },
    resolutionStatus: {
      type: String,
      required: true,
      enum: duplicateGroupResolutionStatuses,
      default: 'proposed'
    },
    confirmedAt: { type: Date, required: false, default: null },
    rereviewRequiredAt: { type: Date, required: false, default: null }
  },
  {
    collection: 'duplicateGroupResolutions',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

duplicateGroupResolutionSchema.index({ resolutionStatus: 1 });

export const DuplicateGroupResolutionModel: Model<DuplicateGroupResolutionDocument> =
  (mongoose.models.DuplicateGroupResolution as Model<DuplicateGroupResolutionDocument> | undefined) ??
  mongoose.model<DuplicateGroupResolutionDocument>(
    'DuplicateGroupResolution',
    duplicateGroupResolutionSchema
  );
