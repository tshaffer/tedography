import { PhotoState, type MediaAsset } from '@tedography/domain';
import type {
  DuplicateGroupListItem,
  DuplicateGroupListSummary,
  DuplicateProvisionalGroupReviewStatus,
  DuplicateProvisionalGroupMemberDecision,
  ProvisionalDuplicateGroupListItem,
  GetProvisionalDuplicateGroupResponse,
  ListDuplicateGroupsResponse,
  ListProvisionalDuplicateGroupsResponse,
  ResolveProvisionalDuplicateGroupRequest,
  ResolveProvisionalDuplicateGroupResponse,
  ReopenProvisionalDuplicateGroupResponse
} from '@tedography/shared';
import { findByIds } from '../repositories/assetRepository.js';
import {
  deleteDuplicateGroupResolutionByKey,
  deleteDuplicateGroupResolutionsByOverlappingAssetIds,
  findDuplicateGroupResolutionByKey,
  listDuplicateGroupResolutions,
  upsertDuplicateGroupResolution
} from '../repositories/duplicateGroupResolutionRepository.js';
import {
  listDuplicateCandidatePairsForAssetIds,
  listConfirmedDuplicatePairs,
  listReviewedDuplicateCandidatePairsForAssets,
  listProvisionalDuplicateCandidatePairsForAssetIds,
  listProvisionalDuplicateCandidatePairs,
  updateDuplicateCandidatePairReviewByAssetIds
} from '../repositories/duplicateCandidatePairRepository.js';

interface DerivedDuplicateGroup {
  assetIds: string[];
  pairKeys: string[];
}

interface ProvisionalDuplicateGroupCacheEntry {
  groups: DerivedDuplicateGroup[];
  cachedAt: number;
}

export interface ListDerivedDuplicateGroupsOptions {
  assetId?: string;
  resolutionStatus?: 'proposed' | 'confirmed';
  exactAssetCount?: number;
  minAssetCount?: number;
  readyToConfirmOnly?: boolean;
  sort?: 'unresolved_first' | 'size_asc' | 'size_desc';
}

export interface ListProvisionalDuplicateGroupsOptions {
  assetId?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}

interface CanonicalCandidateScore {
  prefersArchiveDisplay: number;
  resolutionPixels: number;
  originalFormatRank: number;
  metadataFieldCount: number;
  photoStateRank: number;
  fileSizeBytes: number;
}

const provisionalDuplicateGroupCacheTtlMs = 5 * 60 * 1000;
const provisionalDuplicateGroupCache = new Map<string, ProvisionalDuplicateGroupCacheEntry>();

function buildProvisionalDuplicateGroupCacheKey(
  options: Pick<ListProvisionalDuplicateGroupsOptions, 'assetId' | 'minScore'>
): string {
  return `${options.assetId ?? ''}::${typeof options.minScore === 'number' ? options.minScore : ''}`;
}

export function resolveSelectedCanonicalAssetId(input: {
  assetIds: string[];
  proposedCanonicalAssetId: string;
  manualCanonicalAssetId?: string | null;
}): string {
  if (input.manualCanonicalAssetId && input.assetIds.includes(input.manualCanonicalAssetId)) {
    return input.manualCanonicalAssetId;
  }

  return input.proposedCanonicalAssetId;
}

const preferredOriginalFormatRanks = new Map<string, number>([
  ['dng', 0],
  ['cr3', 1],
  ['cr2', 2],
  ['nef', 3],
  ['arw', 4],
  ['raf', 5],
  ['orf', 6],
  ['rw2', 7],
  ['tif', 8],
  ['tiff', 9],
  ['heic', 10],
  ['heif', 11],
  ['jpg', 12],
  ['jpeg', 12],
  ['png', 13]
]);

function compareAssetIds(a: string, b: string): number {
  return a.localeCompare(b);
}

function getPhotoStateRank(photoState: PhotoState | undefined): number {
  if (photoState === PhotoState.Keep) {
    return 4;
  }

  if (photoState === PhotoState.Pending) {
    return 3;
  }

  if (photoState === PhotoState.New) {
    return 2;
  }

  if (photoState === PhotoState.Discard) {
    return 0;
  }

  return 1;
}

function getOriginalFormatRank(format: string | undefined): number {
  if (!format) {
    return Number.MAX_SAFE_INTEGER;
  }

  return preferredOriginalFormatRanks.get(format.toLowerCase()) ?? 50;
}

