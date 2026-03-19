import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DuplicateReconciliationListItem, DuplicateCandidatePairAssetSummary } from '@tedography/shared';
import { DuplicateReconciliationDetail } from './DuplicateReconciliationDetail';

const photoMediaType = 'Photo' as DuplicateCandidatePairAssetSummary['mediaType'];

function createAsset(id: string, filename: string): DuplicateCandidatePairAssetSummary {
  return {
    id,
    filename,
    mediaType: photoMediaType,
    originalArchivePath: `/archive/${filename}`
  };
}

test('DuplicateReconciliationDetail renders provenance and reconciled values', () => {
  const markup = renderToStaticMarkup(
    <DuplicateReconciliationDetail
      reconciliation={{
        reconciliationId: 'group-1',
        groupKey: 'group-1',
        canonicalAssetId: 'asset-a',
        canonicalAsset: createAsset('asset-a', 'keeper.jpg'),
        sourceSecondaryAssetIds: ['asset-b'],
        sourceSecondaryAssets: [createAsset('asset-b', 'duplicate.jpg')],
        status: 'auto_applied',
        entries: [
          {
            fieldName: 'albumIds',
            originalCanonicalValue: ['album-a'],
            reconciledValue: ['album-a', 'album-b'],
            addedValues: ['album-b'],
            contributedAssetIds: ['asset-b'],
            rationale: ['Album associations are merged by set union.'],
            status: 'auto_applied'
          }
        ],
        rationale: ['Applied low-risk additive metadata reconciliation.'],
        actionPlanStatus: 'approved',
        latestCompletedExecutionStatus: 'completed'
      }}
    />
  );

  assert.match(markup, /group-1/);
  assert.match(markup, /album-b/);
  assert.match(markup, /duplicate\.jpg/);
  assert.match(markup, /completed/);
});
