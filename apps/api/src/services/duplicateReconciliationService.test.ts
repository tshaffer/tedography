import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import { deriveDuplicateReconciliation, summarizeDuplicateReconciliations } from './duplicateReconciliationService.js';

function createAsset(id: string, albumIds: string[], overrides?: Partial<MediaAsset>): MediaAsset {
  return {
    id,
    filename: `${id}.jpg`,
    mediaType: MediaType.Photo,
    photoState: PhotoState.Keep,
    importedAt: '2024-01-01T00:00:00.000Z',
    originalStorageRootId: 'root-1',
    originalArchivePath: `/archive/${id}.jpg`,
    originalFileSizeBytes: 100,
    originalContentHash: `${id}-hash`,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayStorageRootId: 'root-1',
    displayArchivePath: `/archive/${id}.jpg`,
    displayFileFormat: 'jpg',
    albumIds,
    ...overrides
  };
}

test('deriveDuplicateReconciliation unions album ids onto canonical asset with provenance', () => {
  const result = deriveDuplicateReconciliation({
    groupKey: 'group-1',
    canonicalAsset: createAsset('asset-a', ['album-1']),
    secondaryAssets: [createAsset('asset-b', ['album-2']), createAsset('asset-c', ['album-2', 'album-3'])]
  });

  assert.equal(result.status, 'auto_applied');
  assert.deepEqual(result.nextCanonicalAlbumIds, ['album-1', 'album-2', 'album-3']);
  assert.deepEqual(result.entries[0]?.addedValues, ['album-2', 'album-3']);
  assert.deepEqual(result.entries[0]?.contributedAssetIds, ['asset-b', 'asset-c']);
});

test('deriveDuplicateReconciliation does not overwrite scalar metadata when reconciling albums', () => {
  const result = deriveDuplicateReconciliation({
    groupKey: 'group-2',
    canonicalAsset: createAsset('asset-a', ['album-1'], {
      captureDateTime: null,
      locationLabel: null
    }),
    secondaryAssets: [
      createAsset('asset-b', ['album-1'], {
        captureDateTime: '2020-01-01T00:00:00.000Z',
        locationLabel: 'Somewhere'
      })
    ]
  });

  assert.equal(result.status, 'no_changes');
  assert.equal(result.entries.length, 0);
  assert.match(result.rationale.join(' '), /auto-reconciled in this phase/i);
});

test('summarizeDuplicateReconciliations reports status and album totals', () => {
  assert.deepEqual(
    summarizeDuplicateReconciliations([
      {
        reconciliationId: 'group-1',
        groupKey: 'group-1',
        canonicalAssetId: 'asset-a',
        canonicalAsset: null,
        sourceSecondaryAssetIds: ['asset-b'],
        sourceSecondaryAssets: [],
        status: 'auto_applied',
        entries: [
          {
            fieldName: 'albumIds',
            originalCanonicalValue: [],
            reconciledValue: ['album-1', 'album-2'],
            addedValues: ['album-1', 'album-2'],
            contributedAssetIds: ['asset-b'],
            rationale: ['safe additive merge'],
            status: 'auto_applied'
          }
        ],
        rationale: [],
        actionPlanStatus: 'approved'
      },
      {
        reconciliationId: 'group-2',
        groupKey: 'group-2',
        canonicalAssetId: 'asset-c',
        canonicalAsset: null,
        sourceSecondaryAssetIds: ['asset-d'],
        sourceSecondaryAssets: [],
        status: 'no_changes',
        entries: [],
        rationale: []
      }
    ]),
    {
      total: 2,
      statusCounts: {
        auto_applied: 1,
        no_changes: 1
      },
      totalAddedAlbumAssociations: 2
    }
  );
});
