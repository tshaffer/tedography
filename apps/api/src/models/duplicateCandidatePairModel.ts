import mongoose, { type Model, Schema } from 'mongoose';

const duplicateCandidateClassifications = [
  'very_likely_duplicate',
  'possible_duplicate',
  'similar_image'
] as const;

const duplicateCandidateStatuses = ['unreviewed', 'ignored', 'reviewed'] as const;
const duplicateCandidateReviewOutcomes = [
  'confirmed_duplicate',
  'not_duplicate',
  'ignored'
] as const;

export interface DuplicateCandidatePairDocument {
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
  score: number;
  classification: (typeof duplicateCandidateClassifications)[number];
  status: (typeof duplicateCandidateStatuses)[number];
  outcome?: (typeof duplicateCandidateReviewOutcomes)[number] | null;
  signals: {
    dHashDistance?: number;
    pHashDistance?: number;
    dimensionsSimilarity?: number;
    aspectRatioDelta?: number;
    sourceUpdatedTimeDeltaMs?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const duplicateCandidatePairSchema = new Schema<DuplicateCandidatePairDocument>(
  {
    assetIdA: { type: String, required: true, trim: true, index: true },
    assetIdB: { type: String, required: true, trim: true, index: true },
    analysisVersion: { type: String, required: true, trim: true, index: true },
    generationVersion: { type: String, required: true, trim: true, index: true },
    score: { type: Number, required: true },
    classification: {
      type: String,
      required: true,
      enum: duplicateCandidateClassifications
    },
    status: {
      type: String,
      required: true,
      enum: duplicateCandidateStatuses,
      default: 'unreviewed'
    },
    outcome: {
      type: String,
      required: false,
      default: null,
      enum: [...duplicateCandidateReviewOutcomes, null]
    },
    signals: {
      dHashDistance: { type: Number, required: false },
      pHashDistance: { type: Number, required: false },
      dimensionsSimilarity: { type: Number, required: false },
      aspectRatioDelta: { type: Number, required: false },
      sourceUpdatedTimeDeltaMs: { type: Number, required: false }
    }
  },
  {
    collection: 'duplicateCandidatePairs',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

duplicateCandidatePairSchema.index(
  { assetIdA: 1, assetIdB: 1, analysisVersion: 1, generationVersion: 1 },
  { unique: true }
);
duplicateCandidatePairSchema.index({ generationVersion: 1, classification: 1 });
duplicateCandidatePairSchema.index({ generationVersion: 1, status: 1 });

export const DuplicateCandidatePairModel: Model<DuplicateCandidatePairDocument> =
  (mongoose.models.DuplicateCandidatePair as Model<DuplicateCandidatePairDocument> | undefined) ??
  mongoose.model<DuplicateCandidatePairDocument>(
    'DuplicateCandidatePair',
    duplicateCandidatePairSchema
  );
