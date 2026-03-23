import type { FaceMatchReview } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const faceMatchReviewSchema = new Schema<FaceMatchReview>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    faceDetectionId: { type: String, required: true, unique: true, index: true, trim: true },
    mediaAssetId: { type: String, required: true, index: true, trim: true },
    suggestedPersonId: { type: String, required: false, trim: true, default: null },
    suggestedConfidence: { type: Number, required: false, default: null },
    finalPersonId: { type: String, required: false, trim: true, default: null },
    decision: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'rejected', 'assignedToDifferentPerson', 'ignored']
    },
    reviewer: { type: String, required: false, trim: true, default: null },
    notes: { type: String, required: false, trim: true, default: null },
    ignoredReason: {
      type: String,
      required: false,
      enum: ['too-small', 'too-low-quality', 'background-face', 'non-person-face', 'user-ignored', 'other', null],
      default: null
    }
  },
  {
    collection: 'faceMatchReviews',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

faceMatchReviewSchema.index({ mediaAssetId: 1, decision: 1 });

export const FaceMatchReviewModel: Model<FaceMatchReview> =
  (mongoose.models.FaceMatchReview as Model<FaceMatchReview> | undefined) ??
  mongoose.model<FaceMatchReview>('FaceMatchReview', faceMatchReviewSchema);