function getMetadataFieldCount(asset: MediaAsset): number {
  return [
    asset.captureDateTime,
    asset.locationLabel,
    asset.locationLatitude,
    asset.locationLongitude
  ].filter((value) => value !== undefined && value !== null && value !== '').length;
}

function buildCanonicalCandidateScore(asset: MediaAsset): CanonicalCandidateScore {
  return {
    prefersArchiveDisplay: asset.displayStorageType === 'archive-root' ? 1 : 0,
    resolutionPixels: Math.max(0, (asset.width ?? 0) * (asset.height ?? 0)),
    originalFormatRank: getOriginalFormatRank(asset.originalFileFormat),
    metadataFieldCount: getMetadataFieldCount(asset),
    photoStateRank: getPhotoStateRank(asset.photoState),
    fileSizeBytes: asset.originalFileSizeBytes
  };
}

function compareCanonicalCandidateScore(left: MediaAsset, right: MediaAsset): number {
  const leftScore = buildCanonicalCandidateScore(left);
  const rightScore = buildCanonicalCandidateScore(right);

  if (leftScore.prefersArchiveDisplay !== rightScore.prefersArchiveDisplay) {
    return rightScore.prefersArchiveDisplay - leftScore.prefersArchiveDisplay;
  }

  if (leftScore.resolutionPixels !== rightScore.resolutionPixels) {
    return rightScore.resolutionPixels - leftScore.resolutionPixels;
  }

  if (leftScore.originalFormatRank !== rightScore.originalFormatRank) {
    return leftScore.originalFormatRank - rightScore.originalFormatRank;
  }

  if (leftScore.metadataFieldCount !== rightScore.metadataFieldCount) {
    return rightScore.metadataFieldCount - leftScore.metadataFieldCount;
  }

  if (leftScore.photoStateRank !== rightScore.photoStateRank) {
    return rightScore.photoStateRank - leftScore.photoStateRank;
  }

  if (leftScore.fileSizeBytes !== rightScore.fileSizeBytes) {
    return rightScore.fileSizeBytes - leftScore.fileSizeBytes;
  }

  return left.id.localeCompare(right.id);
}

export function buildDuplicateGroupKey(assetIds: string[]): string {
  return [...assetIds].sort(compareAssetIds).join('__');
}

export function deriveDuplicateGroups(
  pairs: Array<{ assetIdA: string; assetIdB: string }>
): DerivedDuplicateGroup[] {
  const adjacency = new Map<string, Set<string>>();

  for (const pair of pairs) {
    const neighborsA = adjacency.get(pair.assetIdA) ?? new Set<string>();
    neighborsA.add(pair.assetIdB);
    adjacency.set(pair.assetIdA, neighborsA);

    const neighborsB = adjacency.get(pair.assetIdB) ?? new Set<string>();
    neighborsB.add(pair.assetIdA);
    adjacency.set(pair.assetIdB, neighborsB);
  }

  const visited = new Set<string>();
  const groups: DerivedDuplicateGroup[] = [];

  for (const assetId of adjacency.keys()) {
    if (visited.has(assetId)) {
      continue;
    }

    const stack = [assetId];
    const groupAssetIds: string[] = [];
    const pairKeys = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      groupAssetIds.push(current);

      const neighbors = adjacency.get(current) ?? new Set<string>();
      for (const neighbor of neighbors) {
        pairKeys.add([current, neighbor].sort(compareAssetIds).join('__'));
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    groups.push({
      assetIds: groupAssetIds.sort(compareAssetIds),
      pairKeys: Array.from(pairKeys).sort()
    });
  }

  return groups.sort((left, right) => {
    if (right.assetIds.length !== left.assetIds.length) {
      return right.assetIds.length - left.assetIds.length;
    }

    return left.assetIds[0]?.localeCompare(right.assetIds[0] ?? '') ?? 0;
  });
}

export function selectProposedCanonicalAsset(assets: MediaAsset[]): {
  canonicalAssetId: string;
  reasonSummary: string[];
} {
  const sortedAssets = [...assets].sort(compareCanonicalCandidateScore);
  const selected = sortedAssets[0];

  if (!selected) {
    throw new Error('Cannot select a canonical asset from an empty duplicate group.');
  }

  const reasonSummary: string[] = [];
  const selectedScore = buildCanonicalCandidateScore(selected);
  const otherAssets = sortedAssets.slice(1);

  if (
    selected.displayStorageType === 'archive-root' &&
    otherAssets.some((asset) => asset.displayStorageType !== 'archive-root')
  ) {
    reasonSummary.push('Prefers archive-root display over derived-root display.');
  }

  if (
    otherAssets.every(
      (asset) => selectedScore.resolutionPixels >= buildCanonicalCandidateScore(asset).resolutionPixels
    ) &&
    otherAssets.some(
      (asset) => selectedScore.resolutionPixels > buildCanonicalCandidateScore(asset).resolutionPixels
    )
  ) {
    reasonSummary.push('Has the highest available resolution in the group.');
  }

  if (
    otherAssets.every(
      (asset) => selectedScore.originalFormatRank <= buildCanonicalCandidateScore(asset).originalFormatRank
    ) &&
    selected.originalFileFormat
  ) {
    reasonSummary.push(`Prefers original file format ${selected.originalFileFormat.toUpperCase()}.`);
  }

  if (
    otherAssets.every(
      (asset) => selectedScore.metadataFieldCount >= buildCanonicalCandidateScore(asset).metadataFieldCount
    ) &&
    selectedScore.metadataFieldCount > 0
  ) {
    reasonSummary.push('Has the richest available capture/location metadata.');
  }

  if (
    otherAssets.every(
      (asset) => selectedScore.photoStateRank >= buildCanonicalCandidateScore(asset).photoStateRank
    ) &&
    selected.photoState
  ) {
    reasonSummary.push(`Has the strongest photo state signal (${selected.photoState}).`);
  }

  if (reasonSummary.length === 0) {
    reasonSummary.push('Uses deterministic fallback ordering to break ties.');
  }

  return {
    canonicalAssetId: selected.id,
    reasonSummary
  };
}

function toAssetSummary(asset: MediaAsset) {
  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    originalArchivePath: asset.originalArchivePath ?? asset.archivePath ?? null,
    ...(asset.captureDateTime !== undefined ? { captureDateTime: asset.captureDateTime } : {}),
    ...(asset.width !== undefined ? { width: asset.width } : {}),
    ...(asset.height !== undefined ? { height: asset.height } : {}),
    ...(asset.photoState !== undefined ? { photoState: asset.photoState } : {}),
    ...(asset.originalFileFormat ? { originalFileFormat: asset.originalFileFormat } : {}),
    ...(asset.originalFileSizeBytes !== undefined
      ? { originalFileSizeBytes: asset.originalFileSizeBytes }
      : {}),
    ...(asset.displayStorageType ? { displayStorageType: asset.displayStorageType } : {})
  };
}

