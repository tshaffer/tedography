import { MediaType } from '@tedography/domain';
import { IMAGE_ANALYSIS_VERSION_V1, type AnalysisSourceType } from '@tedography/duplicate-domain';
import { computeDHash, computePHash, readImageMetadata } from '@tedography/image-analysis';
import mongoose from 'mongoose';
import {
  getAnalysisSourceCandidates,
  type MediaAssetDocument,
  parseStorageRoots,
  requireEnv,
  type StorageRootConfig
} from '../support/assetSource.js';

type ScanAssetScope = 'all' | 'missing-analysis';

interface ImageAnalysisCollectionRecord {
  assetId: string;
  analysisVersion: string;
  width?: number;
  height?: number;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: AnalysisSourceType;
  analysisSourcePath?: string;
  decodeStrategy?: string;
  normalizedFingerprintStatus: 'pending' | 'ready' | 'failed';
  errorMessage?: string;
  computedAt: Date;
  sourceUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScanCommandOptions {
  assetScope: ScanAssetScope;
}

interface ScanSummary {
  assetsSeen: number;
  assetsAttempted: number;
  readyCount: number;
  readyFromOriginalCount: number;
  readyFromDerivedJpegCount: number;
  failedCount: number;
  skippedCount: number;
}

interface SuccessfulAnalysis {
  width: number;
  height: number;
  dHash: string;
  pHash: string;
  analysisSourceType: AnalysisSourceType;
  analysisSourcePath: string;
  decodeStrategy: string;
  normalizedFingerprintStatus: 'ready';
  computedAt: Date;
  sourceUpdatedAt?: Date;
}

async function analyzeFromPath(
  asset: MediaAssetDocument,
  sourceType: AnalysisSourceType,
  sourcePath: string,
  decodeStrategy: string
): Promise<SuccessfulAnalysis> {
  const metadata = await readImageMetadata(sourcePath);
  const [dHash, pHash] = await Promise.all([computeDHash(sourcePath), computePHash(sourcePath)]);
  const computedAt = new Date();
  const analysis: SuccessfulAnalysis = {
    width: metadata.width,
    height: metadata.height,
    dHash,
    pHash,
    analysisSourceType: sourceType,
    analysisSourcePath: sourcePath,
    decodeStrategy,
    normalizedFingerprintStatus: 'ready',
    computedAt
  };

  if (asset.updatedAt) {
    analysis.sourceUpdatedAt = new Date(asset.updatedAt);
  }

  return analysis;
}

async function analyzeAsset(
  asset: MediaAssetDocument,
  storageRoots: StorageRootConfig[],
  derivedRoot: string | undefined
): Promise<SuccessfulAnalysis> {
  const candidates = await getAnalysisSourceCandidates(asset, storageRoots, derivedRoot);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await analyzeFromPath(asset, candidate.type, candidate.path, candidate.strategy);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown analysis error';
      errors.push(`${candidate.label}: ${message}`);
    }
  }

  throw new Error(errors.join('\n'));
}

