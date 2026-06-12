import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareFilenamesNatural,
  getEffectiveAlbumSortTime,
  sortAssetsForSmartAlbumOrder
} from '@tedography/shared';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

function sortFilenames(filenames: string[]): string[] {
  return [...filenames].sort(compareFilenamesNatural);
}

test('compareFilenamesNatural orders numeric sequences numerically, not lexicographically', () => {
  assert.deepEqual(sortFilenames(['10.jpg', '9.jpg', '2.jpg', '1.jpg']), [
    '1.jpg',
    '2.jpg',
    '9.jpg',
    '10.jpg'
  ]);
});

test('compareFilenamesNatural orders prefixed sequences with gaps', () => {
  assert.deepEqual(
    sortFilenames(['Image13.jpg', 'Image2.jpg', 'Image11.jpg', 'Image06.jpg', 'Image07.jpg']),
    ['Image2.jpg', 'Image06.jpg', 'Image07.jpg', 'Image11.jpg', 'Image13.jpg']
  );
});

test('compareFilenamesNatural groups duplicate-name (n) suffixes as separate rolls', () => {
  assert.deepEqual(
    sortFilenames(['00(1).jpg', '01.jpg', '01(1).jpg', '00.jpg', '02.jpg', '00(2).jpg']),
    ['00.jpg', '01.jpg', '02.jpg', '00(1).jpg', '01(1).jpg', '00(2).jpg']
  );
});

test('compareFilenamesNatural is deterministic for names that differ only in padding', () => {
  const forward = compareFilenamesNatural('01.jpg', '0001.jpg');
  const reverse = compareFilenamesNatural('0001.jpg', '01.jpg');
  assert.equal(forward !== 0, true);
  assert.equal(Math.sign(forward), -Math.sign(reverse));
});

function makeAsset(overrides: Partial<MediaAsset> & { id: string; filename: string }): MediaAsset {
  return {
    mediaType: MediaType.Photo,
    photoState: PhotoState.New,
    captureDateTime: null,
    importedAt: '2026-01-01T00:00:00.000Z',
    originalStorageRootId: 'root',
    originalArchivePath: `archive/${overrides.filename}`,
    originalFileSizeBytes: 1,
    originalContentHash: overrides.id,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayFileFormat: 'jpg',
    albumIds: ['album-1'],
    albumMemberships: [],
    ...overrides
  };
}

test('sortAssetsForSmartAlbumOrder breaks identical capture-time ties with natural filename order', () => {
  const clumpTime = '1998-08-15T07:00:00.000Z';
  const assets = [
    makeAsset({ id: 'a', filename: 'Agf00010.jpg', captureDateTime: clumpTime }),
    makeAsset({ id: 'b', filename: 'Agf00002.jpg', captureDateTime: clumpTime }),
    makeAsset({ id: 'c', filename: 'Agf00001.jpg', captureDateTime: clumpTime })
  ];

  const sorted = sortAssetsForSmartAlbumOrder(assets, 'album-1');
  assert.deepEqual(
    sorted.map((asset) => asset.filename),
    ['Agf00001.jpg', 'Agf00002.jpg', 'Agf00010.jpg']
  );
});

test('a placed photo interleaves between capture-time photos at its manualSortTime', () => {
  const assets = [
    makeAsset({ id: 'jan', filename: 'jan.jpg', captureDateTime: '1998-01-05T12:00:00.000Z' }),
    makeAsset({ id: 'mar', filename: 'mar.jpg', captureDateTime: '1998-03-10T12:00:00.000Z' }),
    makeAsset({
      id: 'placed',
      filename: 'undated-roll.jpg',
      albumMemberships: [
        {
          albumId: 'album-1',
          manualSortOrdinal: null,
          forceManualOrder: true,
          manualSortTime: Date.parse('1998-02-01T00:00:00.000Z')
        }
      ]
    })
  ];

  const sorted = sortAssetsForSmartAlbumOrder(assets, 'album-1');
  assert.deepEqual(
    sorted.map((asset) => asset.id),
    ['jan', 'placed', 'mar']
  );
});

test('a dated photo dragged to a manual position sorts by its manualSortTime, not its date', () => {
  const assets = [
    makeAsset({ id: 'a', filename: 'a.jpg', captureDateTime: '1998-01-01T00:00:00.000Z' }),
    makeAsset({
      id: 'moved',
      filename: 'moved.jpg',
      captureDateTime: '1998-12-31T00:00:00.000Z',
      albumMemberships: [
        {
          albumId: 'album-1',
          manualSortOrdinal: null,
          forceManualOrder: true,
          manualSortTime: Date.parse('1998-01-02T00:00:00.000Z')
        }
      ]
    }),
    makeAsset({ id: 'b', filename: 'b.jpg', captureDateTime: '1998-06-01T00:00:00.000Z' })
  ];

  const sorted = sortAssetsForSmartAlbumOrder(assets, 'album-1');
  assert.deepEqual(
    sorted.map((asset) => asset.id),
    ['a', 'moved', 'b']
  );
});

test('an undated pinned photo uses its manualSortTime even without forceManualOrder', () => {
  const pinned = makeAsset({
    id: 'pinned',
    filename: 'pinned.jpg',
    albumMemberships: [
      { albumId: 'album-1', manualSortOrdinal: null, forceManualOrder: null, manualSortTime: 1000 }
    ]
  });
  assert.equal(getEffectiveAlbumSortTime(pinned, 'album-1'), 1000);
});

test('legacy manual photos without manualSortTime stay after all timed photos, ordered by ordinal', () => {
  const assets = [
    makeAsset({
      id: 'legacy-2',
      filename: 'legacy-2.jpg',
      albumMemberships: [{ albumId: 'album-1', manualSortOrdinal: 1, forceManualOrder: true }]
    }),
    makeAsset({ id: 'dated', filename: 'dated.jpg', captureDateTime: '2020-01-01T00:00:00.000Z' }),
    makeAsset({
      id: 'legacy-1',
      filename: 'legacy-1.jpg',
      albumMemberships: [{ albumId: 'album-1', manualSortOrdinal: 0, forceManualOrder: true }]
    })
  ];

  const sorted = sortAssetsForSmartAlbumOrder(assets, 'album-1');
  assert.deepEqual(
    sorted.map((asset) => asset.id),
    ['dated', 'legacy-1', 'legacy-2']
  );
});

test('sortAssetsForSmartAlbumOrder keeps capture-time photos before the manual section', () => {
  const assets = [
    makeAsset({
      id: 'manual',
      filename: 'undated.jpg',
      albumMemberships: [{ albumId: 'album-1', manualSortOrdinal: 0, forceManualOrder: true }]
    }),
    makeAsset({ id: 'dated', filename: 'dated.jpg', captureDateTime: '1998-06-01T12:34:56.000Z' })
  ];

  const sorted = sortAssetsForSmartAlbumOrder(assets, 'album-1');
  assert.deepEqual(
    sorted.map((asset) => asset.id),
    ['dated', 'manual']
  );
});