function toProvisionalGroupMemberAssetSummary(asset: MediaAsset) {
  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    originalArchivePath: asset.originalArchivePath ?? asset.archivePath ?? null,
    ...(asset.captureDateTime !== undefined ? { captureDateTime: asset.captureDateTime } : {}),
    ...(asset.width !== undefined ? { width: asset.width } : {}),
    ...(asset.height !== undefined ? { height: asset.height } : {}),
    ...(asset.photoState !== undefined ? { photoState: asset.photoState } : {}),
    ...(asset.originalFileFormat ? { originalFileFormat: asset.originalFileFormat } : {}),
    ...(asset.originalFileSizeBytes !== undefined
      ? { originalFileSizeBytes: asset.originalFileSizeBytes }
      : {}),
    ...(asset.displayStorageType ? { displayStorageType: asset.displayStorageType } : {})
  };
}

function buildResolvedCanonicalAssetIdByAssetId(
  resolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const resolution of resolutions) {
    const selectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
      assetIds: resolution.assetIds,
      proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
      ...(resolution.manualCanonicalAssetId !== undefined
        ? { manualCanonicalAssetId: resolution.manualCanonicalAssetId }
        : {})
    });

    for (const assetId of resolution.assetIds) {
      map.set(assetId, selectedCanonicalAssetId);
    }
  }

  return map;
}

async function buildHistoricalCountsByAssetId(
  assetIds: string[],
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): Promise<
  Map<
    string,
    {
      keeperCount: number;
      duplicateCount: number;
      notDuplicateCount: number;
    }
  >
