import type { PersonFaceExample } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const personFaceExampleSchema = new Schema<PersonFaceExample>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    personId: { type: String, required: true, index: true, trim: true },
    faceDetectionId: { type: String, required: true, index: true, trim: true },
    mediaAssetId: { type: String, required: true, index: true, trim: true },
    engine: { type: String, required: true, trim: true },
    subjectKey: { type: String, required: false, trim: true, default: null },
    engineExampleId: { type: String, required: false, trim: true, default: null },
    status: {
      type: String,
      required: true,
      enum: ['active', 'removed'],
      default: 'active'
    },
    removedAt: { type: String, required: false, trim: true, default: null }
  },
  {
    collection: 'personFaceExamples',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

personFaceExampleSchema.index({ personId: 1, status: 1, createdAt: -1 });
personFaceExampleSchema.index({ faceDetectionId: 1, personId: 1, status: 1 }, { unique: true });

export const PersonFaceExampleModel: Model<PersonFaceExample> =
  (mongoose.models.PersonFaceExample as Model<PersonFaceExample> | undefined) ??
  mongoose.model<PersonFaceExample>('PersonFaceExample', personFaceExampleSchema);
