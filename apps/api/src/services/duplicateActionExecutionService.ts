import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaAsset } from '@tedography/domain';
import type {
  CreateDuplicateActionExecutionResponse,
  DuplicateActionExecutionItemResult,
  DuplicateActionExecutionListItem,
  GetDuplicateActionExecutionResponse,
  ListDuplicateActionExecutionsResponse,
  RetryDuplicateActionExecutionResponse
} from '@tedography/shared';
import { config } from '../config.js';
import type { DuplicateActionExecutionDocument } from '../models/duplicateActionExecutionModel.js';
import { findById } from '../repositories/assetRepository.js';
import { updateMediaAssetOriginalArchivePath } from '../repositories/assetRepository.js';
import {
  createDuplicateActionExecution,
  findCompletedExecutionForPlan,
  findDuplicateActionExecutionById,
  findLatestExecutionForPlan,
  listDuplicateActionExecutions,
  updateDuplicateActionExecution
} from '../repositories/duplicateActionExecutionRepository.js';
import { findDuplicateActionPlanByGroupKey } from '../repositories/duplicateActionPlanRepository.js';
import { getDerivedDuplicateGroup } from './duplicateGroupService.js';
import { getStorageRootById } from '../import/storageRoots.js';
import { normalizeRelativePath, resolveSafeAbsolutePath } from '../import/storagePathUtils.js';

export class DuplicateActionExecutionError extends Error {}

export function getDuplicateActionExecutionEligibilityError(input: {
  planStatus: 'proposed' | 'needs_manual_review' | 'approved' | 'rejected';
  executionReadiness: 'eligible_for_future_execution' | 'blocked';
  groupResolutionStatus: 'proposed' | 'confirmed';
  currentCanonicalAssetId: string;
  planCanonicalAssetId: string;
  hasCompletedExecution: boolean;
  latestExecutionStatus?: 'pending' | 'running' | 'completed' | 'partially_failed' | 'failed';
}): string | null {
  if (input.planStatus !== 'approved') {
    return 'Only approved plans can be executed.';
  }

  if (input.executionReadiness !== 'eligible_for_future_execution') {
    return 'Blocked plans cannot be executed.';
  }

  if (input.groupResolutionStatus !== 'confirmed') {
    return 'Only confirmed duplicate groups can be executed.';
  }

  if (input.currentCanonicalAssetId !== input.planCanonicalAssetId) {
    return 'Plan canonical asset no longer matches the current confirmed group.';
  }

  if (input.hasCompletedExecution) {
    return 'This plan has already been executed successfully.';
  }

  if (input.latestExecutionStatus === 'running' || input.latestExecutionStatus === 'pending') {
    return 'This plan already has an execution in progress.';
  }

  return null;
}

function buildExecutionItemCounts(itemResults: DuplicateActionExecutionDocument['itemResults']) {
  return {
    succeededCount: itemResults.filter((item) => item.status === 'succeeded').length,
    failedCount: itemResults.filter((item) => item.status === 'failed').length,
    skippedCount: itemResults.filter((item) => item.status === 'skipped').length
  };
}

export function determineExecutionStatus(itemResults: DuplicateActionExecutionDocument['itemResults']) {
  const { succeededCount, failedCount } = buildExecutionItemCounts(itemResults);

  if (failedCount === 0) {
    return 'completed' as const;
  }

  if (succeededCount > 0) {
    return 'partially_failed' as const;
  }

  return 'failed' as const;
}

