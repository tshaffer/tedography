import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  DuplicateActionPlanListItem,
  DuplicateCandidatePairAssetSummary,
  DuplicateGroupListItem
} from '@tedography/shared';
import {
  deriveDuplicateActionPlanFromGroup,
  summarizeDuplicateActionPlans
} from './duplicateActionPlanService.js';

const photoMediaType = 'Photo' as DuplicateCandidatePairAssetSummary['mediaType'];

function createAsset(id: string, path = `/archive/${id}.jpg`): DuplicateCandidatePairAssetSummary {
  return {
    id,
    filename: `${id}.jpg`,
    mediaType: photoMediaType,
    originalArchivePath: path
  };
}

function createGroup(input: {
  groupKey: string;
  resolutionStatus: 'proposed' | 'confirmed';
  selectedCanonicalAssetId: string;
  assets: DuplicateCandidatePairAssetSummary[];
}): DuplicateGroupListItem {
  return {
    groupId: input.groupKey,
    groupKey: input.groupKey,
    assetIds: input.assets.map((asset) => asset.id),
    assetCount: input.assets.length,
    confirmedPairCount: Math.max(1, input.assets.length - 1),
    assets: input.assets,
    proposedCanonicalAssetId: input.selectedCanonicalAssetId,
    selectedCanonicalAssetId: input.selectedCanonicalAssetId,
    manualCanonicalAssetId: null,
    resolutionStatus: input.resolutionStatus,
    nonCanonicalAssetIds: input.assets.filter((asset) => asset.id !== input.selectedCanonicalAssetId).map((asset) => asset.id),
    canonicalReasonSummary: ['Has the highest available resolution in the group.']
  };
}

test('deriveDuplicateActionPlanFromGroup creates safe archive-oriented plans only for confirmed groups', () => {
  const plan = deriveDuplicateActionPlanFromGroup(
    createGroup({
      groupKey: 'group-1',
      resolutionStatus: 'confirmed',
      selectedCanonicalAssetId: 'asset-a',
      assets: [createAsset('asset-a'), createAsset('asset-b')]
    })
  );

  assert.ok(plan);
  assert.equal(plan?.primaryActionType, 'PROPOSE_ARCHIVE_SECONDARY');
  assert.equal(plan?.planStatus, 'proposed');
  assert.equal(plan?.executionReadiness, 'eligible_for_future_execution');
  assert.deepEqual(plan?.secondaryAssetIds, ['asset-b']);
});

test('deriveDuplicateActionPlanFromGroup blocks ambiguous groups for manual review', () => {
  const plan = deriveDuplicateActionPlanFromGroup(
    createGroup({
      groupKey: 'group-2',
      resolutionStatus: 'confirmed',
      selectedCanonicalAssetId: 'asset-a',
      assets: [createAsset('asset-a'), createAsset('asset-b', '')]
    })
  );

  assert.ok(plan);
  assert.equal(plan?.primaryActionType, 'NEEDS_MANUAL_REVIEW');
  assert.equal(plan?.planStatus, 'needs_manual_review');
  assert.equal(plan?.executionReadiness, 'blocked');
  assert.match(plan?.rationale.join(' ') ?? '', /missing original archive path/i);
});

test('deriveDuplicateActionPlanFromGroup skips unresolved groups', () => {
  const plan = deriveDuplicateActionPlanFromGroup(
    createGroup({
      groupKey: 'group-3',
      resolutionStatus: 'proposed',
      selectedCanonicalAssetId: 'asset-a',
      assets: [createAsset('asset-a'), createAsset('asset-b')]
    })
  );

  assert.equal(plan, null);
});

function createPlan(planStatus: DuplicateActionPlanListItem['planStatus']): DuplicateActionPlanListItem {
  return {
    planId: `plan-${planStatus}`,
    groupKey: `group-${planStatus}`,
    canonicalAssetId: 'asset-a',
    canonicalAsset: createAsset('asset-a'),
    secondaryAssetIds: ['asset-b'],
    secondaryAssets: [createAsset('asset-b')],
    actionItems: [
      {
        assetId: 'asset-a',
        actionType: 'KEEP_CANONICAL',
        rationale: ['keeper']
      },
      {
        assetId: 'asset-b',
        actionType: planStatus === 'needs_manual_review' ? 'NEEDS_MANUAL_REVIEW' : 'PROPOSE_ARCHIVE_SECONDARY',
        rationale: ['secondary']
      }
    ],
    primaryActionType:
      planStatus === 'needs_manual_review' ? 'NEEDS_MANUAL_REVIEW' : 'PROPOSE_ARCHIVE_SECONDARY',
    planStatus,
    executionReadiness:
      planStatus === 'needs_manual_review' ? 'blocked' : 'eligible_for_future_execution',
    rationale: ['rationale'],
    reviewNote: null
  };
}

test('summarizeDuplicateActionPlans reports counts for statuses and action types', () => {
  assert.deepEqual(
    summarizeDuplicateActionPlans([
      createPlan('proposed'),
      createPlan('needs_manual_review'),
      createPlan('approved')
    ]),
    {
      total: 3,
      statusCounts: {
        proposed: 1,
        needs_manual_review: 1,
        approved: 1,
        rejected: 0
      },
      actionTypeCounts: {
        KEEP_CANONICAL: 0,
        PROPOSE_ARCHIVE_SECONDARY: 2,
        NEEDS_MANUAL_REVIEW: 1
      },
      eligibleForFutureExecutionCount: 2
    }
  );
});
