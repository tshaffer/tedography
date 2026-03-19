import test from 'node:test';
import assert from 'node:assert/strict';
import type { DuplicateGroupListItem } from '@tedography/shared';
import { getSelectedCanonicalAssetId, replaceDuplicateGroupInList } from './duplicateGroupSelection';

function createGroup(groupKey: string, selectedCanonicalAssetId: string): DuplicateGroupListItem {
  return {
    groupId: groupKey,
    groupKey,
    assetIds: ['asset-a', 'asset-b'],
    assetCount: 2,
    confirmedPairCount: 1,
    assets: [],
    proposedCanonicalAssetId: 'asset-a',
    selectedCanonicalAssetId,
    manualCanonicalAssetId: selectedCanonicalAssetId === 'asset-a' ? null : selectedCanonicalAssetId,
    resolutionStatus: 'proposed',
    nonCanonicalAssetIds: ['asset-b'],
    canonicalReasonSummary: ['Has the highest available resolution in the group.']
  };
}

test('getSelectedCanonicalAssetId returns the currently selected canonical asset', () => {
  assert.equal(getSelectedCanonicalAssetId(createGroup('group-1', 'asset-b')), 'asset-b');
});

test('replaceDuplicateGroupInList updates the matching group after override/confirm', () => {
  const groups = [createGroup('group-1', 'asset-a'), createGroup('group-2', 'asset-a')];
  const updated = replaceDuplicateGroupInList(groups, createGroup('group-2', 'asset-b'));

  assert.deepEqual(updated.map((group) => group.selectedCanonicalAssetId), ['asset-a', 'asset-b']);
});
