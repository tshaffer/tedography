import { type MediaAsset } from '@tedography/domain';
import { type DuplicateCandidatePairDocument } from '../models/duplicateCandidatePairModel.js';
import type {
  BulkReviewDuplicateCandidatePairsResponse,
  DuplicateCandidateOutcomeFilter,
  DuplicateCandidatePairAssetSummary,
  DuplicateCandidatePairListItem,
  DuplicateCandidatePairSummaryResponse,
  DuplicateCandidateReviewDecision,
  GetDuplicateCandidatePairResponse,
  ListDuplicateCandidatePairsResponse,
  UpdateDuplicateCandidatePairReviewResponse
} from '@tedography/shared';
import { findByIds } from '../repositories/assetRepository.js';
import {
  getDuplicateCandidatePairSummary,
  findDuplicateCandidatePair,
  listDuplicateCandidatePairs,
  updateDuplicateCandidatePairReview,
  type FindDuplicateCandidatePairInput
} from '../repositories/duplicateCandidatePairRepository.js';
import { findDuplicateGroupResolutionByKey } from '../repositories/duplicateGroupResolutionRepository.js';
import {
  listDerivedDuplicateGroups,
  updateDerivedDuplicateGroupResolution
} from './duplicateGroupService.js';

const pairKeySeparator = '__';

export interface ListDuplicateCandidatePairsOptions {
  status?: 'unreviewed' | 'ignored' | 'reviewed';
  classification?: 'very_likely_duplicate' | 'possible_duplicate' | 'similar_image';
  outcome?: DuplicateCandidateOutcomeFilter;
  assetId?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}

function toAssetSummary(asset: MediaAsset | null): DuplicateCandidatePairAssetSummary | null {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    originalArchivePath:
      typeof asset.originalArchivePath === 'string' && asset.originalArchivePath.length > 0
        ? asset.originalArchivePath
        : typeof asset.archivePath === 'string' && asset.archivePath.length > 0
          ? asset.archivePath
          : null,
    ...(asset.captureDateTime !== undefined ? { captureDateTime: asset.captureDateTime } : {}),
    ...(asset.width !== undefined ? { width: asset.width } : {}),
    ...(asset.height !== undefined ? { height: asset.height } : {}),
    ...(asset.originalFileFormat ? { originalFileFormat: asset.originalFileFormat } : {}),
    ...(asset.originalFileSizeBytes !== undefined
      ? { originalFileSizeBytes: asset.originalFileSizeBytes }
      : {})
  };
}

function buildAssetMap(assets: MediaAsset[]): Map<string, MediaAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export function createDuplicateCandidatePairKey(input: FindDuplicateCandidatePairInput): string {
  return [
    input.assetIdA,
    input.assetIdB,
    input.analysisVersion,
    input.generationVersion
  ].join(pairKeySeparator);
}

export function parseDuplicateCandidatePairKey(pairKey: string): FindDuplicateCandidatePairInput | null {
  const parts = pairKey.split(pairKeySeparator);
  if (parts.length !== 4 || parts.some((part) => part.trim().length === 0)) {
    return null;
  }

  const assetIdA = parts[0];
  const assetIdB = parts[1];
  const analysisVersion = parts[2];
  const generationVersion = parts[3];
  if (!assetIdA || !assetIdB || !analysisVersion || !generationVersion) {
    return null;
  }

  return { assetIdA, assetIdB, analysisVersion, generationVersion };
}

function toListItem(
  pair: DuplicateCandidatePairDocument,
  assetMap: Map<string, MediaAsset>
): DuplicateCandidatePairListItem {
  return {
    pairKey: createDuplicateCandidatePairKey(pair),
    assetIdA: pair.assetIdA,
    assetIdB: pair.assetIdB,
    analysisVersion: pair.analysisVersion,
    generationVersion: pair.generationVersion,
    score: pair.score,
    classification: pair.classification,
    status: pair.status,
    outcome: pair.outcome ?? null,
    signals: pair.signals,
    ...(pair.createdAt ? { createdAt: pair.createdAt.toISOString() } : {}),
    ...(pair.updatedAt ? { updatedAt: pair.updatedAt.toISOString() } : {}),
    assetA: toAssetSummary(assetMap.get(pair.assetIdA) ?? null),
    assetB: toAssetSummary(assetMap.get(pair.assetIdB) ?? null)
  };
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return 20;
  }

  return Math.min(value, 100);
}

function normalizeOffset(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    return 0;
  }

  return value;
}

export async function listDuplicateCandidatePairsForReview(
  options: ListDuplicateCandidatePairsOptions
): Promise<ListDuplicateCandidatePairsResponse> {
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const result = await listDuplicateCandidatePairs({
    status: options.status ?? 'unreviewed',
    ...(options.classification ? { classification: options.classification } : {}),
    ...(options.outcome ? { outcome: options.outcome } : {}),
    ...(options.assetId ? { assetId: options.assetId } : {}),
    ...(typeof options.minScore === 'number' ? { minScore: options.minScore } : {}),
    limit,
    offset
  });
  const assetIds = Array.from(
    new Set(result.items.flatMap((pair) => [pair.assetIdA, pair.assetIdB]))
  );
  const assets = await findByIds(assetIds);
  const assetMap = buildAssetMap(assets);

  return {
    items: result.items.map((pair) => toListItem(pair, assetMap)),
    total: result.total,
    limit,
    offset,
    hasMore: offset + result.items.length < result.total
  };
}