> {
  const countsByAssetId = new Map(
    assetIds.map((assetId) => [
      assetId,
      {
        keeperCount: 0,
        duplicateCount: 0,
        notDuplicateCount: 0
      }
    ])
  );
  const resolvedCanonicalAssetIdByAssetId = buildResolvedCanonicalAssetIdByAssetId(confirmedResolutions);
  const reviewedPairs = await listReviewedDuplicateCandidatePairsForAssets(assetIds);

  for (const pair of reviewedPairs) {
    const involvedAssetIds = [pair.assetIdA, pair.assetIdB].filter((assetId) => countsByAssetId.has(assetId));

    if ((pair.outcome ?? null) === 'not_duplicate') {
      for (const assetId of involvedAssetIds) {
        countsByAssetId.get(assetId)!.notDuplicateCount += 1;
      }
      continue;
    }

    if ((pair.outcome ?? null) !== 'confirmed_duplicate') {
      continue;
    }

    for (const assetId of involvedAssetIds) {
      const selectedCanonicalAssetId = resolvedCanonicalAssetIdByAssetId.get(assetId);
      if (selectedCanonicalAssetId && selectedCanonicalAssetId === assetId) {
        countsByAssetId.get(assetId)!.keeperCount += 1;
      } else {
        countsByAssetId.get(assetId)!.duplicateCount += 1;
      }
    }
  }

  return countsByAssetId;
}

async function buildDuplicateGroupListItem(group: DerivedDuplicateGroup): Promise<DuplicateGroupListItem> {
  const assets = await findByIds(group.assetIds);
  const sortedAssets = [...assets].sort((left, right) => group.assetIds.indexOf(left.id) - group.assetIds.indexOf(right.id));
  const proposedCanonical = selectProposedCanonicalAsset(sortedAssets);
  const groupKey = buildDuplicateGroupKey(group.assetIds);
  const persistedResolution = await findDuplicateGroupResolutionByKey(groupKey);
  const selectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
    assetIds: group.assetIds,
    proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
    ...(persistedResolution?.manualCanonicalAssetId !== undefined
      ? { manualCanonicalAssetId: persistedResolution.manualCanonicalAssetId }
      : {})
  });

  return {
    groupId: groupKey,
    groupKey,
    assetIds: group.assetIds,
    assetCount: group.assetIds.length,
    confirmedPairCount: group.pairKeys.length,
    assets: sortedAssets.map(toAssetSummary),
    proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
    selectedCanonicalAssetId,
    manualCanonicalAssetId:
      persistedResolution?.manualCanonicalAssetId &&
      group.assetIds.includes(persistedResolution.manualCanonicalAssetId)
        ? persistedResolution.manualCanonicalAssetId
        : null,
    resolutionStatus: persistedResolution?.resolutionStatus ?? 'proposed',
    nonCanonicalAssetIds: group.assetIds.filter((assetId) => assetId !== selectedCanonicalAssetId),
    canonicalReasonSummary: proposedCanonical.reasonSummary
  };
}

async function loadDerivedGroups(assetId?: string): Promise<DerivedDuplicateGroup[]> {
  const confirmedPairs = await listConfirmedDuplicatePairs(assetId);
  return deriveDuplicateGroups(confirmedPairs);
}

async function loadProvisionalGroups(
  options: ListProvisionalDuplicateGroupsOptions = {}
): Promise<DerivedDuplicateGroup[]> {
  const cacheKey = buildProvisionalDuplicateGroupCacheKey(options);
  const cached = provisionalDuplicateGroupCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= provisionalDuplicateGroupCacheTtlMs) {
    return cached.groups;
  }

  const candidatePairs = await listProvisionalDuplicateCandidatePairs({
    ...(options.assetId ? { assetId: options.assetId } : {}),
    ...(typeof options.minScore === 'number' ? { minScore: options.minScore } : {})
  });
  const groups = deriveDuplicateGroups(candidatePairs);
  provisionalDuplicateGroupCache.set(cacheKey, {
    groups,
    cachedAt: Date.now()
  });
  return groups;
}

function determineProvisionalGroupReviewStatus(input: {
  assetIds: string[];
  exactResolutionStatus?: 'proposed' | 'confirmed' | null;
  overlappingConfirmedResolutionCount: number;
}): DuplicateProvisionalGroupReviewStatus {
  if (input.exactResolutionStatus === 'confirmed') {
    return 'resolved';
  }

  if (input.overlappingConfirmedResolutionCount > 0) {
    return 'needs_rereview';
  }

  return 'unresolved';
}

function getProvisionalGroupReviewStatusRank(status: DuplicateProvisionalGroupReviewStatus): number {
  if (status === 'unresolved') {
    return 0;
  }

  if (status === 'needs_rereview') {
    return 1;
  }

  return 2;
}

function sortProvisionalDuplicateGroupListItems(
  groups: ProvisionalDuplicateGroupListItem[]
): ProvisionalDuplicateGroupListItem[] {
  return [...groups].sort((left, right) => {
    const statusRankDifference =
      getProvisionalGroupReviewStatusRank(left.reviewStatus) -
      getProvisionalGroupReviewStatusRank(right.reviewStatus);

    if (statusRankDifference !== 0) {
      return statusRankDifference;
    }

    if (right.assetCount !== left.assetCount) {
      return right.assetCount - left.assetCount;
    }

    return left.groupKey.localeCompare(right.groupKey);
  });
}

