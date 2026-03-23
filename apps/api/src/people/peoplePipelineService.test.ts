import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaType, PhotoState, type FaceDetection, type MediaAsset } from '@tedography/domain';
import {
  determineConfirmedReviewDecisionForTest,
  determinePeoplePipelineEligibilityForTest,
  normalizeDerivedAssetPeopleForTest
} from './peoplePipelineService.testable.js';

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

function createDetection(overrides?: Partial<FaceDetection>): FaceDetection {
  return {
    id: 'detection-1',
    mediaAssetId: 'asset-1',
    faceIndex: 0,
    boundingBox: { left: 0.1, top: 0.1, width: 0.2, height: 0.2 },
    cropPath: null,
    previewPath: null,
    detectionConfidence: 0.9,
    qualityScore: 0.8,
    faceAreaPercent: 4.0,
    engine: 'mock',
    engineVersion: 'mock-v1',
    pipelineVersion: 'people-pipeline-v1',
    matchedPersonId: null,
    matchConfidence: null,
    matchStatus: 'unmatched',
    autoMatchCandidatePersonId: null,
    autoMatchCandidateConfidence: null,
    ignoredReason: null,
    ...overrides
  };
}

test('assigning an unmatched face records a confirmed review decision', () => {
  assert.equal(determineConfirmedReviewDecisionForTest(createDetection(), 'person-1'), 'confirmed');
});

test('assigning a different person than the suggestion records assignedToDifferentPerson', () => {
  assert.equal(
    determineConfirmedReviewDecisionForTest(
      createDetection({
        autoMatchCandidatePersonId: 'person-1',
        autoMatchCandidateConfidence: 0.91,
        matchStatus: 'suggested'
      }),
      'person-2'
    ),
    'assignedToDifferentPerson'
  );
});
