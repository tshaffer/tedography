import type { FaceDetectionAssignment } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const faceDetectionAssignmentSchema = new Schema<FaceDetectionAssignment>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    detectedFaceId: { type: String, required: true, unique: true, index: true, trim: true },
    mediaAssetId: { type: String, required: true, index: true, trim: true },
    personId: { type: String, required: true, index: true, trim: true },
    assignmentSource: {
      type: String,
      required: true,
      enum: ['auto-match', 'manual-confirm', 'manual-reject', 'manual-merge-adjustment']
    },
    assignmentStatus: {
      type: String,
      required: true,
      enum: ['suggested', 'confirmed', 'rejected', 'ignored']
    },
    matchConfidence: { type: Number, required: false, default: null }
  },
  {
    collection: 'faceDetectionAssignments',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

faceDetectionAssignmentSchema.index({ personId: 1, assignmentStatus: 1 });
faceDetectionAssignmentSchema.index({ personId: 1, mediaAssetId: 1 });

export const FaceDetectionAssignmentModel: Model<FaceDetectionAssignment> =
  (mongoose.models.FaceDetectionAssignment as Model<FaceDetectionAssignment> | undefined) ??
  mongoose.model<FaceDetectionAssignment>('FaceDetectionAssignment', faceDetectionAssignmentSchema);
