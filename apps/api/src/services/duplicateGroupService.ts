import { PhotoState, type MediaAsset } from '@tedography/domain';
import type {
  BulkUpdateDuplicateGroupsResponse,
  DuplicateGroupDetailResponse,
  DuplicateGroupListItem,
  DuplicateGroupListSummary,
  ListDuplicateGroupsResponse,
  UpdateDuplicateGroupResolutionResponse
} from '@tedography/shared';
import { findByIds } from '../repositories/assetRepository.js';
import {
  findDuplicateGroupResolutionByKey,
  upsertDuplicateGroupResolution
} from '../repositories/duplicateGroupResolutionRepository.js';
import { listConfirmedDuplicatePairs } from '../repositories/duplicateCandidatePairRepository.js';

interface DerivedDuplicateGroup {
  assetIds: string[];
  pairKeys: string[];
}

export interface ListDerivedDuplicateGroupsOptions {
  assetId?: string;
  resolutionStatus?: 'proposed' | 'confirmed';
  exactAssetCount?: number;
  minAssetCount?: number;
  readyToConfirmOnly?: boolean;
  sort?: 'unresolved_first' | 'size_asc' | 'size_desc';
}

interface CanonicalCandidateScore {
  prefersArchiveDisplay: number;
  resolutionPixels: number;
  originalFormatRank: number;
  metadataFieldCount: number;
  photoStateRank: number;
  fileSizeBytes: number;
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

export async function getDerivedDuplicateGroup(
  groupKey: string
): Promise<DuplicateGroupDetailResponse | null> {
  const derivedGroups = await loadDerivedGroups();
  const group = derivedGroups.find((candidate) => buildDuplicateGroupKey(candidate.assetIds) === groupKey);

  if (!group) {
    return null;
  }

  return {
    group: await buildDuplicateGroupListItem(group)
  };
}

export async function updateDerivedDuplicateGroupResolution(
  groupKey: string,
  input: {
    canonicalAssetId?: string;
    resolutionStatus?: 'proposed' | 'confirmed';
  }
): Promise<UpdateDuplicateGroupResolutionResponse | null> {
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

  return getDerivedDuplicateGroup(groupKey);
}

export async function bulkConfirmDerivedDuplicateGroupProposals(
  groupKeys: string[]
): Promise<BulkUpdateDuplicateGroupsResponse> {
  const uniqueGroupKeys = Array.from(new Set(groupKeys.filter((value) => value.trim().length > 0)));

  let updatedCount = 0;

  for (const groupKey of uniqueGroupKeys) {
    const result = await updateDerivedDuplicateGroupResolution(groupKey, {
      resolutionStatus: 'confirmed'
    });

    if (result) {
      updatedCount += 1;
    }
  }

  return {
    updatedCount,
    groupKeys: uniqueGroupKeys
  };
}
