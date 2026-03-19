import type { MediaAsset } from '@tedography/domain';
import type { DuplicateActionPlanDocument } from '../models/duplicateActionPlanModel.js';
import type {
  DuplicateActionExecutionReadiness,
  DuplicateActionPlanActionItem,
  DuplicateActionPlanListItem,
  DuplicateActionPlanStatus,
  DuplicateActionType,
  DuplicateCandidatePairAssetSummary,
  ExportDuplicateActionPlansResponse,
  GenerateDuplicateActionPlansResponse,
  GetDuplicateActionPlanResponse,
  ListDuplicateActionPlansResponse,
  UpdateDuplicateActionPlanResponse
} from '@tedography/shared';
import { findByIds } from '../repositories/assetRepository.js';
import {
  findDuplicateActionPlanByGroupKey,
  listDuplicateActionPlans,
  type ListDuplicateActionPlansInput,
  updateDuplicateActionPlanStatus,
  upsertDuplicateActionPlan
} from '../repositories/duplicateActionPlanRepository.js';
import { listDerivedDuplicateGroups } from './duplicateGroupService.js';

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
    ...(asset.photoState !== undefined ? { photoState: asset.photoState } : {}),
    ...(asset.originalFileFormat ? { originalFileFormat: asset.originalFileFormat } : {}),
    ...(asset.originalFileSizeBytes !== undefined
      ? { originalFileSizeBytes: asset.originalFileSizeBytes }
      : {}),
    ...(asset.displayStorageType ? { displayStorageType: asset.displayStorageType } : {})
  };
}

