import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import {
  deriveDuplicateGroups,
  filterDuplicateGroupListItems,
  resolveSelectedCanonicalAssetId,
  sortDuplicateGroupListItems,
  summarizeDuplicateGroups,
  selectProposedCanonicalAsset
} from './duplicateGroupService.js';
import type { DuplicateGroupListItem } from '@tedography/shared';

test('deriveDuplicateGroups returns connected components from confirmed duplicate links', () => {
  const groups = deriveDuplicateGroups([
    { assetIdA: 'A', assetIdB: 'B' },
    { assetIdA: 'B', assetIdB: 'C' },
    { assetIdA: 'D', assetIdB: 'E' }
  ]);

  assert.deepEqual(groups, [
    {
      assetIds: ['A', 'B', 'C'],
      pairKeys: ['A__B', 'B__C']
    },
    {
      assetIds: ['D', 'E'],
      pairKeys: ['D__E']
    }
  ]);
});

function createAsset(input: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'filename'>): MediaAsset {
  return {
    id: input.id,
    filename: input.filename,
    mediaType: input.mediaType ?? MediaType.Photo,
    photoState: input.photoState ?? PhotoState.New,
    importedAt: input.importedAt ?? '2026-01-01T00:00:00.000Z',
    originalStorageRootId: input.originalStorageRootId ?? 'archive',
    originalArchivePath: input.originalArchivePath ?? `${input.id}.jpg`,
    originalFileSizeBytes: input.originalFileSizeBytes ?? 100,
    originalContentHash: input.originalContentHash ?? `${input.id}-hash`,
    originalFileFormat: input.originalFileFormat ?? 'jpg',
    displayStorageType: input.displayStorageType ?? 'archive-root',
    displayFileFormat: input.displayFileFormat ?? 'jpg',
    ...(input.captureDateTime !== undefined ? { captureDateTime: input.captureDateTime } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.locationLabel !== undefined ? { locationLabel: input.locationLabel } : {}),
    ...(input.locationLatitude !== undefined ? { locationLatitude: input.locationLatitude } : {}),
    ...(input.locationLongitude !== undefined ? { locationLongitude: input.locationLongitude } : {})
  };
}

test('selectProposedCanonicalAsset is deterministic and prefers stronger canonical signals', () => {
  const selection = selectProposedCanonicalAsset([
    createAsset({
      id: 'asset-a',
      filename: 'derived-export.jpg',
      displayStorageType: 'derived-root',
      width: 3000,
      height: 2000,
      originalFileFormat: 'jpg',
      photoState: PhotoState.Pending
    }),
    createAsset({
      id: 'asset-b',
      filename: 'original.heic',
      displayStorageType: 'archive-root',
      width: 4000,
      height: 3000,
      originalFileFormat: 'heic',
      photoState: PhotoState.Keep,
      captureDateTime: '2025-01-01T10:00:00.000Z'
    })
  ]);

  assert.equal(selection.canonicalAssetId, 'asset-b');
  assert.ok(selection.reasonSummary.length > 0);
});

test('resolveSelectedCanonicalAssetId keeps a valid manual override over the proposal', () => {
  assert.equal(
    resolveSelectedCanonicalAssetId({
      assetIds: ['asset-a', 'asset-b'],
      proposedCanonicalAssetId: 'asset-a',
      manualCanonicalAssetId: 'asset-b'
    }),
    'asset-b'
  );

  assert.equal(
    resolveSelectedCanonicalAssetId({
      assetIds: ['asset-a', 'asset-b'],
      proposedCanonicalAssetId: 'asset-a',
      manualCanonicalAssetId: 'asset-c'
    }),
    'asset-a'
  );
});

function createGroup(input: {
  groupKey: string;
  assetCount: number;
  resolutionStatus: 'proposed' | 'confirmed';
  selectedCanonicalAssetId?: string;
  proposedCanonicalAssetId?: string;
}): DuplicateGroupListItem {
  const proposedCanonicalAssetId = input.proposedCanonicalAssetId ?? `${input.groupKey}-a`;
  const selectedCanonicalAssetId = input.selectedCanonicalAssetId ?? proposedCanonicalAssetId;
  return {
    groupId: input.groupKey,
    groupKey: input.groupKey,
    assetIds: Array.from({ length: input.assetCount }, (_, index) => `${input.groupKey}-${index + 1}`),
    assetCount: input.assetCount,
    confirmedPairCount: Math.max(1, input.assetCount - 1),
    assets: [],
    proposedCanonicalAssetId,
    selectedCanonicalAssetId,
    manualCanonicalAssetId:
      selectedCanonicalAssetId === proposedCanonicalAssetId ? null : selectedCanonicalAssetId,
    resolutionStatus: input.resolutionStatus,
    nonCanonicalAssetIds: Array.from(
      { length: input.assetCount - 1 },
      (_, index) => `${input.groupKey}-${index + 2}`
    ),
    canonicalReasonSummary: ['Uses deterministic fallback ordering to break ties.']
  };
}

test('filterDuplicateGroupListItems narrows by resolution status, size, and ready-to-confirm state', () => {
  const groups = [
    createGroup({ groupKey: 'group-a', assetCount: 2, resolutionStatus: 'proposed' }),
    createGroup({
      groupKey: 'group-b',
      assetCount: 3,
      resolutionStatus: 'proposed',
      selectedCanonicalAssetId: 'group-b-manual'
    }),
    createGroup({ groupKey: 'group-c', assetCount: 4, resolutionStatus: 'confirmed' })
  ];

  assert.deepEqual(
    filterDuplicateGroupListItems(groups, {
      resolutionStatus: 'proposed',
      exactAssetCount: 2,
      readyToConfirmOnly: true
    }).map((group) => group.groupKey),
    ['group-a']
  );
});

test('sortDuplicateGroupListItems prefers unresolved groups first by default', () => {
  const groups = [
    createGroup({ groupKey: 'group-b', assetCount: 4, resolutionStatus: 'confirmed' }),
    createGroup({ groupKey: 'group-c', assetCount: 3, resolutionStatus: 'proposed' }),
    createGroup({ groupKey: 'group-a', assetCount: 2, resolutionStatus: 'proposed' })
  ];

  assert.deepEqual(
    sortDuplicateGroupListItems(groups, 'unresolved_first').map((group) => group.groupKey),
    ['group-a', 'group-c', 'group-b']
  );
});

test('summarizeDuplicateGroups reports progress and bulk-confirm-ready counts', () => {
  const groups = [
    createGroup({ groupKey: 'group-a', assetCount: 2, resolutionStatus: 'proposed' }),
    createGroup({
      groupKey: 'group-b',
      assetCount: 3,
      resolutionStatus: 'proposed',
      selectedCanonicalAssetId: 'group-b-manual'
    }),
    createGroup({ groupKey: 'group-c', assetCount: 2, resolutionStatus: 'confirmed' })
  ];

  assert.deepEqual(summarizeDuplicateGroups(groups), {
    statusCounts: {
      proposed: 2,
      confirmed: 1
    },
    exactPairGroupCount: 2,
    readyToConfirmCount: 1
  });
});