async function buildProvisionalDuplicateGroupListItem(
  group: DerivedDuplicateGroup,
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): Promise<ProvisionalDuplicateGroupListItem> {
  const [assets, historicalCountsByAssetId] = await Promise.all([
    findByIds(group.assetIds),
    buildHistoricalCountsByAssetId(group.assetIds, confirmedResolutions)
  ]);

  const exactGroupKey = buildDuplicateGroupKey(group.assetIds);
  const exactResolution =
    confirmedResolutions.find((resolution) => resolution.groupKey === exactGroupKey) ?? null;
  const overlappingConfirmedResolutions = confirmedResolutions.filter(
    (resolution) =>
      resolution.groupKey !== exactGroupKey &&
      resolution.assetIds.some((assetId) => group.assetIds.includes(assetId))
  );
  const proposedCanonical = selectProposedCanonicalAsset(assets);
  const selectedCanonicalAssetId = exactResolution
    ? resolveSelectedCanonicalAssetId({
        assetIds: group.assetIds,
        proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
        ...(exactResolution.manualCanonicalAssetId !== undefined
          ? { manualCanonicalAssetId: exactResolution.manualCanonicalAssetId }
          : {})
      })
    : null;
  const reviewStatus = determineProvisionalGroupReviewStatus({
    assetIds: group.assetIds,
    exactResolutionStatus: exactResolution?.resolutionStatus ?? null,
    overlappingConfirmedResolutionCount: overlappingConfirmedResolutions.length
  });

  const overlappingResolutionByAssetId = new Map<string, { selectedCanonicalAssetId: string }>();
  for (const resolution of overlappingConfirmedResolutions) {
    const resolvedCanonicalAssetId = resolveSelectedCanonicalAssetId({
      assetIds: resolution.assetIds,
      proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
      ...(resolution.manualCanonicalAssetId !== undefined
        ? { manualCanonicalAssetId: resolution.manualCanonicalAssetId }
        : {})
    });

    for (const assetId of resolution.assetIds) {
      overlappingResolutionByAssetId.set(assetId, {
        selectedCanonicalAssetId: resolvedCanonicalAssetId
      });
    }
  }

  return {
    groupKey: exactGroupKey,
    assetIds: group.assetIds,
    assetCount: group.assetIds.length,
    candidatePairCount: group.pairKeys.length,
    reviewStatus,
    selectedCanonicalAssetId,
    resolutionStatus: exactResolution?.resolutionStatus ?? null,
    members: assets.map((asset) => {
      let currentDecision: 'keeper' | 'duplicate' | 'unclassified' = 'unclassified';
      if (selectedCanonicalAssetId) {
        currentDecision = asset.id === selectedCanonicalAssetId ? 'keeper' : 'duplicate';
      } else {
        const overlappingResolution = overlappingResolutionByAssetId.get(asset.id);
        if (overlappingResolution) {
          currentDecision =
            asset.id === overlappingResolution.selectedCanonicalAssetId ? 'keeper' : 'duplicate';
        }
      }

      const historicalCounts = historicalCountsByAssetId.get(asset.id);
      if (historicalCounts) {
        return {
          asset: toProvisionalGroupMemberAssetSummary(asset),
          historicalCounts,
          currentDecision
        };
      }

      return {
        asset: toProvisionalGroupMemberAssetSummary(asset),
        currentDecision
      };
    })
  };
}

function buildLightweightProvisionalDuplicateGroupListItem(
  group: DerivedDuplicateGroup,
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): ProvisionalDuplicateGroupListItem {
  const exactGroupKey = buildDuplicateGroupKey(group.assetIds);
  const exactResolution =
    confirmedResolutions.find((resolution) => resolution.groupKey === exactGroupKey) ?? null;
  const overlappingConfirmedResolutionCount = confirmedResolutions.filter(
    (resolution) =>
      resolution.groupKey !== exactGroupKey &&
      resolution.assetIds.some((assetId) => group.assetIds.includes(assetId))
  ).length;

  return {
    groupKey: exactGroupKey,
    assetIds: group.assetIds,
    assetCount: group.assetIds.length,
    candidatePairCount: group.pairKeys.length,
    reviewStatus: determineProvisionalGroupReviewStatus({
      assetIds: group.assetIds,
      exactResolutionStatus: exactResolution?.resolutionStatus ?? null,
      overlappingConfirmedResolutionCount
    }),
    selectedCanonicalAssetId: exactResolution?.manualCanonicalAssetId ?? exactResolution?.proposedCanonicalAssetId ?? null,
    resolutionStatus: exactResolution?.resolutionStatus ?? null,
    members: []
  };
}

