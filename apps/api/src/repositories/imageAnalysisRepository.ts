import { ImageAnalysisModel, type ImageAnalysisDocument } from '../models/imageAnalysisModel.js';

export interface UpsertImageAnalysisInput {
  assetId: string;
  analysisVersion: string;
  width?: number;
  height?: number;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: ImageAnalysisDocument['analysisSourceType'];
  analysisSourcePath?: string;
  decodeStrategy?: string;
  normalizedFingerprintStatus: ImageAnalysisDocument['normalizedFingerprintStatus'];
  errorMessage?: string;
  computedAt: Date;
  sourceUpdatedAt?: Date;
}

export interface ImageAnalysisStats {
  totalImageAnalysisRecords: number;
  readyCount: number;
  failedCount: number;
  pendingCount: number;
  missingDHashCount: number;
  missingPHashCount: number;
  originalSourceCount: number;
  derivedJpegSourceCount: number;
}

export async function upsertImageAnalysis(
  input: UpsertImageAnalysisInput
): Promise<ImageAnalysisDocument> {
  const updated = await ImageAnalysisModel.findOneAndUpdate(
    {
      assetId: input.assetId,
      analysisVersion: input.analysisVersion
    },
    {
      $set: {
        width: input.width,
        height: input.height,
        dHash: input.dHash,
        pHash: input.pHash,
        analysisSourceType: input.analysisSourceType,
        analysisSourcePath: input.analysisSourcePath,
        decodeStrategy: input.decodeStrategy,
        normalizedFingerprintStatus: input.normalizedFingerprintStatus,
        errorMessage: input.errorMessage,
        computedAt: input.computedAt,
        sourceUpdatedAt: input.sourceUpdatedAt
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: { _id: 0 }
    }
  ).lean<ImageAnalysisDocument | null>();

  if (!updated) {
    throw new Error(`Failed to upsert image analysis for asset ${input.assetId}.`);
  }

  return updated;
}

export async function findImageAnalysisByAssetIdAndVersion(
  assetId: string,
  analysisVersion: string
): Promise<ImageAnalysisDocument | null> {
  return ImageAnalysisModel.findOne(
    {
      assetId,
      analysisVersion
    },
    { _id: 0 }
  ).lean<ImageAnalysisDocument | null>();
}

export async function getImageAnalysisStats(analysisVersion: string): Promise<ImageAnalysisStats> {
  const [
    totalImageAnalysisRecords,
    readyCount,
    failedCount,
    pendingCount,
    missingDHashCount,
    missingPHashCount,
    originalSourceCount,
    derivedJpegSourceCount
  ] = await Promise.all([
      ImageAnalysisModel.countDocuments({ analysisVersion }),
      ImageAnalysisModel.countDocuments({ analysisVersion, normalizedFingerprintStatus: 'ready' }),
      ImageAnalysisModel.countDocuments({ analysisVersion, normalizedFingerprintStatus: 'failed' }),
      ImageAnalysisModel.countDocuments({ analysisVersion, normalizedFingerprintStatus: 'pending' }),
      ImageAnalysisModel.countDocuments({ analysisVersion, dHash: { $exists: false } }),
      ImageAnalysisModel.countDocuments({ analysisVersion, pHash: { $exists: false } }),
      ImageAnalysisModel.countDocuments({ analysisVersion, analysisSourceType: 'original' }),
      ImageAnalysisModel.countDocuments({ analysisVersion, analysisSourceType: 'derived-jpeg' })
    ]);

  return {
    totalImageAnalysisRecords,
    readyCount,
    failedCount,
    pendingCount,
    missingDHashCount,
    missingPHashCount,
    originalSourceCount,
    derivedJpegSourceCount
  };
}
