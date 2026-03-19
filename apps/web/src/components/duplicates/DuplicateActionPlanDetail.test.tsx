import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DuplicateActionPlanListItem, DuplicateCandidatePairAssetSummary } from '@tedography/shared';
import { DuplicateActionPlanDetail } from './DuplicateActionPlanDetail';

const photoMediaType = 'Photo' as DuplicateCandidatePairAssetSummary['mediaType'];

function createAsset(id: string, filename: string): DuplicateCandidatePairAssetSummary {
  return {
    id,
    filename,
    mediaType: photoMediaType,
    originalArchivePath: `/archive/${filename}`
  };
}

function createPlan(): DuplicateActionPlanListItem {
  const canonicalAsset = createAsset('asset-a', 'keeper.jpg');
  const secondaryAsset = createAsset('asset-b', 'duplicate.jpg');

  return {
    planId: 'group-1',
    groupKey: 'group-1',
    canonicalAssetId: canonicalAsset.id,
    canonicalAsset,
    secondaryAssetIds: [secondaryAsset.id],
    secondaryAssets: [secondaryAsset],
    actionItems: [
      {
        assetId: canonicalAsset.id,
        actionType: 'KEEP_CANONICAL',
        rationale: ['Selected canonical asset remains the keeper.']
      },
      {
        assetId: secondaryAsset.id,
        actionType: 'PROPOSE_ARCHIVE_SECONDARY',
        rationale: ['Secondary duplicate should be archived safely.']
      }
    ],
    primaryActionType: 'PROPOSE_ARCHIVE_SECONDARY',
    planStatus: 'proposed',
    executionReadiness: 'eligible_for_future_execution',
    rationale: ['Generated from a confirmed duplicate group.'],
    reviewNote: null
  };
}

test('DuplicateActionPlanDetail renders rationale and planned action content', () => {
  const markup = renderToStaticMarkup(<DuplicateActionPlanDetail plan={createPlan()} />);

  assert.match(markup, /group-1/);
  assert.match(markup, /Generated from a confirmed duplicate group/);
  assert.match(markup, /PROPOSE_ARCHIVE_SECONDARY/);
  assert.match(markup, /duplicate\.jpg/);
});