function parseProvisionalGroupKey(groupKey: string): string[] {
  return [...new Set(groupKey.split('__').map((assetId) => assetId.trim()).filter(Boolean))].sort(compareAssetIds);
}

function normalizeDecisionAssetIds(assetIds: string[]): string[] {
  return [...new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean))].sort(compareAssetIds);
}

function buildDecisionByAssetId(input: {
  assetIds: string[];
  keeperAssetId: string;
  duplicateAssetIds: string[];
  excludedAssetIds: string[];
}): Map<string, DuplicateProvisionalGroupMemberDecision> {
  const decisions = new Map<string, DuplicateProvisionalGroupMemberDecision>();

  for (const assetId of input.assetIds) {
    decisions.set(assetId, 'unclassified');
  }

  decisions.set(input.keeperAssetId, 'keeper');

  for (const assetId of input.duplicateAssetIds) {
    decisions.set(assetId, 'duplicate');
  }

  for (const assetId of input.excludedAssetIds) {
    decisions.set(assetId, 'not_in_group');
  }

  return decisions;
}

function validateResolveProvisionalDuplicateGroupInput(input: {
  assetIds: string[];
  keeperAssetId: string;
  duplicateAssetIds: string[];
  excludedAssetIds: string[];
}): void {
  if (!input.assetIds.includes(input.keeperAssetId)) {
    throw new Error(`Keeper asset ${input.keeperAssetId} is not part of provisional group.`);
  }

  const duplicateAssetIds = normalizeDecisionAssetIds(input.duplicateAssetIds);
  const excludedAssetIds = normalizeDecisionAssetIds(input.excludedAssetIds);
  const allClassifiedAssetIds = new Set<string>([input.keeperAssetId, ...duplicateAssetIds, ...excludedAssetIds]);

  if (allClassifiedAssetIds.size !== input.assetIds.length) {
    throw new Error('Every asset in the provisional duplicate group must be explicitly classified.');
  }

  for (const assetId of duplicateAssetIds) {
    if (!input.assetIds.includes(assetId)) {
      throw new Error(`Duplicate asset ${assetId} is not part of provisional group.`);
    }
  }

  for (const assetId of excludedAssetIds) {
    if (!input.assetIds.includes(assetId)) {
      throw new Error(`Excluded asset ${assetId} is not part of provisional group.`);
    }
  }

  if (duplicateAssetIds.includes(input.keeperAssetId) || excludedAssetIds.includes(input.keeperAssetId)) {
    throw new Error('Keeper asset cannot also be classified as duplicate or not in group.');
  }
}

export function filterDuplicateGroupListItems(
  groups: DuplicateGroupListItem[],
  options: Omit<ListDerivedDuplicateGroupsOptions, 'assetId' | 'sort'>
): DuplicateGroupListItem[] {
  return groups.filter((group) => {
    if (options.resolutionStatus && group.resolutionStatus !== options.resolutionStatus) {
      return false;
    }

    if (
      typeof options.exactAssetCount === 'number' &&
      Number.isInteger(options.exactAssetCount) &&
      group.assetCount !== options.exactAssetCount
    ) {
      return false;
    }

    if (
      typeof options.minAssetCount === 'number' &&
      Number.isInteger(options.minAssetCount) &&
      group.assetCount < options.minAssetCount
    ) {
      return false;
    }

    if (
      options.readyToConfirmOnly &&
      (group.resolutionStatus !== 'proposed' || group.selectedCanonicalAssetId !== group.proposedCanonicalAssetId)
    ) {
      return false;
    }

    return true;
  });
}

export function sortDuplicateGroupListItems(
  groups: DuplicateGroupListItem[],
  sort: ListDerivedDuplicateGroupsOptions['sort']
): DuplicateGroupListItem[] {
  const sorted = [...groups];

  sorted.sort((left, right) => {
    if (sort === 'size_asc') {
      if (left.assetCount !== right.assetCount) {
        return left.assetCount - right.assetCount;
      }
    } else if (sort === 'size_desc') {
      if (left.assetCount !== right.assetCount) {
        return right.assetCount - left.assetCount;
      }
    } else {
      if (left.resolutionStatus !== right.resolutionStatus) {
        return left.resolutionStatus === 'proposed' ? -1 : 1;
      }

      if (left.assetCount !== right.assetCount) {
        return left.assetCount - right.assetCount;
      }
    }

    return left.groupKey.localeCompare(right.groupKey);
  });

  return sorted;
}

