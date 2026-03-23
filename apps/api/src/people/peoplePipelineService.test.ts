import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';
import { determinePeoplePipelineEligibilityForTest, normalizeDerivedAssetPeopleForTest } from './peoplePipelineService.testable.js';

function createAsset(overrides?: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'asset-1',
    filename: 'asset-1.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Keep,
    importedAt: new Date('2026-03-23T00:00:00.000Z').toISOString(),
    originalStorageRootId: 'archive',
    originalArchivePath: '2026/asset-1.jpg',
    originalFileSizeBytes: 123,
    originalContentHash: 'hash-1',
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayStorageRootId: 'archive',
    displayArchivePath: '2026/asset-1.jpg',
    displayDerivedPath: null,
    displayFileFormat: 'jpg',
    albumIds: [],
    people: [],
    width: 4000,
    height: 3000,
    ...overrides
  };
}

test('people pipeline eligibility accepts jpg photos and rejects videos', () => {
  assert.deepEqual(determinePeoplePipelineEligibilityForTest(createAsset()), { eligible: true });
  assert.deepEqual(
    determinePeoplePipelineEligibilityForTest(createAsset({ mediaType: MediaType.Video, originalFileFormat: 'mp4' })),
    { eligible: false, reason: 'only-photo-assets-supported' }
  );
});

test('derived mediaAsset.people includes unique confirmed people sorted deterministically', () => {
  const derived = normalizeDerivedAssetPeopleForTest([
    {
      personId: 'person-b',
      displayName: 'Bob',
      source: 'confirmed-face-detection',
      confirmedAt: '2026-03-23T00:00:02.000Z'
    },
    {
      personId: 'person-a',
      displayName: 'Alice',
      source: 'confirmed-face-detection',
      confirmedAt: '2026-03-23T00:00:01.000Z'
    }
  ]);

  assert.deepEqual(derived.map((item) => item.personId), ['person-a', 'person-b']);
});
