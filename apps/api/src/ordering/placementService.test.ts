import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import { sortAssetsForSmartAlbumOrder } from '@tedography/shared';
import { computePlacementUpdates, type PlacementUpdate } from './placementService.js';

const ALBUM = 'album-1';

function makeAsset(overrides: Partial<MediaAsset> & { id: string }): MediaAsset {
  return {
    filename: `${overrides.id}.jpg`,
    mediaType: MediaType.Photo,
    photoState: PhotoState.New,
    captureDateTime: null,
    importedAt: '2026-01-01T00:00:00.000Z',
    originalStorageRootId: 'root',
    originalArchivePath: `archive/${overrides.id}.jpg`,
    originalFileSizeBytes: 1,
    originalContentHash: overrides.id,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayFileFormat: 'jpg',
    albumIds: [ALBUM],
    albumMemberships: [],
    ...overrides
  };
}

function dated(id: string, iso: string): MediaAsset {
  return makeAsset({ id, captureDateTime: iso });
}

/** Apply updates in-memory and return the resulting display order of ids. */
function orderAfter(albumAssets: MediaAsset[], updates: PlacementUpdate[]): string[] {
  const byId = new Map(updates.map((update) => [update.assetId, update]));
  const applied = albumAssets.map((asset) => {
    const update = byId.get(asset.id);
    if (!update) {
      return asset;
    }
    const others = (asset.albumMemberships ?? []).filter((m) => m.albumId !== ALBUM);
    return {
      ...asset,
      albumMemberships: [
        ...others,
        {
          albumId: ALBUM,
          manualSortOrdinal: null,
          forceManualOrder: true,
          manualSortTime: update.manualSortTime
        }
      ]
    };
  });
  return sortAssetsForSmartAlbumOrder(applied, ALBUM).map((asset) => asset.id);
}

test('places a photo between two distinct capture times', () => {
  const assets = [
    dated('jan', '1998-01-01T00:00:00.000Z'),
    dated('jun', '1998-06-01T00:00:00.000Z'),
    makeAsset({ id: 'undated' })
  ];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['undated'],
    placeAfterAssetId: 'jan'
  });

  assert.deepEqual(orderAfter(assets, updates), ['jan', 'undated', 'jun']);
  const time = updates[0]?.manualSortTime ?? 0;
  assert.ok(time > Date.parse('1998-01-01T00:00:00.000Z'));
  assert.ok(time < Date.parse('1998-06-01T00:00:00.000Z'));
});

test('places at the start of the album when placeAfterAssetId is null', () => {
  const assets = [dated('jan', '1998-01-01T00:00:00.000Z'), makeAsset({ id: 'undated' })];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['undated'],
    placeAfterAssetId: null
  });

  assert.deepEqual(orderAfter(assets, updates), ['undated', 'jan']);
});

test('places after the last timed photo with open-ended spacing', () => {
  const assets = [dated('jan', '1998-01-01T00:00:00.000Z'), dated('feb', '1998-02-01T00:00:00.000Z'), makeAsset({ id: 'x' })];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['x'],
    placeAfterAssetId: 'feb'
  });

  assert.deepEqual(orderAfter(assets, updates), ['jan', 'feb', 'x']);
});

test('a block of photos keeps its internal order', () => {
  const assets = [
    dated('jan', '1998-01-01T00:00:00.000Z'),
    dated('jun', '1998-06-01T00:00:00.000Z'),
    makeAsset({ id: 'roll-1' }),
    makeAsset({ id: 'roll-2' }),
    makeAsset({ id: 'roll-3' })
  ];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['roll-1', 'roll-2', 'roll-3'],
    placeAfterAssetId: 'jan'
  });

  assert.deepEqual(orderAfter(assets, updates), ['jan', 'roll-1', 'roll-2', 'roll-3', 'jun']);
});

test('placing after a clump member lands after the whole identical-time clump', () => {
  const clumpTime = '1998-08-15T07:00:00.000Z';
  const assets = [
    dated('clump-a', clumpTime),
    dated('clump-b', clumpTime),
    dated('dec', '1998-12-01T00:00:00.000Z'),
    makeAsset({ id: 'moved' })
  ];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['moved'],
    placeAfterAssetId: 'clump-a'
  });

  const order = orderAfter(assets, updates);
  assert.deepEqual(order.slice(2), ['moved', 'dec']);
});

test('placing after an unplaced undated photo pins the anchor first', () => {
  const assets = [
    dated('jan', '1998-01-01T00:00:00.000Z'),
    makeAsset({ id: 'anchor-undated' }),
    makeAsset({ id: 'moved' })
  ];

  const updates = computePlacementUpdates({
    albumId: ALBUM,
    albumAssets: assets,
    movedAssetIds: ['moved'],
    placeAfterAssetId: 'anchor-undated'
  });

  // The anchor is pinned and the moved photo follows it.
  assert.equal(updates.length, 2);
  assert.equal(updates[0]?.assetId, 'anchor-undated');
  assert.deepEqual(orderAfter(assets, updates), ['jan', 'anchor-undated', 'moved']);
});

test('throws when the anchor is not an album member', () => {
  const assets = [dated('jan', '1998-01-01T00:00:00.000Z'), makeAsset({ id: 'moved' })];
  assert.throws(() =>
    computePlacementUpdates({
      albumId: ALBUM,
      albumAssets: assets,
      movedAssetIds: ['moved'],
      placeAfterAssetId: 'not-in-album'
    })
  );
});
