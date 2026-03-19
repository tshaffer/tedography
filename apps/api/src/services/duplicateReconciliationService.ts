import type { MediaAsset } from '@tedography/domain';
import type {
  DuplicateActionExecutionStatus,
  DuplicateActionPlanStatus,
  DuplicateCandidatePairAssetSummary,
  DuplicateReconciliationEntry,
  DuplicateReconciliationListItem,
  DuplicateReconciliationSummary,
  GenerateDuplicateReconciliationsResponse,
  GetDuplicateReconciliationResponse,
  ListDuplicateReconciliationsResponse
} from '@tedography/shared';
import type { DuplicateReconciliationDocument } from '../models/duplicateReconciliationModel.js';
import { findByIds, updateMediaAssetAlbumIds } from '../repositories/assetRepository.js';
import { findCompletedExecutionForPlan } from '../repositories/duplicateActionExecutionRepository.js';
import { findDuplicateActionPlanByGroupKey } from '../repositories/duplicateActionPlanRepository.js';
import {
  findDuplicateReconciliationByGroupKey,
  listDuplicateReconciliations,
  upsertDuplicateReconciliation,
  type ListDuplicateReconciliationsInput
} from '../repositories/duplicateReconciliationRepository.js';
import { listDerivedDuplicateGroups } from './duplicateGroupService.js';

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toAssetSummary(asset: MediaAsset | null): DuplicateCandidatePairAssetSummary | null {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    originalArchivePath: asset.originalArchivePath,
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

function normalizeStringArray(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))].sort(
    (left, right) => left.localeCompare(right)
  );
}

export function deriveDuplicateReconciliation(input: {
  groupKey: string;
  canonicalAsset: MediaAsset;
  secondaryAssets: MediaAsset[];
}): {
  canonicalAssetId: string;
  sourceSecondaryAssetIds: string[];
  status: 'auto_applied' | 'no_changes';
  entries: DuplicateReconciliationEntry[];
  rationale: string[];
  nextCanonicalAlbumIds: string[];
} {
  const canonicalAlbumIds = normalizeStringArray(input.canonicalAsset.albumIds);
  const secondaryAssetIds = input.secondaryAssets.map((asset) => asset.id).sort((left, right) => left.localeCompare(right));
  const contributedByAlbumId = new Map<string, Set<string>>();

  for (const asset of input.secondaryAssets) {
    for (const albumId of normalizeStringArray(asset.albumIds)) {
      if (canonicalAlbumIds.includes(albumId)) {
        continue;
      }

      const contributors = contributedByAlbumId.get(albumId) ?? new Set<string>();
      contributors.add(asset.id);
      contributedByAlbumId.set(albumId, contributors);
    }
  }

  const addedAlbumIds = [...contributedByAlbumId.keys()].sort((left, right) => left.localeCompare(right));
  const nextCanonicalAlbumIds = normalizeStringArray([...canonicalAlbumIds, ...addedAlbumIds]);

  if (addedAlbumIds.length === 0) {
    return {
      canonicalAssetId: input.canonicalAsset.id,
      sourceSecondaryAssetIds: secondaryAssetIds,
      status: 'no_changes',
      entries: [],
      rationale: [
        'Canonical asset already contains all duplicate album associations from the confirmed group.',
        'No conflict-prone scalar fields were auto-reconciled in this phase.'
      ],
      nextCanonicalAlbumIds
    };
  }

  return {
    canonicalAssetId: input.canonicalAsset.id,
    sourceSecondaryAssetIds: secondaryAssetIds,
    status: 'auto_applied',
    entries: [
      {
        fieldName: 'albumIds',
        originalCanonicalValue: canonicalAlbumIds,
        reconciledValue: nextCanonicalAlbumIds,
        addedValues: addedAlbumIds,
        contributedAssetIds: [
          ...new Set(
            addedAlbumIds.flatMap((albumId) => [...(contributedByAlbumId.get(albumId) ?? new Set<string>())])
          )
        ].sort((left, right) => left.localeCompare(right)),
        rationale: [
          'Album associations are treated as safe additive metadata and merged by set union only.',
          'Capture date, location, and other scalar metadata are not auto-overwritten in this phase.'
        ],
        status: 'auto_applied'
      }
    ],
    rationale: [
      'Applied low-risk additive metadata reconciliation onto the selected canonical asset.',
      `Merged ${addedAlbumIds.length} album association${addedAlbumIds.length === 1 ? '' : 's'} from duplicate members.`,
      'Capture date and location remain unchanged unless a future explicit rule is added.'
    ],
    nextCanonicalAlbumIds
  };
}

async function buildAssetSummaryMap(assetIds: string[]): Promise<Map<string, DuplicateCandidatePairAssetSummary>> {
  const assets = await findByIds(assetIds);
  return new Map(
    assets.map((asset) => [
      asset.id,
      toAssetSummary(asset) ?? {
        id: asset.id,
        filename: asset.filename,
        mediaType: asset.mediaType,
        originalArchivePath: asset.originalArchivePath
      }
    ])
  );
}

