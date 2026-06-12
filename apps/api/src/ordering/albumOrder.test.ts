import assert from 'node:assert/strict';
import test from 'node:test';
import { compareFilenamesNatural, sortAssetsForSmartAlbumOrder } from '@tedography/shared';
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