function normalizeAssetIds(assetIds: string[]): string[] {
  return [...assetIds].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function preserveReviewedPlanStatus(input: {
  existingPlanStatus: DuplicateActionPlanStatus | undefined;
  existingCanonicalAssetId: string | undefined;
  existingSecondaryAssetIds: string[] | undefined;
  nextCanonicalAssetId: string;
  nextSecondaryAssetIds: string[];
  nextPrimaryActionType: DuplicateActionType;
  existingPrimaryActionType: DuplicateActionType | undefined;
  existingReviewNote: string | null | undefined;
  nextAutoStatus: DuplicateActionPlanStatus;
}): {
  planStatus: DuplicateActionPlanStatus;
  reviewNote: string | null;
} {
  const existingStatus = input.existingPlanStatus;
  const structureMatches =
    input.existingCanonicalAssetId === input.nextCanonicalAssetId &&
    arraysEqual(input.existingSecondaryAssetIds ?? [], input.nextSecondaryAssetIds) &&
    input.existingPrimaryActionType === input.nextPrimaryActionType;

  if (
    structureMatches &&
    (existingStatus === 'approved' || existingStatus === 'rejected')
  ) {
    return {
      planStatus: existingStatus,
      reviewNote: input.existingReviewNote ?? null
    };
  }

  return {
    planStatus: input.nextAutoStatus,
    reviewNote: null
  };
}

export function deriveDuplicateActionPlanFromGroup(group: {
  groupKey: string;
  resolutionStatus: 'proposed' | 'confirmed';
  selectedCanonicalAssetId: string;
  canonicalReasonSummary: string[];
  assets: DuplicateCandidatePairAssetSummary[];
}): {
  canonicalAssetId: string;
  secondaryAssetIds: string[];
  primaryActionType: DuplicateActionType;
  planStatus: DuplicateActionPlanStatus;
  executionReadiness: DuplicateActionExecutionReadiness;
  actionItems: DuplicateActionPlanActionItem[];
  rationale: string[];
} | null {
  if (group.resolutionStatus !== 'confirmed') {
    return null;
  }

  const canonicalAsset = group.assets.find((asset) => asset.id === group.selectedCanonicalAssetId) ?? null;
  const secondaryAssets = group.assets.filter((asset) => asset.id !== group.selectedCanonicalAssetId);

  if (!canonicalAsset || secondaryAssets.length === 0) {
    return {
      canonicalAssetId: group.selectedCanonicalAssetId,
      secondaryAssetIds: secondaryAssets.map((asset) => asset.id),
      primaryActionType: 'NEEDS_MANUAL_REVIEW',
      planStatus: 'needs_manual_review',
      executionReadiness: 'blocked',
      actionItems: secondaryAssets.map((asset) => ({
        assetId: asset.id,
        actionType: 'NEEDS_MANUAL_REVIEW',
        rationale: ['Group is missing canonical or secondary structure required for planning.']
      })),
      rationale: ['Confirmed group is missing canonical or secondary structure required for planning.']
    };
  }

  const manualReviewReasons: string[] = [];

  if (!canonicalAsset.originalArchivePath) {
    manualReviewReasons.push('Canonical asset is missing original archive path.');
  }

  if (secondaryAssets.some((asset) => !asset.originalArchivePath)) {
    manualReviewReasons.push('One or more secondary assets are missing original archive path.');
  }

  if (secondaryAssets.some((asset) => asset.mediaType !== canonicalAsset.mediaType)) {
    manualReviewReasons.push('Group contains mixed media types and should be reviewed manually.');
  }

  const isEligible = manualReviewReasons.length === 0;
  const secondaryActionType: DuplicateActionType = isEligible
    ? 'PROPOSE_ARCHIVE_SECONDARY'
    : 'NEEDS_MANUAL_REVIEW';

  const actionItems: DuplicateActionPlanActionItem[] = [
    {
      assetId: canonicalAsset.id,
      actionType: 'KEEP_CANONICAL',
      rationale: ['Selected canonical asset remains the keeper for this confirmed duplicate group.']
    },
    ...secondaryAssets.map((asset) => ({
      assetId: asset.id,
      actionType: secondaryActionType,
      rationale: isEligible
        ? [
            `Secondary duplicate should be archived out of the primary browsing path instead of deleted.`,
            `Canonical asset ${canonicalAsset.filename} remains the keeper for this group.`
          ]
        : manualReviewReasons
    }))
  ];

  return {
    canonicalAssetId: canonicalAsset.id,
    secondaryAssetIds: secondaryAssets.map((asset) => asset.id),
    primaryActionType: isEligible ? 'PROPOSE_ARCHIVE_SECONDARY' : 'NEEDS_MANUAL_REVIEW',
    planStatus: isEligible ? 'proposed' : 'needs_manual_review',
    executionReadiness: isEligible ? 'eligible_for_future_execution' : 'blocked',
    actionItems,
    rationale: [
      'Generated from a confirmed duplicate group with a selected canonical asset.',
      ...group.canonicalReasonSummary,
      ...(isEligible ? ['Planning uses archive-oriented secondary handling only; no destructive action is proposed.'] : manualReviewReasons)
    ]
  };
}

async function buildAssetSummaryMap(assetIds: string[]): Promise<Map<string, DuplicateCandidatePairAssetSummary>> {
  const assets = await findByIds(assetIds);
  return new Map(
    assets.map((asset) => {
      const summary = toAssetSummary(asset);
      return [asset.id, summary ?? { id: asset.id, filename: asset.filename, mediaType: asset.mediaType, originalArchivePath: null }];
    })
  );
}

async function toListItem(
  plan: DuplicateActionPlanDocument
): Promise<DuplicateActionPlanListItem> {
  const assetSummaryMap = await buildAssetSummaryMap([
    plan.canonicalAssetId,
    ...plan.secondaryAssetIds
  ]);

  return {
    planId: plan.groupKey,
    groupKey: plan.groupKey,
    canonicalAssetId: plan.canonicalAssetId,
    canonicalAsset: assetSummaryMap.get(plan.canonicalAssetId) ?? null,
    secondaryAssetIds: plan.secondaryAssetIds,
    secondaryAssets: plan.secondaryAssetIds
      .map((assetId) => assetSummaryMap.get(assetId))
      .filter((asset): asset is DuplicateCandidatePairAssetSummary => asset !== undefined),
    actionItems: plan.actionItems,
    primaryActionType: plan.primaryActionType,
    planStatus: plan.planStatus,
    executionReadiness: plan.executionReadiness,
    rationale: plan.rationale,
    reviewNote: plan.reviewNote ?? null,
    ...(plan.createdAt ? { createdAt: plan.createdAt.toISOString() } : {}),
    ...(plan.updatedAt ? { updatedAt: plan.updatedAt.toISOString() } : {})
  };
}

export function summarizeDuplicateActionPlans(items: DuplicateActionPlanListItem[]) {
  return {
    total: items.length,
    statusCounts: {
      proposed: items.filter((item) => item.planStatus === 'proposed').length,
      needs_manual_review: items.filter((item) => item.planStatus === 'needs_manual_review').length,
      approved: items.filter((item) => item.planStatus === 'approved').length,
      rejected: items.filter((item) => item.planStatus === 'rejected').length
    },
    actionTypeCounts: {
      KEEP_CANONICAL: items.filter((item) => item.primaryActionType === 'KEEP_CANONICAL').length,
      PROPOSE_ARCHIVE_SECONDARY: items.filter((item) => item.primaryActionType === 'PROPOSE_ARCHIVE_SECONDARY').length,
      NEEDS_MANUAL_REVIEW: items.filter((item) => item.primaryActionType === 'NEEDS_MANUAL_REVIEW').length
    },
    eligibleForFutureExecutionCount: items.filter(
      (item) => item.executionReadiness === 'eligible_for_future_execution'
    ).length
  };
}

export async function generateDuplicateActionPlans(options?: {
  onlyMissing?: boolean;
}): Promise<GenerateDuplicateActionPlansResponse> {
  const groupsResponse = await listDerivedDuplicateGroups({ resolutionStatus: 'confirmed' });
  const planIds: string[] = [];
  let skippedCount = 0;

  for (const group of groupsResponse.groups) {
    const existingPlan = await findDuplicateActionPlanByGroupKey(group.groupKey);
    if (options?.onlyMissing && existingPlan) {
      skippedCount += 1;
      continue;
    }

    const derivedPlan = deriveDuplicateActionPlanFromGroup(group);
    if (!derivedPlan) {
      skippedCount += 1;
      continue;
    }

    const normalizedSecondaryAssetIds = normalizeAssetIds(derivedPlan.secondaryAssetIds);
    const preservedStatus = preserveReviewedPlanStatus({
      existingPlanStatus: existingPlan?.planStatus,
      existingCanonicalAssetId: existingPlan?.canonicalAssetId,
      existingSecondaryAssetIds: normalizeAssetIds(existingPlan?.secondaryAssetIds ?? []),
      nextCanonicalAssetId: derivedPlan.canonicalAssetId,
      nextSecondaryAssetIds: normalizedSecondaryAssetIds,
      nextPrimaryActionType: derivedPlan.primaryActionType,
      existingPrimaryActionType: existingPlan?.primaryActionType,
      existingReviewNote: existingPlan?.reviewNote,
      nextAutoStatus: derivedPlan.planStatus
    });

    await upsertDuplicateActionPlan({
      groupKey: group.groupKey,
      canonicalAssetId: derivedPlan.canonicalAssetId,
      secondaryAssetIds: normalizedSecondaryAssetIds,
      primaryActionType: derivedPlan.primaryActionType,
      planStatus: preservedStatus.planStatus,
      executionReadiness: derivedPlan.executionReadiness,
      actionItems: derivedPlan.actionItems,
      rationale: derivedPlan.rationale,
      reviewNote: preservedStatus.reviewNote
    });

    planIds.push(group.groupKey);
  }

  return {
    generatedCount: planIds.length,
    skippedCount,
    planIds
  };
}

export async function listDuplicateActionPlansForReview(
  input: ListDuplicateActionPlansInput
): Promise<ListDuplicateActionPlansResponse> {
  const plans = await listDuplicateActionPlans(input);
  const items = await Promise.all(plans.map((plan) => toListItem(plan)));

  return {
    items,
    total: items.length,
    summary: summarizeDuplicateActionPlans(items)
  };
}

export async function getDuplicateActionPlanForReview(
  planId: string
): Promise<GetDuplicateActionPlanResponse | null> {
  const plan = await findDuplicateActionPlanByGroupKey(planId);
  if (!plan) {
    return null;
  }

  return {
    item: await toListItem(plan)
  };
}

export async function updateDuplicateActionPlanForReview(
  planId: string,
  input: {
    planStatus: DuplicateActionPlanStatus;
    reviewNote?: string;
  }
): Promise<UpdateDuplicateActionPlanResponse | null> {
  const existingPlan = await findDuplicateActionPlanByGroupKey(planId);
  if (!existingPlan) {
    return null;
  }

  if (
    input.planStatus === 'approved' &&
    existingPlan.executionReadiness !== 'eligible_for_future_execution'
  ) {
    throw new Error('Blocked plans cannot be approved until the plan is eligible for future execution.');
  }

  const updatedPlan = await updateDuplicateActionPlanStatus({
    groupKey: planId,
    planStatus: input.planStatus,
    reviewNote: input.reviewNote?.trim() ? input.reviewNote.trim() : null
  });

  if (!updatedPlan) {
    return null;
  }

  return {
    item: await toListItem(updatedPlan)
  };
}

export async function exportDuplicateActionPlans(
  input: ListDuplicateActionPlansInput
): Promise<ExportDuplicateActionPlansResponse> {
  const response = await listDuplicateActionPlansForReview(input);

  return {
    generatedAt: new Date().toISOString(),
    total: response.total,
    items: response.items
  };
}
