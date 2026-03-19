import mongoose, { type Model, Schema } from 'mongoose';

type NormalizedFingerprintStatus = 'pending' | 'ready' | 'failed';
type AnalysisSourceType = 'original' | 'derived-jpeg';

export interface ImageAnalysisDocument {
  assetId: string;
  analysisVersion: string;
  width?: number;
  height?: number;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: AnalysisSourceType;
  analysisSourcePath?: string;
  decodeStrategy?: string;
  normalizedFingerprintStatus: NormalizedFingerprintStatus;
  errorMessage?: string;
  computedAt: Date;
  sourceUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

const imageAnalysisSchema = new Schema<ImageAnalysisDocument>(
  {
    assetId: { type: String, required: true, trim: true, index: true },
    analysisVersion: { type: String, required: true, trim: true, index: true },
    width: { type: Number, required: false },
    height: { type: Number, required: false },
    dHash: { type: String, required: false, trim: true },
    pHash: { type: String, required: false, trim: true },
    analysisSourceType: {
      type: String,
      required: false,
      enum: ['original', 'derived-jpeg']
    },
    analysisSourcePath: { type: String, required: false, trim: true },
    decodeStrategy: { type: String, required: false, trim: true },
    normalizedFingerprintStatus: {
      type: String,
      required: true,
      enum: ['pending', 'ready', 'failed']
    },
    errorMessage: { type: String, required: false, trim: true },
    computedAt: { type: Date, required: true },
    sourceUpdatedAt: { type: Date, required: false }
  },
  {
    collection: 'imageAnalyses',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

imageAnalysisSchema.index({ assetId: 1, analysisVersion: 1 }, { unique: true });
imageAnalysisSchema.index({ analysisVersion: 1, normalizedFingerprintStatus: 1 });

export const ImageAnalysisModel: Model<ImageAnalysisDocument> =
  (mongoose.models.ImageAnalysis as Model<ImageAnalysisDocument> | undefined) ??
  mongoose.model<ImageAnalysisDocument>('ImageAnalysis', imageAnalysisSchema);
