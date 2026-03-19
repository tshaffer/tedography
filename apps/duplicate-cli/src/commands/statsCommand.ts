import { MediaType, type MediaAsset } from '@tedography/domain';
import {
  DUPLICATE_CANDIDATE_GENERATION_VERSION_V1,
  IMAGE_ANALYSIS_VERSION_V1
} from '@tedography/duplicate-domain';
import mongoose from 'mongoose';
import { requireEnv } from '../support/assetSource.js';

interface ImageAnalysisCollectionRecord {
  assetId: string;
  analysisVersion: string;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: 'original' | 'derived-jpeg';
  normalizedFingerprintStatus: 'pending' | 'ready' | 'failed';
}

interface DuplicateCandidatePairCollectionRecord {
  classification: 'very_likely_duplicate' | 'possible_duplicate' | 'similar_image';
  status: 'unreviewed' | 'ignored' | 'reviewed';
  generationVersion: string;
}

export async function runStatsCommand(): Promise<void> {
  const mongoUri = requireEnv('MONGODB_URI');
  const analysisVersion = IMAGE_ANALYSIS_VERSION_V1;
  const generationVersion = DUPLICATE_CANDIDATE_GENERATION_VERSION_V1;
  const client = new mongoose.mongo.MongoClient(mongoUri);

  try {
    await client.connect();
    const database = client.db();
    const mediaAssetsCollection = database.collection<MediaAsset>('mediaAssets');
    const imageAnalysesCollection = database.collection<ImageAnalysisCollectionRecord>('imageAnalyses');
    const duplicateCandidatePairsCollection =
      database.collection<DuplicateCandidatePairCollectionRecord>('duplicateCandidatePairs');

    const [
      totalMediaAssets,
      totalPhotoAssets,
      totalImageAnalysisRecords,
      readyCount,
      failedCount,
      pendingCount,
      missingDHashCount,
      missingPHashCount,
      originalSourceCount,
      derivedJpegSourceCount,
      failedWithoutFallbackCount,
      totalCandidatePairs,
      veryLikelyDuplicateCount,
      possibleDuplicateCount,
      similarImageCount,
      unreviewedCandidateCount,
      ignoredCandidateCount,
      reviewedCandidateCount
    ] = await Promise.all([
      mediaAssetsCollection.countDocuments({}),
      mediaAssetsCollection.countDocuments({ mediaType: MediaType.Photo }),
      imageAnalysesCollection.countDocuments({ analysisVersion }),
      imageAnalysesCollection.countDocuments({
        analysisVersion,
        normalizedFingerprintStatus: 'ready'
      }),
      imageAnalysesCollection.countDocuments({
        analysisVersion,
        normalizedFingerprintStatus: 'failed'
      }),
      imageAnalysesCollection.countDocuments({
        analysisVersion,
        normalizedFingerprintStatus: 'pending'
      }),
      imageAnalysesCollection.countDocuments({ analysisVersion, dHash: { $exists: false } }),
      imageAnalysesCollection.countDocuments({ analysisVersion, pHash: { $exists: false } }),
      imageAnalysesCollection.countDocuments({ analysisVersion, analysisSourceType: 'original' }),
      imageAnalysesCollection.countDocuments({
        analysisVersion,
        analysisSourceType: 'derived-jpeg'
      }),
      imageAnalysesCollection.countDocuments({
        analysisVersion,
        normalizedFingerprintStatus: 'failed',
        analysisSourceType: { $exists: false }
      }),
      duplicateCandidatePairsCollection.countDocuments({ generationVersion }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        classification: 'very_likely_duplicate'
      }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        classification: 'possible_duplicate'
      }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        classification: 'similar_image'
      }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        status: 'unreviewed'
      }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        status: 'ignored'
      }),
      duplicateCandidatePairsCollection.countDocuments({
        generationVersion,
        status: 'reviewed'
      })
    ]);

    console.log(`analysis version: ${analysisVersion}`);
    console.log(`total media assets: ${String(totalMediaAssets)}`);
    console.log(`total photo assets: ${String(totalPhotoAssets)}`);
    console.log(`total image analysis records: ${String(totalImageAnalysisRecords)}`);
    console.log(`ready: ${String(readyCount)}`);
    console.log(`failed: ${String(failedCount)}`);
    console.log(`pending: ${String(pendingCount)}`);
    console.log(`missing dHash: ${String(missingDHashCount)}`);
    console.log(`missing pHash: ${String(missingPHashCount)}`);
    console.log(`analysis source original: ${String(originalSourceCount)}`);
    console.log(`analysis source derived-jpeg: ${String(derivedJpegSourceCount)}`);
    console.log(`failed with no fallback source: ${String(failedWithoutFallbackCount)}`);
    console.log(`candidate generation version: ${generationVersion}`);
    console.log(`total candidate pairs: ${String(totalCandidatePairs)}`);
    console.log(`very likely duplicate: ${String(veryLikelyDuplicateCount)}`);
    console.log(`possible duplicate: ${String(possibleDuplicateCount)}`);
    console.log(`similar image: ${String(similarImageCount)}`);
    console.log(`candidate status unreviewed: ${String(unreviewedCandidateCount)}`);
    console.log(`candidate status ignored: ${String(ignoredCandidateCount)}`);
    console.log(`candidate status reviewed: ${String(reviewedCandidateCount)}`);
  } finally {
    await client.close();
  }
}
