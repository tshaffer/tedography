import {
  DUPLICATE_CANDIDATE_GENERATION_VERSION_V1,
  IMAGE_ANALYSIS_VERSION_V1,
  canonicalizeAssetPair,
  scoreCandidatePair,
  type AnalysisSourceType,
  type DuplicateCandidateClassification,
  type DuplicateCandidateStatus
} from '@tedography/duplicate-domain';
import { hammingDistance } from '@tedography/image-analysis';
import mongoose from 'mongoose';
import { requireEnv } from '../support/assetSource.js';

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

interface DuplicateCandidatePairCollectionRecord {
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
  score: number;
  classification: DuplicateCandidateClassification;
  status: DuplicateCandidateStatus;
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

export interface GenerateCandidatesCommandOptions {
  analysisVersion?: string;
  generationVersion?: string;
  limit?: number;
  assetId?: string;
  onlyMissing?: boolean;
}

interface GenerationSummary {
  analysesConsidered: number;
  analysesSkippedNotReady: number;
  analysesSkippedMissingHashes: number;
  pairsCompared: number;
  pairsSkippedExisting: number;
  pairsSkippedNoSignals: number;
  candidatePairsWritten: number;
  veryLikelyDuplicateCount: number;
  possibleDuplicateCount: number;
  similarImageCount: number;
}

function bitLengthForHex(hash: string | undefined): number | undefined {
  return hash ? hash.length * 4 : undefined;
}

function toDate(value: Date | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

export async function runGenerateCandidatesCommand(
  options: GenerateCandidatesCommandOptions
): Promise<void> {
  const mongoUri = requireEnv('MONGODB_URI');
  const analysisVersion = options.analysisVersion?.trim() || IMAGE_ANALYSIS_VERSION_V1;
  const generationVersion =
    options.generationVersion?.trim() || DUPLICATE_CANDIDATE_GENERATION_VERSION_V1;
  const assetIdFilter = options.assetId?.trim();
  const limit = options.limit;
  const onlyMissing = options.onlyMissing === true;
  const client = new mongoose.mongo.MongoClient(mongoUri);
  const summary: GenerationSummary = {
    analysesConsidered: 0,
    analysesSkippedNotReady: 0,
    analysesSkippedMissingHashes: 0,
    pairsCompared: 0,
    pairsSkippedExisting: 0,
    pairsSkippedNoSignals: 0,
    candidatePairsWritten: 0,
    veryLikelyDuplicateCount: 0,
    possibleDuplicateCount: 0,
    similarImageCount: 0
  };

  try {
    await client.connect();
    const database = client.db();
    const imageAnalysesCollection = database.collection<ImageAnalysisCollectionRecord>('imageAnalyses');
    const duplicateCandidatePairsCollection =
      database.collection<DuplicateCandidatePairCollectionRecord>('duplicateCandidatePairs');

    const allAnalyses = await imageAnalysesCollection
      .find({ analysisVersion }, { projection: { _id: 0 } })
      .toArray();

    const readyAnalyses = allAnalyses.filter((analysis) => {
      if (analysis.normalizedFingerprintStatus !== 'ready') {
        summary.analysesSkippedNotReady += 1;
        return false;
      }

      if (!analysis.dHash && !analysis.pHash) {
        summary.analysesSkippedMissingHashes += 1;
        return false;
      }

      return true;
    });

    summary.analysesConsidered = readyAnalyses.length;

    if (assetIdFilter) {
      const target = readyAnalyses.find((analysis) => analysis.assetId === assetIdFilter);
      if (!target) {
        throw new Error(
          `No ready image analysis found for asset ${assetIdFilter} at analysis version ${analysisVersion}`
        );
      }

      const peers = readyAnalyses.filter((analysis) => analysis.assetId !== assetIdFilter);
      const scopedPeers = limit !== undefined ? peers.slice(0, limit) : peers;

      for (const peer of scopedPeers) {
        await compareAndPersistCandidatePair(
          target,
          peer,
          analysisVersion,
          generationVersion,
          duplicateCandidatePairsCollection,
          summary,
          onlyMissing
        );
      }
    } else {
      const analyses = limit !== undefined ? readyAnalyses.slice(0, limit) : readyAnalyses;

      for (let leftIndex = 0; leftIndex < analyses.length; leftIndex += 1) {
        const left = analyses[leftIndex];
        if (!left) {
          continue;
        }

        for (let rightIndex = leftIndex + 1; rightIndex < analyses.length; rightIndex += 1) {
          const right = analyses[rightIndex];
          if (!right) {
            continue;
          }

          await compareAndPersistCandidatePair(
            left,
            right,
            analysisVersion,
            generationVersion,
            duplicateCandidatePairsCollection,
            summary,
            onlyMissing
          );
        }
      }
    }
  } finally {
    await client.close();
  }

  console.log(`analysis version: ${analysisVersion}`);
  console.log(`generation version: ${generationVersion}`);
  console.log(`analyses considered: ${String(summary.analysesConsidered)}`);
  console.log(`analyses skipped not ready: ${String(summary.analysesSkippedNotReady)}`);
  console.log(`analyses skipped missing hashes: ${String(summary.analysesSkippedMissingHashes)}`);
  console.log(`pairs compared: ${String(summary.pairsCompared)}`);
  console.log(`pairs skipped existing: ${String(summary.pairsSkippedExisting)}`);
  console.log(`pairs skipped no signals: ${String(summary.pairsSkippedNoSignals)}`);
  console.log(`candidate pairs written: ${String(summary.candidatePairsWritten)}`);
  console.log(`very likely duplicate: ${String(summary.veryLikelyDuplicateCount)}`);
  console.log(`possible duplicate: ${String(summary.possibleDuplicateCount)}`);
  console.log(`similar image: ${String(summary.similarImageCount)}`);
}

async function compareAndPersistCandidatePair(
  left: ImageAnalysisCollectionRecord,
  right: ImageAnalysisCollectionRecord,
  analysisVersion: string,
  generationVersion: string,
  duplicateCandidatePairsCollection: mongoose.mongo.Collection<DuplicateCandidatePairCollectionRecord>,
  summary: GenerationSummary,
  onlyMissing: boolean
): Promise<void> {
  const canonicalPair = canonicalizeAssetPair(left.assetId, right.assetId);

  if (onlyMissing) {
    const existing = await duplicateCandidatePairsCollection.findOne(
      {
        assetIdA: canonicalPair.assetIdA,
        assetIdB: canonicalPair.assetIdB,
        analysisVersion,
        generationVersion
      },
      { projection: { _id: 0, assetIdA: 1 } }
    );

    if (existing) {
      summary.pairsSkippedExisting += 1;
      return;
    }
  }

  let dHashDistance: number | undefined;
  let pHashDistance: number | undefined;

  if (left.dHash && right.dHash) {
    dHashDistance = hammingDistance(left.dHash, right.dHash);
  }

  if (left.pHash && right.pHash) {
    pHashDistance = hammingDistance(left.pHash, right.pHash);
  }

  const leftUpdatedAt = toDate(left.sourceUpdatedAt);
  const rightUpdatedAt = toDate(right.sourceUpdatedAt);
  const sourceUpdatedTimeDeltaMs =
    leftUpdatedAt && rightUpdatedAt ? Math.abs(leftUpdatedAt.getTime() - rightUpdatedAt.getTime()) : undefined;

  const scoringInput: Parameters<typeof scoreCandidatePair>[0] = {};

  if (dHashDistance !== undefined) {
    scoringInput.dHashDistance = dHashDistance;
  }
  const dHashBitLength = bitLengthForHex(left.dHash);
  if (dHashBitLength !== undefined) {
    scoringInput.dHashBitLength = dHashBitLength;
  }
  if (pHashDistance !== undefined) {
    scoringInput.pHashDistance = pHashDistance;
  }
  const pHashBitLength = bitLengthForHex(left.pHash);
  if (pHashBitLength !== undefined) {
    scoringInput.pHashBitLength = pHashBitLength;
  }
  if (left.width !== undefined) {
    scoringInput.width = left.width;
  }
  if (left.height !== undefined) {
    scoringInput.height = left.height;
  }
  if (right.width !== undefined) {
    scoringInput.otherWidth = right.width;
  }
  if (right.height !== undefined) {
    scoringInput.otherHeight = right.height;
  }
  if (sourceUpdatedTimeDeltaMs !== undefined) {
    scoringInput.sourceUpdatedTimeDeltaMs = sourceUpdatedTimeDeltaMs;
  }

  const scored = scoreCandidatePair(scoringInput);

  summary.pairsCompared += 1;

  if (!scored) {
    summary.pairsSkippedNoSignals += 1;
    return;
  }

  await duplicateCandidatePairsCollection.updateOne(
    {
      assetIdA: canonicalPair.assetIdA,
      assetIdB: canonicalPair.assetIdB,
      analysisVersion,
      generationVersion
    },
    {
      $set: {
        score: scored.score,
        classification: scored.classification,
        signals: scored.signals
      },
      $setOnInsert: {
        status: 'unreviewed',
        createdAt: new Date()
      },
      $currentDate: {
        updatedAt: true
      }
    },
    { upsert: true }
  );

  summary.candidatePairsWritten += 1;
  if (scored.classification === 'very_likely_duplicate') {
    summary.veryLikelyDuplicateCount += 1;
  } else if (scored.classification === 'possible_duplicate') {
    summary.possibleDuplicateCount += 1;
  } else {
    summary.similarImageCount += 1;
  }
}