export function buildDuplicateQuarantineArchivePath(input: {
  quarantineSubdir: string;
  groupKey: string;
  assetId: string;
  sourceArchivePath: string;
}): string {
  const quarantineSubdir = normalizeRelativePath(input.quarantineSubdir);
  const sourceArchivePath = normalizeRelativePath(input.sourceArchivePath);
  const basename = path.posix.basename(sourceArchivePath);

  if (!basename || basename === '.') {
    throw new DuplicateActionExecutionError(`Cannot derive quarantine filename for ${input.assetId}.`);
  }

  const destination = normalizeRelativePath(
    `${quarantineSubdir}/${input.groupKey}/${input.assetId}/${basename}`
  );

  if (destination === sourceArchivePath) {
    throw new DuplicateActionExecutionError(`Quarantine destination matches source path for ${input.assetId}.`);
  }

  return destination;
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function moveAssetToQuarantineWithDependencies(input: {
  asset: MediaAsset;
  groupKey: string;
  quarantineSubdir: string;
  resolveStorageRootAbsolutePath: (storageRootId: string) => string | null;
  updateAssetArchivePath: (input: {
    id: string;
    originalArchivePath: string;
    displayArchivePath?: string | null;
  }) => Promise<MediaAsset | null>;
}): Promise<DuplicateActionExecutionItemResult> {
  const sourceArchivePath = normalizeRelativePath(input.asset.originalArchivePath);
  const quarantineSubdir = normalizeRelativePath(input.quarantineSubdir);
  const storageRootAbsolutePath = input.resolveStorageRootAbsolutePath(input.asset.originalStorageRootId);

  if (!storageRootAbsolutePath) {
    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath: input.asset.originalArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath: input.asset.originalArchivePath,
      status: 'failed',
      errorMessage: `Storage root not found: ${input.asset.originalStorageRootId}`
    };
  }

  if (sourceArchivePath === quarantineSubdir || sourceArchivePath.startsWith(`${quarantineSubdir}/`)) {
    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath: sourceArchivePath,
      status: 'skipped',
      errorMessage: 'Asset already appears to be under the configured quarantine subdirectory.'
    };
  }

  const destinationArchivePath = buildDuplicateQuarantineArchivePath({
    quarantineSubdir,
    groupKey: input.groupKey,
    assetId: input.asset.id,
    sourceArchivePath
  });

  const root = {
    id: input.asset.originalStorageRootId,
    label: input.asset.originalStorageRootId,
    absolutePath: storageRootAbsolutePath
  };
  const sourceAbsolutePath = resolveSafeAbsolutePath(root, sourceArchivePath);
  const destinationAbsolutePath = resolveSafeAbsolutePath(root, destinationArchivePath);

  if (!(await pathExists(sourceAbsolutePath))) {
    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath,
      status: 'failed',
      errorMessage: 'Source file is missing.'
    };
  }

  if (await pathExists(destinationAbsolutePath)) {
    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath,
      status: 'failed',
      errorMessage: 'Destination file already exists.'
    };
  }

  await fs.mkdir(path.dirname(destinationAbsolutePath), { recursive: true });

  try {
    await fs.rename(sourceAbsolutePath, destinationAbsolutePath);
  } catch (error) {
    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Failed to move source file to quarantine.'
    };
  }

  const shouldMirrorDisplayArchivePath =
    input.asset.displayStorageType === 'archive-root' &&
    input.asset.displayStorageRootId === input.asset.originalStorageRootId &&
    normalizeRelativePath(input.asset.displayArchivePath ?? '') === sourceArchivePath;

  try {
    const updatedAsset = await input.updateAssetArchivePath({
      id: input.asset.id,
      originalArchivePath: destinationArchivePath,
      ...(shouldMirrorDisplayArchivePath ? { displayArchivePath: destinationArchivePath } : {})
    });

    if (!updatedAsset) {
      throw new DuplicateActionExecutionError(`Asset ${input.asset.id} could not be updated after move.`);
    }
  } catch (error) {
    try {
      if (!(await pathExists(sourceAbsolutePath))) {
        await fs.rename(destinationAbsolutePath, sourceAbsolutePath);
      }
    } catch (rollbackError) {
      return {
        assetId: input.asset.id,
        sourceStorageRootId: input.asset.originalStorageRootId,
        sourceArchivePath,
        destinationStorageRootId: input.asset.originalStorageRootId,
        destinationArchivePath,
        status: 'failed',
        errorMessage: `Moved file but failed to update database and rollback: ${
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        }`
      };
    }

    return {
      assetId: input.asset.id,
      sourceStorageRootId: input.asset.originalStorageRootId,
      sourceArchivePath,
      destinationStorageRootId: input.asset.originalStorageRootId,
      destinationArchivePath,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Failed to update asset after quarantine move.'
    };
  }

  return {
    assetId: input.asset.id,
    sourceStorageRootId: input.asset.originalStorageRootId,
    sourceArchivePath,
    destinationStorageRootId: input.asset.originalStorageRootId,
    destinationArchivePath,
    status: 'succeeded',
    errorMessage: null
  };
}

