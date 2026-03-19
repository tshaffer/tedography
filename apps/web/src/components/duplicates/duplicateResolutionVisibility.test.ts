import test from 'node:test';
import assert from 'node:assert/strict';
import type { MediaAsset, MediaType, PhotoState } from '@tedography/domain';
import type { DuplicateCandidatePairAssetSummary, DuplicateGroupListItem } from '@tedography/shared';
import {
  buildDuplicateResolutionVisibilityMap,
  filterAssetsByDuplicateSuppression,
  getDuplicateVisibilityBadgeLabel
} from './duplicateResolutionVisibility';

const photoMediaType = 'Photo' as DuplicateCandidatePairAssetSummary['mediaType'];
const photoAssetMediaType = photoMediaType as MediaType;
const newPhotoState = 'New' as PhotoState;

function createAsset(id: string): MediaAsset {
  return {
    id,
    filename: `${id}.jpg`,
    mediaType: photoAssetMediaType,
    photoState: newPhotoState,
    importedAt: '2026-01-01T00:00:00.000Z',
    originalStorageRootId: 'archive',
    originalArchivePath: `${id}.jpg`,
    originalFileSizeBytes: 100,
    originalContentHash: `${id}-hash`,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayFileFormat: 'jpg'
  };
}

function createGroup(input: {
  groupKey: string;
  selectedCanonicalAssetId: string;
  resolutionStatus: 'proposed' | 'confirmed';
}): DuplicateGroupListItem {
  return {
    groupId: input.groupKey,
    groupKey: input.groupKey,
    assetIds: ['asset-a', 'asset-b'],
    assetCount: 2,
    confirmedPairCount: 1,
    assets: [],
    proposedCanonicalAssetId: 'asset-a',
    selectedCanonicalAssetId: input.selectedCanonicalAssetId,
    manualCanonicalAssetId: null,
    resolutionStatus: input.resolutionStatus,
    nonCanonicalAssetIds: ['asset-b'],
    canonicalReasonSummary: ['Has the highest available resolution in the group.']
  };
}

test('confirmed secondary duplicates are hidden by default while canonicals remain visible', () => {
  const visibilityMap = buildDuplicateResolutionVisibilityMap([
    createGroup({ groupKey: 'group-1', selectedCanonicalAssetId: 'asset-a', resolutionStatus: 'confirmed' })
  ]);

  const filtered = filterAssetsByDuplicateSuppression(
    [createAsset('asset-a'), createAsset('asset-b')],
    visibilityMap,
    false
  );

  assert.deepEqual(filtered.map((asset) => asset.id), ['asset-a']);
});

test('showSuppressedDuplicates reveals confirmed secondary duplicates again', () => {
  const visibilityMap = buildDuplicateResolutionVisibilityMap([
    createGroup({ groupKey: 'group-1', selectedCanonicalAssetId: 'asset-a', resolutionStatus: 'confirmed' })
  ]);

  const filtered = filterAssetsByDuplicateSuppression(
    [createAsset('asset-a'), createAsset('asset-b')],
    visibilityMap,
    true
  );

  assert.deepEqual(filtered.map((asset) => asset.id), ['asset-a', 'asset-b']);
});

test('unresolved groups do not suppress assets by default', () => {
  const visibilityMap = buildDuplicateResolutionVisibilityMap([
    createGroup({ groupKey: 'group-1', selectedCanonicalAssetId: 'asset-a', resolutionStatus: 'proposed' })
  ]);

  const filtered = filterAssetsByDuplicateSuppression(
    [createAsset('asset-a'), createAsset('asset-b')],
    visibilityMap,
    false
  );

  assert.deepEqual(filtered.map((asset) => asset.id), ['asset-a', 'asset-b']);
});

test('duplicate visibility badges distinguish canonical and secondary assets', () => {
  const visibilityMap = buildDuplicateResolutionVisibilityMap([
    createGroup({ groupKey: 'group-1', selectedCanonicalAssetId: 'asset-a', resolutionStatus: 'confirmed' })
  ]);

  assert.equal(getDuplicateVisibilityBadgeLabel(visibilityMap.get('asset-a')), 'Keeper');
  assert.equal(getDuplicateVisibilityBadgeLabel(visibilityMap.get('asset-b')), 'Duplicate');
});