export async function getDuplicateCandidatePairQueueSummary(
  options: Pick<ListDuplicateCandidatePairsOptions, 'assetId' | 'minScore'>
): Promise<DuplicateCandidatePairSummaryResponse> {
  return getDuplicateCandidatePairSummary({
    ...(options.assetId ? { assetId: options.assetId } : {}),
    ...(typeof options.minScore === 'number' ? { minScore: options.minScore } : {})
  });
}

export async function getDuplicateCandidatePairForReview(
  pairKey: string
): Promise<GetDuplicateCandidatePairResponse | null> {
  const identity = parseDuplicateCandidatePairKey(pairKey);
  if (!identity) {
    return null;
  }

  const pair = await findDuplicateCandidatePair(identity);
  if (!pair) {
    return null;
  }

  const assets = await findByIds([pair.assetIdA, pair.assetIdB]);
  return {
    item: toListItem(pair, buildAssetMap(assets))
  };
}

export function mapDecisionToReviewUpdate(
  decision: DuplicateCandidateReviewDecision
): {
  status: 'reviewed' | 'ignored';
  outcome: 'confirmed_duplicate' | 'not_duplicate' | 'ignored' | null;
} {
  if (decision === 'reviewed_uncertain') {
    return { status: 'reviewed', outcome: null };
  }

  if (
    decision === 'confirmed_duplicate' ||
    decision === 'confirmed_duplicate_keep_both' ||
    decision === 'confirmed_duplicate_keep_left' ||
    decision === 'confirmed_duplicate_keep_right'
  ) {
    return { status: 'reviewed', outcome: 'confirmed_duplicate' };
  }

  if (decision === 'not_duplicate') {
    return { status: 'reviewed', outcome: 'not_duplicate' };
  }

  return { status: 'ignored', outcome: 'ignored' };
}

function getKeeperAssetIdForDecision(input: {
  decision: DuplicateCandidateReviewDecision;
  pair: DuplicateCandidatePairDocument;
}): string | null {
  if (input.decision === 'confirmed_duplicate_keep_left') {
    return input.pair.assetIdA;
  }

  if (input.decision === 'confirmed_duplicate_keep_right') {
    return input.pair.assetIdB;
  }

  return null;
}

async function syncDuplicateGroupResolutionForReviewDecision(
  pair: DuplicateCandidatePairDocument,
  decision: DuplicateCandidateReviewDecision
): Promise<void> {
  const groupsResponse = await listDerivedDuplicateGroups({
    assetId: pair.assetIdA
  });
  const group = groupsResponse.groups.find(
    (candidate) =>
      candidate.assetIds.includes(pair.assetIdA) &&
      candidate.assetIds.includes(pair.assetIdB)
  );

  if (!group) {
    return;
  }

  const keeperAssetId = getKeeperAssetIdForDecision({ decision, pair });
  if (keeperAssetId) {
    await updateDerivedDuplicateGroupResolution(group.groupKey, {
      canonicalAssetId: keeperAssetId,
      resolutionStatus: 'confirmed'
    });
    return;
  }

  if (decision === 'confirmed_duplicate_keep_both') {
    const existingResolution = await findDuplicateGroupResolutionByKey(group.groupKey);
    if (existingResolution) {
      await updateDerivedDuplicateGroupResolution(group.groupKey, {
        canonicalAssetId: group.proposedCanonicalAssetId,
        resolutionStatus: 'proposed'
      });
    }
  }
}

export async function reviewDuplicateCandidatePair(
  pairKey: string,
  decision: DuplicateCandidateReviewDecision
): Promise<UpdateDuplicateCandidatePairReviewResponse | null> {
  const identity = parseDuplicateCandidatePairKey(pairKey);
  if (!identity) {
    return null;
  }

  const reviewUpdate = mapDecisionToReviewUpdate(decision);
  const pair = await updateDuplicateCandidatePairReview({
    ...identity,
    ...reviewUpdate
  });
  if (!pair) {
    return null;
  }

  await syncDuplicateGroupResolutionForReviewDecision(pair, decision);

  const assets = await findByIds([pair.assetIdA, pair.assetIdB]);
  return {
    item: toListItem(pair, buildAssetMap(assets))
  };
}

export async function bulkReviewDuplicateCandidatePairs(
  pairKeys: string[],
  decision: DuplicateCandidateReviewDecision
): Promise<BulkReviewDuplicateCandidatePairsResponse> {
  const uniquePairKeys = Array.from(new Set(pairKeys.filter((value) => value.trim().length > 0)));
  let updatedCount = 0;

  for (const pairKey of uniquePairKeys) {
    const reviewed = await reviewDuplicateCandidatePair(pairKey, decision);
    if (reviewed) {
      updatedCount += 1;
    }
  }

  return {
    updatedCount,
    pairKeys: uniquePairKeys
  };
}
