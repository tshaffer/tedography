import type { FaceDetection } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const faceDetectionSchema = new Schema<FaceDetection>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    mediaAssetId: { type: String, required: true, index: true, trim: true },
    faceIndex: { type: Number, required: true },
    boundingBox: {
      left: { type: Number, required: true },
      top: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    cropPath: { type: String, required: false, trim: true, default: null },
    previewPath: { type: String, required: false, trim: true, default: null },
    detectionProvider: {
      type: String,
      required: false,
      enum: ['amazon-rekognition', null],
      trim: true,
      default: null
    },
    detectionModelVersion: { type: String, required: false, trim: true, default: null },
    detectionConfidence: { type: Number, required: false, default: null },
    landmarks: {
      type: [
        {
          _id: false,
          type: {
            type: String,
            required: true,
            trim: true
          },
          x: { type: Number, required: true },
          y: { type: Number, required: true }
        }
      ],
      required: false,
      default: []
    },
    ageRangeLow: { type: Number, required: false, default: null },
    ageRangeHigh: { type: Number, required: false, default: null },
    estimatedAgeMidpoint: { type: Number, required: false, default: null },
    sharpness: { type: Number, required: false, default: null },
    brightness: { type: Number, required: false, default: null },
    pose: {
      pitch: { type: Number, required: false, default: null },
      roll: { type: Number, required: false, default: null },
      yaw: { type: Number, required: false, default: null }
    },
    sourceImageVariant: {
      type: String,
      required: false,
      enum: ['original', 'display-jpeg', 'thumbnail', null],
      trim: true,
      default: null
    },
    detectionRunId: { type: String, required: false, trim: true, default: null },
    qualityScore: { type: Number, required: false, default: null },
    faceAreaPercent: { type: Number, required: false, default: null },
    engine: { type: String, required: true, trim: true },
    engineVersion: { type: String, required: false, trim: true, default: null },
    pipelineVersion: { type: String, required: true, trim: true },
    matchedPersonId: { type: String, required: false, trim: true, default: null },
    matchConfidence: { type: Number, required: false, default: null },
    matchStatus: {
      type: String,
      required: true,
      enum: ['unmatched', 'suggested', 'autoMatched', 'confirmed', 'rejected', 'ignored']
    },
    autoMatchCandidatePersonId: { type: String, required: false, trim: true, default: null },
    autoMatchCandidateConfidence: { type: Number, required: false, default: null },
    ignoredReason: {
      type: String,
      required: false,
      enum: ['too-small', 'too-low-quality', 'background-face', 'non-person-face', 'user-ignored', 'other', null],
      default: null
    }
  },
  {
    collection: 'faceDetections',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

faceDetectionSchema.index({ mediaAssetId: 1, faceIndex: 1 }, { unique: true });
faceDetectionSchema.index({ mediaAssetId: 1, matchStatus: 1 });
faceDetectionSchema.index({ matchedPersonId: 1 });
faceDetectionSchema.index({ mediaAssetId: 1 });
faceDetectionSchema.index({ estimatedAgeMidpoint: 1 });
faceDetectionSchema.index({ mediaAssetId: 1, estimatedAgeMidpoint: 1 });

export const FaceDetectionModel: Model<FaceDetection> =
  (mongoose.models.FaceDetection as Model<FaceDetection> | undefined) ??
  mongoose.model<FaceDetection>('FaceDetection', faceDetectionSchema);