async function moveAssetToQuarantine(input: {
  asset: MediaAsset;
  groupKey: string;
}): Promise<DuplicateActionExecutionItemResult> {
  return moveAssetToQuarantineWithDependencies({
    asset: input.asset,
    groupKey: input.groupKey,
    quarantineSubdir: config.duplicateQuarantineSubdir,
    resolveStorageRootAbsolutePath: (storageRootId) => getStorageRootById(storageRootId)?.absolutePath ?? null,
    updateAssetArchivePath: updateMediaAssetOriginalArchivePath
  });
}

function toListItem(execution: DuplicateActionExecutionDocument): DuplicateActionExecutionListItem {
  return {
    executionId: execution.executionId,
    planId: execution.planId,
    groupKey: execution.groupKey,
    operation: execution.operation,
    status: execution.status,
    itemResults: execution.itemResults,
    succeededCount: execution.succeededCount,
    failedCount: execution.failedCount,
    skippedCount: execution.skippedCount,
    ...(execution.startedAt !== undefined ? { startedAt: execution.startedAt?.toISOString() ?? null } : {}),
    ...(execution.completedAt !== undefined ? { completedAt: execution.completedAt?.toISOString() ?? null } : {}),
    ...(execution.createdAt ? { createdAt: execution.createdAt.toISOString() } : {}),
    ...(execution.updatedAt ? { updatedAt: execution.updatedAt.toISOString() } : {})
  };
}

async function validatePlanExecutionEligibility(planId: string): Promise<{
  plan: NonNullable<Awaited<ReturnType<typeof findDuplicateActionPlanByGroupKey>>>;
  currentGroup: NonNullable<Awaited<ReturnType<typeof getDerivedDuplicateGroup>>>['group'];
}> {
  const plan = await findDuplicateActionPlanByGroupKey(planId);
  if (!plan) {
    throw new DuplicateActionExecutionError(`Duplicate action plan not found: ${planId}`);
  }

  const currentGroupResponse = await getDerivedDuplicateGroup(plan.groupKey);
  if (!currentGroupResponse) {
    throw new DuplicateActionExecutionError(`Duplicate group not found: ${plan.groupKey}`);
  }

  const completedExecution = await findCompletedExecutionForPlan(planId);
  const latestExecution = await findLatestExecutionForPlan(planId);
  const eligibilityError = getDuplicateActionExecutionEligibilityError({
    planStatus: plan.planStatus,
    executionReadiness: plan.executionReadiness,
    groupResolutionStatus: currentGroupResponse.group.resolutionStatus,
    currentCanonicalAssetId: currentGroupResponse.group.selectedCanonicalAssetId,
    planCanonicalAssetId: plan.canonicalAssetId,
    hasCompletedExecution: completedExecution !== null,
    ...(latestExecution ? { latestExecutionStatus: latestExecution.status } : {})
  });
  if (eligibilityError) {
    throw new DuplicateActionExecutionError(eligibilityError);
  }

  return {
    plan,
    currentGroup: currentGroupResponse.group
  };
}