export function summarizeDuplicateGroups(groups: DuplicateGroupListItem[]): DuplicateGroupListSummary {
  return {
    statusCounts: {
      proposed: groups.filter((group) => group.resolutionStatus === 'proposed').length,
      confirmed: groups.filter((group) => group.resolutionStatus === 'confirmed').length
    },
    exactPairGroupCount: groups.filter((group) => group.assetCount === 2).length,
    readyToConfirmCount: groups.filter(
      (group) =>
        group.resolutionStatus === 'proposed' &&
        group.selectedCanonicalAssetId === group.proposedCanonicalAssetId
    ).length
  };
}

export async function listDerivedDuplicateGroups(
  options: string | ListDerivedDuplicateGroupsOptions = {}
): Promise<ListDuplicateGroupsResponse> {
  const normalizedOptions =
    typeof options === 'string' ? { assetId: options } : options;
  const derivedGroups = await loadDerivedGroups(normalizedOptions.assetId);
  const builtGroups = await Promise.all(derivedGroups.map((group) => buildDuplicateGroupListItem(group)));
  const filteredGroups = filterDuplicateGroupListItems(builtGroups, normalizedOptions);
  const groups = sortDuplicateGroupListItems(filteredGroups, normalizedOptions.sort);
  const assetIds = Array.from(new Set(groups.flatMap((group) => group.assetIds)));

  return {
    groups,
    totalGroups: groups.length,
    totalAssets: assetIds.length,
    summary: summarizeDuplicateGroups(groups)
  };
}

export async function listProvisionalDuplicateGroups(
  options: ListProvisionalDuplicateGroupsOptions = {}
): Promise<ListProvisionalDuplicateGroupsResponse> {
  const groups = await loadProvisionalGroups(options);
  const confirmedResolutions = await listDuplicateGroupResolutions({ resolutionStatus: 'confirmed' });
  const normalizedOffset =
    typeof options.offset === 'number' && Number.isInteger(options.offset) && options.offset > 0
      ? options.offset
      : 0;
  const normalizedLimit =
    typeof options.limit === 'number' && Number.isInteger(options.limit) && options.limit > 0
      ? options.limit
      : 50;
  const sortedGroups = sortProvisionalDuplicateGroupListItems(
    groups.map((group) => buildLightweightProvisionalDuplicateGroupListItem(group, confirmedResolutions))
  );
  const builtGroups = sortedGroups.slice(normalizedOffset, normalizedOffset + normalizedLimit);
  const assetIds = Array.from(
    new Set(builtGroups.flatMap((group: ProvisionalDuplicateGroupListItem) => group.assetIds))
  );

  return {
    groups: builtGroups,
    totalGroups: sortedGroups.length,
    totalAssets: assetIds.length,
    limit: normalizedLimit,
    offset: normalizedOffset,
    hasMore: normalizedOffset + builtGroups.length < sortedGroups.length
  };
}

export async function getProvisionalDuplicateGroup(
  groupKey: string
): Promise<GetProvisionalDuplicateGroupResponse | null> {
  const assetIds = parseProvisionalGroupKey(groupKey);
  if (assetIds.length === 0) {
    return null;
  }

  const confirmedResolutions = await listDuplicateGroupResolutions({ resolutionStatus: 'confirmed' });
  const candidatePairs = await listProvisionalDuplicateCandidatePairsForAssetIds(assetIds);
  const pairKeys = candidatePairs.map((pair) => [pair.assetIdA, pair.assetIdB].sort(compareAssetIds).join('__'));

  return {
    group: await buildProvisionalDuplicateGroupListItem(
      {
        assetIds,
        pairKeys
      },
      confirmedResolutions
    )
  };
}

export function invalidateProvisionalDuplicateGroupCache(): void {
  provisionalDuplicateGroupCache.clear();
}

