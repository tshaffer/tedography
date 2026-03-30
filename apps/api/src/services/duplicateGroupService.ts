import { PhotoState, type MediaAsset } from '@tedography/domain';
import type {
  AcceptProvisionalDuplicateGroupAsFinalResponse,
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
import { log } from '../logger.js';
import { findByIds, findByIdsForDuplicateReview } from '../repositories/assetRepository.js';
import {
  clearDuplicateGroupResolutionRereviewByKey,
  deleteDuplicateGroupResolutionByKey,
  deleteDuplicateGroupResolutionsByOverlappingAssetIds,
  findDuplicateGroupResolutionByKey,
  listDuplicateGroupResolutionsByOverlappingAssetIds,
  listDuplicateGroupResolutions,
  markDuplicateGroupResolutionsForRereviewByKeys,
  type DuplicateGroupResolutionDocument,
  upsertDuplicateGroupResolution
} from '../repositories/duplicateGroupResolutionRepository.js';
import {
  listExternalProvisionalDuplicateCandidatePairsForAssetIds,
  listConfirmedDuplicatePairs,
  markDuplicateCandidatePairsConfirmedDuplicateForAssetIds,
  markDuplicateCandidatePairsNotDuplicateBetweenAssetSets,
  listProvisionalDuplicateCandidatePairKeysForAssetIds,
  listReviewedDuplicateCandidatePairsForAssets,
  listProvisionalDuplicateCandidatePairsForAssetIds,
  listProvisionalDuplicateCandidatePairs,
} from '../repositories/duplicateCandidatePairRepository.js';

interface DerivedDuplicateGroup {
  assetIds: string[];
  pairKeys: string[];
}

interface ProvisionalDuplicateGroupCacheEntry {
  groups: DerivedDuplicateGroup[];
  cachedAt: number;
}

interface ConfirmedDuplicateGroupResolutionCacheEntry {
  resolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>;
  cachedAt: number;
}

interface ProvisionalDuplicateGroupDetailCacheEntry {
  response: GetProvisionalDuplicateGroupResponse;
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
  previewOnly?: boolean;
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
const confirmedDuplicateGroupResolutionCacheTtlMs = 5 * 60 * 1000;
let confirmedDuplicateGroupResolutionCache: ConfirmedDuplicateGroupResolutionCacheEntry | null = null;
const provisionalDuplicateGroupDetailCacheTtlMs = 5 * 60 * 1000;
const provisionalDuplicateGroupDetailCache = new Map<string, ProvisionalDuplicateGroupDetailCacheEntry>();

function buildProvisionalDuplicateGroupCacheKey(
  options: Pick<ListProvisionalDuplicateGroupsOptions, 'assetId' | 'minScore'>
): string {
  return `${options.assetId ?? ''}::${typeof options.minScore === 'number' ? options.minScore : ''}`;
}

function buildProvisionalDuplicateGroupDetailCacheKey(input: {
  groupKey: string;
  includeHistoricalCounts: boolean;
  minScore?: number;
  previewOnly: boolean;
}): string {
  return [
    input.groupKey,
    input.includeHistoricalCounts ? 'history' : 'base',
    input.previewOnly ? 'preview' : 'full',
    typeof input.minScore === 'number' ? String(input.minScore) : ''
  ].join('::');
}

function updateConfirmedDuplicateGroupResolutionCache(
  updater: (
    current: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
  ) => Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): void {
  if (!confirmedDuplicateGroupResolutionCache) {
    return;
  }

  confirmedDuplicateGroupResolutionCache = {
    resolutions: updater(confirmedDuplicateGroupResolutionCache.resolutions),
    cachedAt: Date.now()
  };
}

export function removeConfirmedDuplicateGroupResolutionsFromCacheByOverlappingAssetIds(
  assetIds: string[]
): void {
  if (assetIds.length === 0) {
    return;
  }

  const assetIdSet = new Set(assetIds);
  updateConfirmedDuplicateGroupResolutionCache((current) =>
    current.filter((resolution) => !resolution.assetIds.some((assetId) => assetIdSet.has(assetId)))
  );
}

export function removeConfirmedDuplicateGroupResolutionFromCacheByKey(groupKey: string): void {
  updateConfirmedDuplicateGroupResolutionCache((current) =>
    current.filter((resolution) => resolution.groupKey !== groupKey)
  );
}

export function upsertConfirmedDuplicateGroupResolutionInCache(
  resolution: Awaited<ReturnType<typeof upsertDuplicateGroupResolution>>
): void {
  updateConfirmedDuplicateGroupResolutionCache((current) => {
    const filtered = current.filter((entry) => entry.groupKey !== resolution.groupKey);
    return [...filtered, resolution];
  });
}

export function markConfirmedDuplicateGroupResolutionsForRereviewInCache(groupKeys: string[]): void {
  if (groupKeys.length === 0) {
    return;
  }

  const groupKeySet = new Set(groupKeys);
  const rereviewRequiredAt = new Date();
  updateConfirmedDuplicateGroupResolutionCache((current) =>
    current.map((resolution) =>
      groupKeySet.has(resolution.groupKey) && !resolution.rereviewRequiredAt
        ? { ...resolution, rereviewRequiredAt }
        : resolution
    )
  );
}

async function getConfirmedDuplicateGroupResolutions(): Promise<
  Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
> {
  if (
    confirmedDuplicateGroupResolutionCache &&
    Date.now() - confirmedDuplicateGroupResolutionCache.cachedAt <= confirmedDuplicateGroupResolutionCacheTtlMs
  ) {
    return confirmedDuplicateGroupResolutionCache.resolutions;
  }

  const resolutions = await listDuplicateGroupResolutions({ resolutionStatus: 'confirmed' });
  confirmedDuplicateGroupResolutionCache = {
    resolutions,
    cachedAt: Date.now()
  };
  return resolutions;
}

export async function listOverlappingConfirmedDuplicateGroupResolutions(
  assetIds: string[]
): Promise<DuplicateGroupResolutionDocument[]> {
  if (assetIds.length === 0) {
    return [];
  }

  const assetIdSet = new Set(assetIds);
  const resolutions = await getConfirmedDuplicateGroupResolutions();
  return resolutions.filter((resolution) => resolution.assetIds.some((assetId) => assetIdSet.has(assetId)));
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

function parseDerivedPairKey(pairKey: string): { assetIdA: string; assetIdB: string } | null {
  const [assetIdA, assetIdB] = pairKey.split('__');
  if (!assetIdA || !assetIdB) {
    return null;
  }

  return { assetIdA, assetIdB };
}

export function suppressConfirmedDuplicateAssetsFromPreviewGroups(
  groups: DerivedDuplicateGroup[],
  confirmedResolutions: DuplicateGroupResolutionDocument[]
): DerivedDuplicateGroup[] {
  const nextGroups: DerivedDuplicateGroup[] = [];

  for (const group of groups) {
    const groupAssetIdSet = new Set(group.assetIds);
    const suppressedAssetIds = new Set<string>();

    for (const resolution of confirmedResolutions) {
      if (resolution.resolutionStatus !== 'confirmed') {
        continue;
      }

      const selectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
        assetIds: resolution.assetIds,
        proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
        ...(resolution.manualCanonicalAssetId !== undefined
          ? { manualCanonicalAssetId: resolution.manualCanonicalAssetId }
          : {})
      });

      if (!groupAssetIdSet.has(selectedCanonicalAssetId)) {
        continue;
      }

      for (const assetId of resolution.assetIds) {
        if (assetId !== selectedCanonicalAssetId && groupAssetIdSet.has(assetId)) {
          suppressedAssetIds.add(assetId);
        }
      }
    }

    if (suppressedAssetIds.size === 0) {
      nextGroups.push(group);
      continue;
    }

    const remainingPairs = group.pairKeys
      .map(parseDerivedPairKey)
      .filter((pair): pair is { assetIdA: string; assetIdB: string } => pair !== null)
      .filter(
        (pair) => !suppressedAssetIds.has(pair.assetIdA) && !suppressedAssetIds.has(pair.assetIdB)
      );

    if (remainingPairs.length === 0) {
      continue;
    }

    nextGroups.push(...deriveDuplicateGroups(remainingPairs));
  }

  return nextGroups.sort((left, right) => {
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

function updateConfirmedDuplicateGroupResolutionRereviewInCache(input: {
  groupKey: string;
  rereviewRequiredAt: Date | null;
}): void {
  updateConfirmedDuplicateGroupResolutionCache((current) =>
    current.map((resolution) =>
      resolution.groupKey === input.groupKey
        ? {
            ...resolution,
            rereviewRequiredAt: input.rereviewRequiredAt
          }
        : resolution
    )
  );
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
  const assets = await findByIdsForDuplicateReview(group.assetIds);
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
  const startedAt = Date.now();
  const cacheKey = buildProvisionalDuplicateGroupCacheKey(options);
  const cached = provisionalDuplicateGroupCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= provisionalDuplicateGroupCacheTtlMs) {
    log.info(`[duplicates] load provisional groups cache-hit key=${cacheKey} totalMs=${Date.now() - startedAt}`);
    return cached.groups;
  }

  const listCandidatePairsStartedAt = Date.now();
  const candidatePairs = await listProvisionalDuplicateCandidatePairs({
    ...(options.assetId ? { assetId: options.assetId } : {}),
    ...(typeof options.minScore === 'number' ? { minScore: options.minScore } : {}),
    ...(options.previewOnly === true ? { includeSimilarImage: true } : {})
  });
  const deriveGroupsStartedAt = Date.now();
  const groups = deriveDuplicateGroups(candidatePairs);
  const loadConfirmedResolutionsStartedAt = Date.now();
  const confirmedResolutions = await getConfirmedDuplicateGroupResolutions();
  const suppressedGroups =
    options.previewOnly === true
      ? suppressConfirmedDuplicateAssetsFromPreviewGroups(groups, confirmedResolutions)
      : groups;
  const filteredGroups =
    options.previewOnly === true
      ? suppressedGroups.filter(
          (group) =>
            !confirmedResolutions.some(
              (resolution) =>
                resolution.resolutionStatus === 'confirmed' &&
                group.assetIds.every((assetId) => resolution.assetIds.includes(assetId))
            )
        )
      : suppressedGroups;
  provisionalDuplicateGroupCache.set(cacheKey, {
    groups: filteredGroups,
    cachedAt: Date.now()
  });
  log.info(
    `[duplicates] load provisional groups key=${cacheKey} preview=${options.previewOnly === true ? 'true' : 'false'} ` +
      `pairs=${candidatePairs.length} groups=${groups.length} suppressedGroups=${suppressedGroups.length} filteredGroups=${filteredGroups.length} totalMs=${Date.now() - startedAt} ` +
      `listCandidatePairsMs=${deriveGroupsStartedAt - listCandidatePairsStartedAt} ` +
      `deriveGroupsMs=${loadConfirmedResolutionsStartedAt - deriveGroupsStartedAt} ` +
      `loadConfirmedResolutionsMs=${Date.now() - loadConfirmedResolutionsStartedAt}`
  );
  return filteredGroups;
}

export function determineProvisionalGroupReviewStatus(input: {
  assetIds: string[];
  exactResolutionStatus?: 'proposed' | 'confirmed' | null;
  exactResolutionNeedsRereview?: boolean;
  coveredByConfirmedResolution?: boolean;
  overlappingConfirmedResolutionCount: number;
}): DuplicateProvisionalGroupReviewStatus {
  if (input.coveredByConfirmedResolution) {
    return 'resolved';
  }

  if (input.exactResolutionNeedsRereview) {
    return 'needs_rereview';
  }

  if (input.exactResolutionStatus === 'confirmed') {
    return 'resolved';
  }

  if (input.overlappingConfirmedResolutionCount > 0) {
    return 'needs_rereview';
  }

  return 'unresolved';
}

async function markResolvedGroupsForRereviewIfNeeded(input: {
  groups: DerivedDuplicateGroup[];
  confirmedResolutions: DuplicateGroupResolutionDocument[];
}): Promise<void> {
  const groupKeysToMark = new Set<string>();

  for (const group of input.groups) {
    const exactGroupKey = buildDuplicateGroupKey(group.assetIds);
    const exactConfirmedResolution = input.confirmedResolutions.find(
      (resolution) =>
        resolution.groupKey === exactGroupKey && resolution.resolutionStatus === 'confirmed'
    );

    if (exactConfirmedResolution) {
      continue;
    }

    for (const resolution of input.confirmedResolutions) {
      if (resolution.resolutionStatus !== 'confirmed' || resolution.rereviewRequiredAt) {
        continue;
      }

      const overlaps = resolution.assetIds.some((assetId) => group.assetIds.includes(assetId));
      if (overlaps) {
        groupKeysToMark.add(resolution.groupKey);
      }
    }
  }

  if (groupKeysToMark.size === 0) {
    return;
  }

  const groupKeys = Array.from(groupKeysToMark);
  await markDuplicateGroupResolutionsForRereviewByKeys(groupKeys);
  markConfirmedDuplicateGroupResolutionsForRereviewInCache(groupKeys);
}

function getProvisionalGroupReviewStatusRank(status: DuplicateProvisionalGroupReviewStatus): number {
  if (status === 'needs_rereview') {
    return 0;
  }

  if (status === 'unresolved') {
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
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>,
  options?: {
    includeHistoricalCounts?: boolean;
    minScore?: number;
    previewOnly?: boolean;
  }
): Promise<ProvisionalDuplicateGroupListItem> {
  const includeHistoricalCounts = options?.includeHistoricalCounts ?? false;
  const [assets, historicalCountsByAssetId] = await Promise.all([
    findByIdsForDuplicateReview(group.assetIds),
    includeHistoricalCounts
      ? buildHistoricalCountsByAssetId(group.assetIds, confirmedResolutions)
      : Promise.resolve(
          new Map<
            string,
            {
              keeperCount: number;
              duplicateCount: number;
              notDuplicateCount: number;
            }
          >()
        )
  ]);

  const exactGroupKey = buildDuplicateGroupKey(group.assetIds);
  const exactResolution =
    confirmedResolutions.find((resolution) => resolution.groupKey === exactGroupKey) ?? null;
  const overlappingConfirmedResolutions = confirmedResolutions.filter(
    (resolution) =>
      resolution.groupKey !== exactGroupKey &&
      resolution.assetIds.some((assetId) => group.assetIds.includes(assetId))
  );
  const coveredByConfirmedResolution = overlappingConfirmedResolutions.some((resolution) =>
    group.assetIds.every((assetId) => resolution.assetIds.includes(assetId))
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
    exactResolutionNeedsRereview: exactResolution?.rereviewRequiredAt !== undefined && exactResolution.rereviewRequiredAt !== null,
    coveredByConfirmedResolution,
    overlappingConfirmedResolutionCount: overlappingConfirmedResolutions.length
  });
  const rereviewCause =
    reviewStatus === 'needs_rereview'
      ? await buildProvisionalGroupRereviewCause({
          assetIds: group.assetIds,
          exactGroupKey,
          confirmedResolutions,
          ...(typeof options?.minScore === 'number' ? { minScore: options.minScore } : {}),
          ...(options?.previewOnly === true ? { includeSimilarImage: true } : {})
        })
      : undefined;

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
    ...(rereviewCause ? { rereviewCause } : {}),
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

async function buildProvisionalGroupRereviewCause(input: {
  assetIds: string[];
  exactGroupKey: string;
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>;
  minScore?: number;
  includeSimilarImage?: boolean;
}) {
  const overlappingConfirmedGroups = input.confirmedResolutions
    .filter(
      (resolution) =>
        resolution.resolutionStatus === 'confirmed' &&
        resolution.groupKey !== input.exactGroupKey &&
        resolution.assetIds.some((assetId) => input.assetIds.includes(assetId))
    )
    .map((resolution) => {
      const selectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
        assetIds: resolution.assetIds,
        proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
        ...(resolution.manualCanonicalAssetId !== undefined
          ? { manualCanonicalAssetId: resolution.manualCanonicalAssetId }
          : {})
      });
      const insideAssetCount = resolution.assetIds.filter((assetId) => input.assetIds.includes(assetId)).length;

      return {
        groupKey: resolution.groupKey,
        assetCount: resolution.assetIds.length,
        selectedCanonicalAssetId,
        keeperInCurrentGroup: input.assetIds.includes(selectedCanonicalAssetId),
        insideAssetCount,
        outsideAssetCount: Math.max(0, resolution.assetIds.length - insideAssetCount)
      };
    });

  const externalPairs = await listExternalProvisionalDuplicateCandidatePairsForAssetIds(
    input.assetIds,
    input.minScore,
    { ...(input.includeSimilarImage ? { includeSimilarImage: true } : {}) }
  );
  const outsideAssetIds = Array.from(
    new Set(
      externalPairs.map((pair) =>
        input.assetIds.includes(pair.assetIdA) ? pair.assetIdB : pair.assetIdA
      )
    )
  );
  const outsideAssets = await findByIdsForDuplicateReview(outsideAssetIds);
  const outsideAssetMap = new Map(outsideAssets.map((asset) => [asset.id, asset]));

  return {
    overlappingConfirmedGroups,
    externalCandidateLinks: externalPairs.map((pair) => {
      const insideAssetId = input.assetIds.includes(pair.assetIdA) ? pair.assetIdA : pair.assetIdB;
      const outsideAssetId = insideAssetId === pair.assetIdA ? pair.assetIdB : pair.assetIdA;
      const outsideAsset = outsideAssetMap.get(outsideAssetId);

      return {
        insideAssetId,
        outsideAssetId,
        ...(outsideAsset ? { outsideAsset: toProvisionalGroupMemberAssetSummary(outsideAsset) } : {})
      };
    }),
    canAcceptCurrentGroupAsFinal: overlappingConfirmedGroups.length === 0
  };
}

function buildLightweightProvisionalDuplicateGroupListItem(
  group: DerivedDuplicateGroup,
  confirmedResolutions: Awaited<ReturnType<typeof listDuplicateGroupResolutions>>
): ProvisionalDuplicateGroupListItem {
  const exactGroupKey = buildDuplicateGroupKey(group.assetIds);
  const exactResolution =
    confirmedResolutions.find((resolution) => resolution.groupKey === exactGroupKey) ?? null;
  const overlappingConfirmedResolutions = confirmedResolutions.filter(
    (resolution) =>
      resolution.groupKey !== exactGroupKey &&
      resolution.assetIds.some((assetId) => group.assetIds.includes(assetId))
  );
  const coveredByConfirmedResolution = overlappingConfirmedResolutions.some((resolution) =>
    group.assetIds.every((assetId) => resolution.assetIds.includes(assetId))
  );

  return {
    groupKey: exactGroupKey,
    assetIds: group.assetIds,
    assetCount: group.assetIds.length,
    candidatePairCount: group.pairKeys.length,
    reviewStatus: determineProvisionalGroupReviewStatus({
      assetIds: group.assetIds,
      exactResolutionStatus: exactResolution?.resolutionStatus ?? null,
      exactResolutionNeedsRereview: exactResolution?.rereviewRequiredAt !== undefined && exactResolution.rereviewRequiredAt !== null,
      coveredByConfirmedResolution,
      overlappingConfirmedResolutionCount: overlappingConfirmedResolutions.length
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
  const startedAt = Date.now();
  const loadGroupsStartedAt = Date.now();
  const groups = await loadProvisionalGroups(options);
  const loadConfirmedResolutionsStartedAt = Date.now();
  const confirmedResolutions = await getConfirmedDuplicateGroupResolutions();
  const normalizedOffset =
    typeof options.offset === 'number' && Number.isInteger(options.offset) && options.offset > 0
      ? options.offset
      : 0;
  const normalizedLimit =
    typeof options.limit === 'number' && Number.isInteger(options.limit) && options.limit > 0
      ? options.limit
      : 50;
  const buildListItemsStartedAt = Date.now();
  const sortedGroups = sortProvisionalDuplicateGroupListItems(
    groups.map((group) => buildLightweightProvisionalDuplicateGroupListItem(group, confirmedResolutions))
  );
  const buildSummaryStartedAt = Date.now();
  const builtGroups = sortedGroups.slice(normalizedOffset, normalizedOffset + normalizedLimit);
  const assetIds = Array.from(
    new Set(builtGroups.flatMap((group: ProvisionalDuplicateGroupListItem) => group.assetIds))
  );
  const summary = sortedGroups.reduce<Record<DuplicateProvisionalGroupReviewStatus, number>>(
    (counts, group) => {
      counts[group.reviewStatus] += 1;
      return counts;
    },
    {
      unresolved: 0,
      needs_rereview: 0,
      resolved: 0
    }
  );

  log.info(
    `[duplicates] list provisional groups preview=${options.previewOnly === true ? 'true' : 'false'} ` +
      `totalMs=${Date.now() - startedAt} loadGroupsMs=${loadConfirmedResolutionsStartedAt - loadGroupsStartedAt} ` +
      `loadConfirmedResolutionsMs=${buildListItemsStartedAt - loadConfirmedResolutionsStartedAt} ` +
      `buildListItemsMs=${buildSummaryStartedAt - buildListItemsStartedAt} ` +
      `buildSummaryMs=${Date.now() - buildSummaryStartedAt} groups=${groups.length} returned=${builtGroups.length}`
  );

  return {
    groups: builtGroups,
    totalGroups: sortedGroups.length,
    totalAssets: assetIds.length,
    summary,
    limit: normalizedLimit,
    offset: normalizedOffset,
    hasMore: normalizedOffset + builtGroups.length < sortedGroups.length
  };
}

export async function getProvisionalDuplicateGroup(
  groupKey: string,
  options?: {
    includeHistoricalCounts?: boolean;
    minScore?: number;
    previewOnly?: boolean;
  }
): Promise<GetProvisionalDuplicateGroupResponse | null> {
  const startedAt = Date.now();
  const assetIds = parseProvisionalGroupKey(groupKey);
  if (assetIds.length === 0) {
    return null;
  }

  const includeHistoricalCounts = options?.includeHistoricalCounts ?? false;
  const detailCacheKey = buildProvisionalDuplicateGroupDetailCacheKey({
    groupKey,
    includeHistoricalCounts,
    ...(typeof options?.minScore === 'number' ? { minScore: options.minScore } : {}),
    previewOnly: options?.previewOnly === true
  });
  const cached = provisionalDuplicateGroupDetailCache.get(detailCacheKey);
  if (cached && Date.now() - cached.cachedAt <= provisionalDuplicateGroupDetailCacheTtlMs) {
    log.info(
      `[duplicates] get provisional group cache-hit group=${groupKey} preview=${options?.previewOnly === true ? 'true' : 'false'} ` +
        `includeHistory=${includeHistoricalCounts ? 'true' : 'false'} totalMs=${Date.now() - startedAt}`
    );
    return cached.response;
  }

  const listPairKeysStartedAt = Date.now();
  const pairKeys = await listProvisionalDuplicateCandidatePairKeysForAssetIds(assetIds, {
    ...(options?.previewOnly === true ? { includeSimilarImage: true } : {})
  });
  const loadConfirmedResolutionsStartedAt = Date.now();
  const confirmedResolutions = includeHistoricalCounts
    ? await getConfirmedDuplicateGroupResolutions()
    : await listDuplicateGroupResolutionsByOverlappingAssetIds({
        assetIds,
        resolutionStatus: 'confirmed'
      });
  const buildDetailStartedAt = Date.now();

  const response = {
    group: await buildProvisionalDuplicateGroupListItem(
      {
        assetIds,
        pairKeys
      },
      confirmedResolutions,
      {
        includeHistoricalCounts,
        ...(typeof options?.minScore === 'number' ? { minScore: options.minScore } : {}),
        ...(options?.previewOnly === true ? { previewOnly: true } : {})
      }
    )
  };

  provisionalDuplicateGroupDetailCache.set(detailCacheKey, {
    response,
    cachedAt: Date.now()
  });

  log.info(
    `[duplicates] get provisional group group=${groupKey} preview=${options?.previewOnly === true ? 'true' : 'false'} ` +
      `includeHistory=${includeHistoricalCounts ? 'true' : 'false'} totalMs=${Date.now() - startedAt} ` +
      `listPairKeysMs=${loadConfirmedResolutionsStartedAt - listPairKeysStartedAt} ` +
      `loadConfirmedResolutionsMs=${buildDetailStartedAt - loadConfirmedResolutionsStartedAt} ` +
      `buildDetailMs=${Date.now() - buildDetailStartedAt} pairKeys=${pairKeys.length}`
  );

  return response;
}

export async function acceptProvisionalDuplicateGroupAsFinal(
  groupKey: string
): Promise<AcceptProvisionalDuplicateGroupAsFinalResponse | null> {
  const existingResolution = await findDuplicateGroupResolutionByKey(groupKey);
  if (!existingResolution || existingResolution.resolutionStatus !== 'confirmed') {
    return null;
  }

  const updatedResolution = await clearDuplicateGroupResolutionRereviewByKey(groupKey);
  if (!updatedResolution) {
    return null;
  }

  updateConfirmedDuplicateGroupResolutionRereviewInCache({
    groupKey,
    rereviewRequiredAt: null
  });
  invalidateProvisionalDuplicateGroupCache();

  return {
    acceptedGroupKey: groupKey
  };
}

export function invalidateProvisionalDuplicateGroupCache(): void {
  provisionalDuplicateGroupCache.clear();
  provisionalDuplicateGroupDetailCache.clear();
}

export function invalidateConfirmedDuplicateGroupResolutionCache(): void {
  confirmedDuplicateGroupResolutionCache = null;
}

export async function resolveProvisionalDuplicateGroup(
  groupKey: string,
  input: ResolveProvisionalDuplicateGroupRequest
): Promise<ResolveProvisionalDuplicateGroupResponse | null> {
  const resolveStartedAt = Date.now();
  const stepTimings: Array<{ label: string; durationMs: number }> = [];
  const captureStep = (label: string, startedAt: number): void => {
    stepTimings.push({ label, durationMs: Date.now() - startedAt });
  };

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
  const resolvedGroupKey = includedAssetIds.length >= 2 ? buildDuplicateGroupKey(includedAssetIds) : null;
  const loadConfirmedResolutionsStartedAt = Date.now();
  const confirmedResolutions = await getConfirmedDuplicateGroupResolutions();
  captureStep('load_confirmed_resolutions', loadConfirmedResolutionsStartedAt);
  const currentExactConfirmedResolution =
    confirmedResolutions.find((resolution) => resolution.groupKey === groupKey) ?? null;
  const overlappingConfirmedResolutions = confirmedResolutions.filter((resolution) =>
    resolution.assetIds.some((assetId) => assetIds.includes(assetId))
  );
  const blockingConfirmedResolutions = overlappingConfirmedResolutions.filter(
    (resolution) => resolution.groupKey !== groupKey
  );

  if (blockingConfirmedResolutions.length > 0 && input.allowOverlappingConfirmedGroups !== true) {
    throw new Error(
      'This provisional group overlaps another confirmed duplicate group. Tedography will not let a smaller overlapping subgroup overwrite broader confirmed duplicate results. Reopen and resolve the broader group instead.'
    );
  }

  if (currentExactConfirmedResolution && resolvedGroupKey === currentExactConfirmedResolution.groupKey) {
    const currentSelectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
      assetIds: currentExactConfirmedResolution.assetIds,
      proposedCanonicalAssetId: currentExactConfirmedResolution.proposedCanonicalAssetId,
      ...(currentExactConfirmedResolution.manualCanonicalAssetId !== undefined
        ? { manualCanonicalAssetId: currentExactConfirmedResolution.manualCanonicalAssetId }
        : {})
    });

    if (
      currentSelectedCanonicalAssetId === input.keeperAssetId &&
      currentExactConfirmedResolution.assetIds.length === includedAssetIds.length &&
      currentExactConfirmedResolution.assetIds.every((assetId) => includedAssetIds.includes(assetId)) &&
      blockingConfirmedResolutions.length === 0 &&
      !currentExactConfirmedResolution.rereviewRequiredAt
    ) {
      return {
        resolvedGroupKey,
        noOp: true
      };
    }
  }

  const updatePairReviewsStartedAt = Date.now();
  await Promise.all([
    markDuplicateCandidatePairsConfirmedDuplicateForAssetIds(includedAssetIds),
    markDuplicateCandidatePairsNotDuplicateBetweenAssetSets({
      includedAssetIds,
      excludedAssetIds
    })
  ]);
  captureStep('update_pair_reviews', updatePairReviewsStartedAt);

  if (input.allowOverlappingConfirmedGroups === true && blockingConfirmedResolutions.length > 0) {
    const deleteBlockingResolutionsStartedAt = Date.now();
    await Promise.all(
      blockingConfirmedResolutions.map((resolution) =>
        deleteDuplicateGroupResolutionByKey(resolution.groupKey)
      )
    );
    captureStep('delete_blocking_confirmed_resolutions', deleteBlockingResolutionsStartedAt);
  }

  const deleteOverlappingResolutionsStartedAt = Date.now();
  await deleteDuplicateGroupResolutionsByOverlappingAssetIds(assetIds);
  captureStep('delete_overlapping_resolutions', deleteOverlappingResolutionsStartedAt);
  invalidateProvisionalDuplicateGroupCache();
  removeConfirmedDuplicateGroupResolutionsFromCacheByOverlappingAssetIds(assetIds);

  if (resolvedGroupKey) {
    const loadIncludedAssetsStartedAt = Date.now();
    const includedAssets = await findByIds(includedAssetIds);
    captureStep('load_included_assets', loadIncludedAssetsStartedAt);
    const proposedCanonical = selectProposedCanonicalAsset(includedAssets);

    const upsertResolutionStartedAt = Date.now();
    const resolution = await upsertDuplicateGroupResolution({
      groupKey: resolvedGroupKey,
      assetIds: includedAssetIds,
      proposedCanonicalAssetId: proposedCanonical.canonicalAssetId,
      manualCanonicalAssetId:
        input.keeperAssetId === proposedCanonical.canonicalAssetId ? null : input.keeperAssetId,
      resolutionStatus: 'confirmed',
      rereviewRequiredAt: null
    });
    captureStep('upsert_confirmed_resolution', upsertResolutionStartedAt);
    upsertConfirmedDuplicateGroupResolutionInCache(resolution);

    log.info(
      `[duplicates] resolve group timings group=${groupKey} resolved=${resolvedGroupKey} totalMs=${Date.now() - resolveStartedAt} ` +
        stepTimings.map((step) => `${step.label}=${step.durationMs}`).join(' ')
    );

    return {
      resolvedGroupKey,
      noOp: false
    };
  }

  log.info(
    `[duplicates] resolve group timings group=${groupKey} resolved=none totalMs=${Date.now() - resolveStartedAt} ` +
      stepTimings.map((step) => `${step.label}=${step.durationMs}`).join(' ')
  );

  return {
    resolvedGroupKey: null,
    noOp: false
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
  removeConfirmedDuplicateGroupResolutionFromCacheByKey(groupKey);

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
