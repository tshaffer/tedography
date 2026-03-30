import { DuplicateCandidatePairModel, type DuplicateCandidatePairDocument } from '../models/duplicateCandidatePairModel.js';

export interface UpsertDuplicateCandidatePairInput {
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
  score: number;
  classification: DuplicateCandidatePairDocument['classification'];
  signals: DuplicateCandidatePairDocument['signals'];
}

export interface DuplicateCandidatePairStats {
  totalCandidatePairs: number;
  veryLikelyDuplicateCount: number;
  possibleDuplicateCount: number;
  similarImageCount: number;
  unreviewedCount: number;
  ignoredCount: number;
  reviewedCount: number;
}

export interface ListDuplicateCandidatePairsInput {
  status?: DuplicateCandidatePairDocument['status'];
  classification?: DuplicateCandidatePairDocument['classification'];
  outcome?: DuplicateCandidatePairDocument['outcome'] | 'none';
  assetId?: string;
  minScore?: number;
  limit: number;
  offset: number;
}

export interface ListDuplicateCandidatePairsResult {
  items: DuplicateCandidatePairDocument[];
  total: number;
}

export interface FindDuplicateCandidatePairInput {
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
}

export interface DuplicateCandidatePairSummary {
  total: number;
  highConfidenceCount: number;
  classificationCounts: Record<DuplicateCandidatePairDocument['classification'], number>;
  statusCounts: Record<DuplicateCandidatePairDocument['status'], number>;
  outcomeCounts: Record<'confirmed_duplicate' | 'not_duplicate' | 'ignored' | 'none', number>;
}

export interface DuplicateCandidatePairSummaryInput {
  assetId?: string;
  minScore?: number;
}

export interface ListProvisionalDuplicateCandidatePairsInput {
  assetId?: string;
  minScore?: number;
}

export function buildDuplicateCandidatePairFilter(
  input: Omit<ListDuplicateCandidatePairsInput, 'limit' | 'offset'>
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.status) {
    filter.status = input.status;
  }

  if (input.classification) {
    filter.classification = input.classification;
  }

  if (input.outcome === 'none') {
    filter.outcome = null;
  } else if (input.outcome) {
    filter.outcome = input.outcome;
  }

  if (input.assetId) {
    filter.$or = [{ assetIdA: input.assetId }, { assetIdB: input.assetId }];
  }

  if (typeof input.minScore === 'number') {
    filter.score = { $gte: input.minScore };
  }

  return filter;
}

function buildDuplicateCandidatePairSummaryBaseFilter(
  input: DuplicateCandidatePairSummaryInput
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.assetId) {
    filter.$or = [{ assetIdA: input.assetId }, { assetIdB: input.assetId }];
  }

  if (typeof input.minScore === 'number') {
    filter.score = { $gte: input.minScore };
  }

  return filter;
}

export async function syncDuplicateCandidatePairIndexes(): Promise<void> {
  await DuplicateCandidatePairModel.syncIndexes();
}

export async function upsertDuplicateCandidatePair(
  input: UpsertDuplicateCandidatePairInput
): Promise<DuplicateCandidatePairDocument> {
  const updated = await DuplicateCandidatePairModel.findOneAndUpdate(
    {
      assetIdA: input.assetIdA,
      assetIdB: input.assetIdB,
      analysisVersion: input.analysisVersion,
      generationVersion: input.generationVersion
    },
    {
      $set: {
        score: input.score,
        classification: input.classification,
        signals: input.signals
      },
      $setOnInsert: {
        status: 'unreviewed'
      }
    },
    {
      upsert: true,
      new: true,
      projection: { _id: 0 }
    }
  ).lean<DuplicateCandidatePairDocument | null>();

  if (!updated) {
    throw new Error(
      `Failed to upsert duplicate candidate pair for assets ${input.assetIdA} and ${input.assetIdB}.`
    );
  }

  return updated;
}

export async function countDuplicateCandidatePairsForAsset(
  assetId: string,
  generationVersion?: string
): Promise<number> {
  return DuplicateCandidatePairModel.countDocuments({
    ...(generationVersion ? { generationVersion } : {}),
    $or: [{ assetIdA: assetId }, { assetIdB: assetId }]
  });
}

export async function getDuplicateCandidatePairStats(
  generationVersion?: string
): Promise<DuplicateCandidatePairStats> {
  const filter = generationVersion ? { generationVersion } : {};
  const [
    totalCandidatePairs,
    veryLikelyDuplicateCount,
    possibleDuplicateCount,
    similarImageCount,
    unreviewedCount,
    ignoredCount,
    reviewedCount
  ] = await Promise.all([
    DuplicateCandidatePairModel.countDocuments(filter),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'very_likely_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'possible_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'similar_image' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'unreviewed' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'ignored' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'reviewed' })
  ]);

  return {
    totalCandidatePairs,
    veryLikelyDuplicateCount,
    possibleDuplicateCount,
    similarImageCount,
    unreviewedCount,
    ignoredCount,
    reviewedCount
  };
}