async function toListItem(record: DuplicateReconciliationDocument): Promise<DuplicateReconciliationListItem> {
  const [assetSummaryMap, actionPlan, completedExecution] = await Promise.all([
    buildAssetSummaryMap([record.canonicalAssetId, ...record.sourceSecondaryAssetIds]),
    findDuplicateActionPlanByGroupKey(record.groupKey),
    findCompletedExecutionForPlan(record.groupKey)
  ]);

  const canonicalAsset = assetSummaryMap.get(record.canonicalAssetId) ?? null;
  const sourceAssets = record.sourceSecondaryAssetIds
    .map((assetId) => assetSummaryMap.get(assetId))
    .filter((asset): asset is DuplicateCandidatePairAssetSummary => asset !== undefined);

  return {
    reconciliationId: record.groupKey,
    groupKey: record.groupKey,
    canonicalAssetId: record.canonicalAssetId,
    canonicalAsset,
    sourceSecondaryAssetIds: record.sourceSecondaryAssetIds,
    sourceSecondaryAssets: sourceAssets,
    status: record.status,
    entries: record.entries,
    rationale: record.rationale,
    ...(actionPlan?.planStatus ? { actionPlanStatus: actionPlan.planStatus as DuplicateActionPlanStatus } : {}),
    ...(completedExecution?.status
      ? { latestCompletedExecutionStatus: completedExecution.status as DuplicateActionExecutionStatus }
      : {}),
    ...(record.createdAt ? { createdAt: record.createdAt.toISOString() } : {}),
    ...(record.updatedAt ? { updatedAt: record.updatedAt.toISOString() } : {})
  };
}

export function summarizeDuplicateReconciliations(
  items: DuplicateReconciliationListItem[]
): DuplicateReconciliationSummary {
  return {
    total: items.length,
    statusCounts: {
      auto_applied: items.filter((item) => item.status === 'auto_applied').length,
      no_changes: items.filter((item) => item.status === 'no_changes').length
    },
    totalAddedAlbumAssociations: items.reduce(
      (sum, item) =>
        sum +
        item.entries.reduce(
          (entrySum, entry) => entrySum + (entry.fieldName === 'albumIds' ? entry.addedValues.length : 0),
          0
        ),
      0
    )
  };
}

export async function generateDuplicateReconciliations(options?: {
  onlyMissing?: boolean;
}): Promise<GenerateDuplicateReconciliationsResponse> {
  const groupsResponse = await listDerivedDuplicateGroups({ resolutionStatus: 'confirmed' });
  const reconciliationIds: string[] = [];
  let skippedCount = 0;

  for (const group of groupsResponse.groups) {
    const existing = await findDuplicateReconciliationByGroupKey(group.groupKey);
    if (options?.onlyMissing && existing) {
      skippedCount += 1;
      continue;
    }

    const assets = await findByIds(group.assetIds);
    const canonicalAsset = assets.find((asset) => asset.id === group.selectedCanonicalAssetId) ?? null;
    if (!canonicalAsset) {
      skippedCount += 1;
      continue;
    }

    const secondaryAssets = assets.filter((asset) => asset.id !== canonicalAsset.id);
    const derived = deriveDuplicateReconciliation({
      groupKey: group.groupKey,
      canonicalAsset,
      secondaryAssets
    });

    const normalizedSourceSecondaryAssetIds = [...derived.sourceSecondaryAssetIds].sort((left, right) =>
      left.localeCompare(right)
    );
    const shouldPreserveExistingAutoAppliedRecord =
      existing?.status === 'auto_applied' &&
      existing.canonicalAssetId === derived.canonicalAssetId &&
      arraysEqual(
        [...(existing.sourceSecondaryAssetIds ?? [])].sort((left, right) => left.localeCompare(right)),
        normalizedSourceSecondaryAssetIds
      ) &&
      derived.status === 'no_changes' &&
      existing.entries.length > 0;

    if (derived.status === 'auto_applied') {
      await updateMediaAssetAlbumIds(derived.canonicalAssetId, derived.nextCanonicalAlbumIds);
    }

    await upsertDuplicateReconciliation({
      groupKey: group.groupKey,
      canonicalAssetId: shouldPreserveExistingAutoAppliedRecord
        ? existing.canonicalAssetId
        : derived.canonicalAssetId,
      sourceSecondaryAssetIds: shouldPreserveExistingAutoAppliedRecord
        ? existing.sourceSecondaryAssetIds
        : derived.sourceSecondaryAssetIds,
      status: shouldPreserveExistingAutoAppliedRecord ? existing.status : derived.status,
      entries: shouldPreserveExistingAutoAppliedRecord ? existing.entries : derived.entries,
      rationale: shouldPreserveExistingAutoAppliedRecord ? existing.rationale : derived.rationale
    });

    reconciliationIds.push(group.groupKey);
  }

  return {
    generatedCount: reconciliationIds.length,
    skippedCount,
    reconciliationIds
  };
}

export async function listDuplicateReconciliationsForReview(
  input: ListDuplicateReconciliationsInput
): Promise<ListDuplicateReconciliationsResponse> {
  const records = await listDuplicateReconciliations(input);
  const items = await Promise.all(records.map((record) => toListItem(record)));

  return {
    items,
    total: items.length,
    summary: summarizeDuplicateReconciliations(items)
  };
}

export async function getDuplicateReconciliationForReview(
  reconciliationId: string
): Promise<GetDuplicateReconciliationResponse | null> {
  const record = await findDuplicateReconciliationByGroupKey(reconciliationId);
  if (!record) {
    return null;
  }

  return {
    item: await toListItem(record)
  };
}