export async function runScanCommand(options: ScanCommandOptions): Promise<void> {
  const mongoUri = requireEnv('MONGODB_URI');
  const storageRoots = parseStorageRoots(process.env.TEDOGRAPHY_STORAGE_ROOTS);
  const derivedRoot = process.env.TEDOGRAPHY_DERIVED_ROOT?.trim();
  const analysisVersion = IMAGE_ANALYSIS_VERSION_V1;
  const client = new mongoose.mongo.MongoClient(mongoUri);
  const summary: ScanSummary = {
    assetsSeen: 0,
    assetsAttempted: 0,
    readyCount: 0,
    readyFromOriginalCount: 0,
    readyFromDerivedJpegCount: 0,
    failedCount: 0,
    skippedCount: 0
  };

  try {
    await client.connect();
    const database = client.db();
    const mediaAssetsCollection = database.collection<MediaAssetDocument>('mediaAssets');
    const imageAnalysesCollection = database.collection<ImageAnalysisCollectionRecord>('imageAnalyses');

    const photoAssets = await mediaAssetsCollection
      .find({ mediaType: MediaType.Photo }, { projection: { _id: 0 } })
      .toArray();

    summary.assetsSeen = photoAssets.length;

    for (const asset of photoAssets) {
      if (options.assetScope === 'missing-analysis') {
        const existing = await imageAnalysesCollection.findOne(
          { assetId: asset.id, analysisVersion },
          { projection: { _id: 0, assetId: 1 } }
        );

        if (existing) {
          summary.skippedCount += 1;
          continue;
        }
      }

      summary.assetsAttempted += 1;

      try {
        const analyzed = await analyzeAsset(asset, storageRoots, derivedRoot);
        const readySet: Partial<ImageAnalysisCollectionRecord> = {
          width: analyzed.width,
          height: analyzed.height,
          dHash: analyzed.dHash,
          pHash: analyzed.pHash,
          analysisSourceType: analyzed.analysisSourceType,
          analysisSourcePath: analyzed.analysisSourcePath,
          decodeStrategy: analyzed.decodeStrategy,
          normalizedFingerprintStatus: analyzed.normalizedFingerprintStatus,
          computedAt: analyzed.computedAt
        };
        if (analyzed.sourceUpdatedAt) {
          readySet.sourceUpdatedAt = analyzed.sourceUpdatedAt;
        }

        await imageAnalysesCollection.updateOne(
          { assetId: asset.id, analysisVersion },
          {
            $set: readySet,
            $unset: {
              errorMessage: ''
            },
            $setOnInsert: {
              createdAt: analyzed.computedAt
            },
            $currentDate: {
              updatedAt: true
            }
          },
          { upsert: true }
        );
        summary.readyCount += 1;
        if (analyzed.analysisSourceType === 'original') {
          summary.readyFromOriginalCount += 1;
        } else {
          summary.readyFromDerivedJpegCount += 1;
          console.log(`fallback used for ${asset.id}: ${analyzed.analysisSourcePath}`);
        }
      } catch (error) {
        const computedAt = new Date();
        const failedSet: Partial<ImageAnalysisCollectionRecord> = {
          decodeStrategy: 'original-then-derived-jpeg-fallback',
          normalizedFingerprintStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown analysis error',
          computedAt
        };
        if (asset.updatedAt) {
          failedSet.sourceUpdatedAt = new Date(asset.updatedAt);
        }

        await imageAnalysesCollection.updateOne(
          { assetId: asset.id, analysisVersion },
          {
            $set: failedSet,
            $unset: {
              width: '',
              height: '',
              dHash: '',
              pHash: '',
              analysisSourceType: '',
              analysisSourcePath: ''
            },
            $setOnInsert: {
              createdAt: computedAt
            },
            $currentDate: {
              updatedAt: true
            }
          },
          { upsert: true }
        );
        summary.failedCount += 1;
      }

      if (summary.assetsAttempted % 25 === 0) {
        console.log(
          `processed ${String(summary.assetsAttempted)} assets (${String(summary.readyCount)} ready, ${String(summary.failedCount)} failed, ${String(summary.skippedCount)} skipped)`
        );
      }
    }
  } finally {
    await client.close();
  }

  console.log(`analysis version: ${analysisVersion}`);
  console.log(`photo assets seen: ${String(summary.assetsSeen)}`);
  console.log(`assets attempted: ${String(summary.assetsAttempted)}`);
  console.log(`ready: ${String(summary.readyCount)}`);
  console.log(`ready from original: ${String(summary.readyFromOriginalCount)}`);
  console.log(`ready from derived-jpeg fallback: ${String(summary.readyFromDerivedJpegCount)}`);
  console.log(`failed: ${String(summary.failedCount)}`);
  console.log(`skipped: ${String(summary.skippedCount)}`);
}