export async function listDuplicateCandidatePairs(
  input: ListDuplicateCandidatePairsInput
): Promise<ListDuplicateCandidatePairsResult> {
  const filter = buildDuplicateCandidatePairFilter(input);

  const [items, total] = await Promise.all([
    DuplicateCandidatePairModel.find(filter, { _id: 0 })
      .sort({ score: -1, updatedAt: -1, assetIdA: 1, assetIdB: 1 })
      .skip(input.offset)
      .limit(input.limit)
      .lean<DuplicateCandidatePairDocument[]>(),
    DuplicateCandidatePairModel.countDocuments(filter)
  ]);

  return { items, total };
}

export async function getDuplicateCandidatePairSummary(
  input: DuplicateCandidatePairSummaryInput
): Promise<DuplicateCandidatePairSummary> {
  const filter = buildDuplicateCandidatePairSummaryBaseFilter(input);
  const [
    total,
    highConfidenceCount,
    veryLikelyDuplicateCount,
    possibleDuplicateCount,
    similarImageCount,
    unreviewedCount,
    ignoredStatusCount,
    reviewedCount,
    confirmedDuplicateCount,
    notDuplicateCount,
    ignoredOutcomeCount,
    unresolvedCount
  ] = await Promise.all([
    DuplicateCandidatePairModel.countDocuments(filter),
    DuplicateCandidatePairModel.countDocuments({ ...filter, score: { $gte: 0.9 } }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'very_likely_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'possible_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, classification: 'similar_image' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'unreviewed' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'ignored' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, status: 'reviewed' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, outcome: 'confirmed_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, outcome: 'not_duplicate' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, outcome: 'ignored' }),
    DuplicateCandidatePairModel.countDocuments({ ...filter, outcome: null })
  ]);

  return {
    total,
    highConfidenceCount,
    classificationCounts: {
      very_likely_duplicate: veryLikelyDuplicateCount,
      possible_duplicate: possibleDuplicateCount,
      similar_image: similarImageCount
    },
    statusCounts: {
      unreviewed: unreviewedCount,
      ignored: ignoredStatusCount,
      reviewed: reviewedCount
    },
    outcomeCounts: {
      confirmed_duplicate: confirmedDuplicateCount,
      not_duplicate: notDuplicateCount,
      ignored: ignoredOutcomeCount,
      none: unresolvedCount
    }
  };
}

export async function findDuplicateCandidatePair(
  input: FindDuplicateCandidatePairInput
): Promise<DuplicateCandidatePairDocument | null> {
  return DuplicateCandidatePairModel.findOne(
    {
      assetIdA: input.assetIdA,
      assetIdB: input.assetIdB,
      analysisVersion: input.analysisVersion,
      generationVersion: input.generationVersion
    },
    { _id: 0 }
  ).lean<DuplicateCandidatePairDocument | null>();
}

export async function updateDuplicateCandidatePairReview(
  input: FindDuplicateCandidatePairInput & {
    status: DuplicateCandidatePairDocument['status'];
    outcome?: DuplicateCandidatePairDocument['outcome'];
  }
): Promise<DuplicateCandidatePairDocument | null> {
  return DuplicateCandidatePairModel.findOneAndUpdate(
    {
      assetIdA: input.assetIdA,
      assetIdB: input.assetIdB,
      analysisVersion: input.analysisVersion,
      generationVersion: input.generationVersion
    },
    {
      $set: {
        status: input.status,
        outcome: input.outcome ?? null
      }
    },
    {
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateCandidatePairDocument | null>();
}

export async function listConfirmedDuplicatePairs(
  assetId?: string
): Promise<DuplicateCandidatePairDocument[]> {
  const filter: Record<string, unknown> = {
    status: 'reviewed',
    outcome: 'confirmed_duplicate'
  };

  if (assetId) {
    filter.$or = [{ assetIdA: assetId }, { assetIdB: assetId }];
  }

  return DuplicateCandidatePairModel.find(filter, { _id: 0 })
    .sort({ score: -1, assetIdA: 1, assetIdB: 1 })
    .lean<DuplicateCandidatePairDocument[]>();
}

export async function listProvisionalDuplicateCandidatePairs(
  input: ListProvisionalDuplicateCandidatePairsInput = {}
): Promise<DuplicateCandidatePairDocument[]> {
  const filter: Record<string, unknown> = {
    classification: { $in: ['very_likely_duplicate', 'possible_duplicate'] },
    status: { $ne: 'ignored' },
    outcome: { $ne: 'not_duplicate' }
  };

  if (input.assetId) {
    filter.$or = [{ assetIdA: input.assetId }, { assetIdB: input.assetId }];
  }

  if (typeof input.minScore === 'number') {
    filter.score = { $gte: input.minScore };
  }

  return DuplicateCandidatePairModel.find(filter, { _id: 0 })
    .sort({ score: -1, updatedAt: -1, assetIdA: 1, assetIdB: 1 })
    .lean<DuplicateCandidatePairDocument[]>();
}