async function runExecution(input: {
  planId: string;
  retryExecutionId?: string;
  assetIds?: string[];
}): Promise<DuplicateActionExecutionDocument> {
  const { plan, currentGroup } = await validatePlanExecutionEligibility(input.planId);
  const allowedAssetIds = new Set(
    input.assetIds && input.assetIds.length > 0 ? input.assetIds : plan.secondaryAssetIds
  );

  const execution = await createDuplicateActionExecution({
    executionId: randomUUID(),
    planId: plan.groupKey,
    groupKey: plan.groupKey,
    operation: 'MOVE_TO_QUARANTINE',
    status: 'running',
    itemResults: [],
    succeededCount: 0,
    failedCount: 0,
    skippedCount: 0,
    startedAt: new Date(),
    completedAt: null
  });

  const currentAssets = await Promise.all(
    Array.from(allowedAssetIds).map(async (assetId) => findById(assetId))
  );

  const itemResults: DuplicateActionExecutionItemResult[] = [];

  for (const asset of currentAssets) {
    if (!asset) {
      continue;
    }

    const actionItem = plan.actionItems.find((item) => item.assetId === asset.id);
    if (!actionItem || actionItem.actionType !== 'PROPOSE_ARCHIVE_SECONDARY') {
      itemResults.push({
        assetId: asset.id,
        sourceStorageRootId: asset.originalStorageRootId,
        sourceArchivePath: asset.originalArchivePath,
        destinationStorageRootId: asset.originalStorageRootId,
        destinationArchivePath: asset.originalArchivePath,
        status: 'skipped',
        errorMessage: 'Asset is not eligible for quarantine move under the approved plan.'
      });
      continue;
    }

    itemResults.push(
      await moveAssetToQuarantine({
        asset,
        groupKey: currentGroup.groupKey
      })
    );
  }

  const counts = buildExecutionItemCounts(itemResults);
  const finalStatus = determineExecutionStatus(itemResults);

  const updatedExecution = await updateDuplicateActionExecution({
    executionId: execution.executionId,
    status: finalStatus,
    itemResults,
    ...counts,
    startedAt: execution.startedAt ?? new Date(),
    completedAt: new Date()
  });

  if (!updatedExecution) {
    throw new DuplicateActionExecutionError(`Failed to finalize execution ${execution.executionId}.`);
  }

  return updatedExecution;
}

export async function createDuplicateActionExecutionForPlan(
  planId: string
): Promise<CreateDuplicateActionExecutionResponse> {
  const execution = await runExecution({ planId });

  return {
    item: toListItem(execution)
  };
}

export async function retryDuplicateActionExecution(
  executionId: string
): Promise<RetryDuplicateActionExecutionResponse | null> {
  const priorExecution = await findDuplicateActionExecutionById(executionId);
  if (!priorExecution) {
    return null;
  }

  if (priorExecution.status !== 'failed' && priorExecution.status !== 'partially_failed') {
    throw new DuplicateActionExecutionError('Only failed or partially failed executions can be retried.');
  }

  const retryAssetIds = priorExecution.itemResults
    .filter((item) => item.status === 'failed' || item.status === 'skipped')
    .map((item) => item.assetId);

  if (retryAssetIds.length === 0) {
    throw new DuplicateActionExecutionError('No failed or skipped items are available to retry.');
  }

  const execution = await runExecution({
    planId: priorExecution.planId,
    retryExecutionId: executionId,
    assetIds: retryAssetIds
  });

  return {
    item: toListItem(execution)
  };
}

export async function listDuplicateActionExecutionsForReview(input: {
  planId?: string;
  status?: DuplicateActionExecutionDocument['status'];
}): Promise<ListDuplicateActionExecutionsResponse> {
  const executions = await listDuplicateActionExecutions(input);
  return {
    items: executions.map(toListItem),
    total: executions.length
  };
}

export async function getDuplicateActionExecutionForReview(
  executionId: string
): Promise<GetDuplicateActionExecutionResponse | null> {
  const execution = await findDuplicateActionExecutionById(executionId);
  if (!execution) {
    return null;
  }

  return {
    item: toListItem(execution)
  };
}