export async function resolveProvisionalDuplicateGroup(
  groupKey: string,
  input: ResolveProvisionalDuplicateGroupRequest
): Promise<ResolveProvisionalDuplicateGroupResponse | null> {
  const assetIds = parseProvisionalGroupKey(groupKey);
  if (assetIds.length === 0) {
    return null;
  }

  const duplicateAssetIds = normalizeDecisionAssetIds(input.duplicateAssetIds);
  const excludedAssetIds = normalizeDecisionAssetIds(input.excludedAssetIds);

  validateResolveProvisionalDuplicateGroupInput({
    assetIds,
    keeperAssetId: input.keeperAssetId,
    duplicateAssetIds,
    excludedAssetIds
  });

  const decisionByAssetId = buildDecisionByAssetId({
    assetIds,
    keeperAssetId: input.keeperAssetId,
    duplicateAssetIds,
    excludedAssetIds
  });
  const includedAssetIds = normalizeDecisionAssetIds([input.keeperAssetId, ...duplicateAssetIds]);
  const candidatePairs = await listDuplicateCandidatePairsForAssetIds(assetIds);

  await Promise.all(
    candidatePairs.map(async (pair) => {
      const decisionA = decisionByAssetId.get(pair.assetIdA) ?? 'unclassified';
      const decisionB = decisionByAssetId.get(pair.assetIdB) ?? 'unclassified';

      if (
        (decisionA === 'keeper' || decisionA === 'duplicate') &&
        (decisionB === 'keeper' || decisionB === 'duplicate')
      ) {
        await updateDuplicateCandidatePairReviewByAssetIds({
          assetIdA: pair.assetIdA,
          assetIdB: pair.assetIdB,
          status: 'reviewed',
          outcome: 'confirmed_duplicate'
        });
        return;
      }

      const isIncludedA = decisionA === 'keeper' || decisionA === 'duplicate';
      const isIncludedB = decisionB === 'keeper' || decisionB === 'duplicate';
      const isExcludedA = decisionA === 'not_in_group';
      const isExcludedB = decisionB === 'not_in_group';

      if ((isIncludedA && isExcludedB) || (isIncludedB && isExcludedA)) {
        await updateDuplicateCandidatePairReviewByAssetIds({
          assetIdA: pair.assetIdA,
          assetIdB: pair.assetIdB,
          status: 'reviewed',
          outcome: 'not_duplicate'
        });
      }
    })
  );

  await deleteDuplicateGroupResolutionsByOverlappingAssetIds(assetIds);
  invalidateProvisionalDuplicateGroupCache();

  if (includedAssetIds.length >= 2) {
    const includedAssets = await findByIds(includedAssetIds);
    const proposedCanonical = selectProposedCanonicalAsset(includedAssets);
    const resolvedGroupKey = buildDuplicateGroupKey(includedAssetIds);

    await upsertDuplicateGroupResolution({
      groupKey: resolvedGroupKey,
      assetIds: includedAssetIds,
      proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
      manualCanonicalAssetId:
        input.keeperAssetId === proposedCanonical.canonicalAssetId ? null : input.keeperAssetId,
      resolutionStatus: 'confirmed'
    });

    return {
      resolvedGroupKey
    };
  }

  return {
    resolvedGroupKey: null
  };
}

export async function reopenProvisionalDuplicateGroup(
  groupKey: string
): Promise<ReopenProvisionalDuplicateGroupResponse | null> {
  const assetIds = parseProvisionalGroupKey(groupKey);
  if (assetIds.length === 0) {
    return null;
  }

  await deleteDuplicateGroupResolutionByKey(groupKey);
  invalidateProvisionalDuplicateGroupCache();

  return {
    reopenedGroupKey: groupKey
  };
}

export async function updateDerivedDuplicateGroupResolution(
  groupKey: string,
  input: {
    canonicalAssetId?: string;
    resolutionStatus?: 'proposed' | 'confirmed';
  }
): Promise<void | null> {
  const derivedGroups = await loadDerivedGroups();
  const group = derivedGroups.find((candidate) => buildDuplicateGroupKey(candidate.assetIds) === groupKey);

  if (!group) {
    return null;
  }

  const assets = await findByIds(group.assetIds);
  const proposedCanonical = selectProposedCanonicalAsset(assets);
  const nextCanonicalAssetId = input.canonicalAssetId ?? proposedCanonical.canonicalAssetId;

  if (!group.assetIds.includes(nextCanonicalAssetId)) {
    throw new Error(`Canonical asset ${nextCanonicalAssetId} is not part of duplicate group ${groupKey}.`);
  }

  await upsertDuplicateGroupResolution({
    groupKey,
    assetIds: group.assetIds,
    proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
    manualCanonicalAssetId:
      nextCanonicalAssetId === proposedCanonical.canonicalAssetId ? null : nextCanonicalAssetId,
    resolutionStatus: input.resolutionStatus ?? 'proposed'
  });
}
