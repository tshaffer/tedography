import test from 'node:test';
import assert from 'node:assert/strict';
import { PhotoState, type MediaAsset } from '@tedography/domain';
import type { DuplicateGroupResolutionDocument } from '../apps/api/src/models/duplicateGroupResolutionModel.js';
import { evaluatePerfectScoreComponent } from './resolve-perfect-score-duplicates.ts';

function createAsset(input: {
  id: string;
  width?: number;
  height?: number;
  originalFileSizeBytes?: number;
}): MediaAsset {
  return {
    id: input.id,
    filename: `${input.id}.jpg`,
    mediaType: 'photo',
    photoState: PhotoState.Keep,
    captureDateTime: null,
    width: input.width ?? 4000,
    height: input.height ?? 3000,
    locationLabel: null,
    locationLatitude: null,
    locationLongitude: null,
    importedAt: new Date().toISOString(),
    originalStorageRootId: 'root-a',
    originalArchivePath: `/archive/${input.id}.jpg`,
    originalFileSizeBytes: input.originalFileSizeBytes ?? 1_000_000,
    originalContentHash: `hash-${input.id}`,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayStorageRootId: 'root-a',
    displayArchivePath: `/archive/${input.id}.jpg`,
    displayDerivedPath: null,
    displayFileFormat: 'jpg',
    thumbnailStorageType: null,
    thumbnailDerivedPath: null,
    thumbnailFileFormat: null,
    thumbnailUrl: null,
    albumIds: []
  };
}

function createConfirmedResolution(input: {
  assetIds: string[];
  proposedCanonicalAssetId: string;
  manualCanonicalAssetId?: string | null;
}): DuplicateGroupResolutionDocument {
  return {
    groupKey: input.assetIds.join('__'),
    assetIds: input.assetIds,
    proposedCanonicalAssetId: input.proposedCanonicalAssetId,
    manualCanonicalAssetId: input.manualCanonicalAssetId ?? null,
    resolutionStatus: 'confirmed',
    confirmedAt: new Date()
  };
}

test('evaluatePerfectScoreComponent prefers the largest file in a safe component', () => {
  const decision = evaluatePerfectScoreComponent({
    assetIds: ['asset-a', 'asset-b', 'asset-c'],
    assets: [
      createAsset({ id: 'asset-a', originalFileSizeBytes: 1_000_000 }),
      createAsset({ id: 'asset-b', originalFileSizeBytes: 1_200_000 }),
      createAsset({ id: 'asset-c', originalFileSizeBytes: 900_000 })
    ],
    candidatePairs: [
      {
        pairKey: 'pair-a-b',
        assetIdA: 'asset-a',
        assetIdB: 'asset-b',
        analysisVersion: 'v1',
        generationVersion: 'g1',
        score: 1,
        classification: 'very_likely_duplicate',
        status: 'unreviewed',
        outcome: null,
        signals: {}
      },
      {
        pairKey: 'pair-b-c',
        assetIdA: 'asset-b',
        assetIdB: 'asset-c',
        analysisVersion: 'v1',
        generationVersion: 'g1',
        score: 1,
        classification: 'very_likely_duplicate',
        status: 'unreviewed',
        outcome: null,
        signals: {}
      }
    ],
    confirmedResolutions: []
  });

  assert.equal(decision.status, 'ready');
  assert.equal(decision.proposedKeeperAssetId, 'asset-b');
});

test('evaluatePerfectScoreComponent uses a deterministic tiebreak when top file size ties', () => {
  const decision = evaluatePerfectScoreComponent({
    assetIds: ['asset-a', 'asset-b'],
    assets: [
      createAsset({ id: 'asset-a', originalFileSizeBytes: 1_000_000 }),
      createAsset({ id: 'asset-b', originalFileSizeBytes: 1_000_000 })
    ],
    candidatePairs: [
      {
        pairKey: 'pair-a-b',
        assetIdA: 'asset-a',
        assetIdB: 'asset-b',
        analysisVersion: 'v1',
        generationVersion: 'g1',
        score: 1,
        classification: 'very_likely_duplicate',
        status: 'unreviewed',
        outcome: null,
        signals: {}
      }
    ],
    confirmedResolutions: []
  });

  assert.equal(decision.status, 'ready');
  assert.equal(decision.proposedKeeperAssetId, 'asset-a');
  assert.equal(
    decision.reason,
    'Selected keeper by deterministic tiebreak after largest-file tie for this perfect-score duplicate pair (lexicographically smallest asset id among tied largest-file assets: asset-a).'
  );
});

test('evaluatePerfectScoreComponent skips when dimensions differ', () => {
  const decision = evaluatePerfectScoreComponent({
    assetIds: ['asset-a', 'asset-b'],
    assets: [
      createAsset({ id: 'asset-a', width: 4000, height: 3000, originalFileSizeBytes: 1_200_000 }),
      createAsset({ id: 'asset-b', width: 2000, height: 1500, originalFileSizeBytes: 1_000_000 })
    ],
    candidatePairs: [
      {
        pairKey: 'pair-a-b',
        assetIdA: 'asset-a',
        assetIdB: 'asset-b',
        analysisVersion: 'v1',
        generationVersion: 'g1',
        score: 1,
        classification: 'very_likely_duplicate',
        status: 'unreviewed',
        outcome: null,
        signals: {}
      }
    ],
    confirmedResolutions: []
  });

  assert.equal(decision.status, 'skip_dimension_mismatch');
});

test('evaluatePerfectScoreComponent skips when an existing confirmed keeper conflicts', () => {
  const decision = evaluatePerfectScoreComponent({
    assetIds: ['asset-a', 'asset-b'],
    assets: [
      createAsset({ id: 'asset-a', originalFileSizeBytes: 1_000_000 }),
      createAsset({ id: 'asset-b', originalFileSizeBytes: 1_200_000 })
    ],
    candidatePairs: [
      {
        pairKey: 'pair-a-b',
        assetIdA: 'asset-a',
        assetIdB: 'asset-b',
        analysisVersion: 'v1',
        generationVersion: 'g1',
        score: 1,
        classification: 'very_likely_duplicate',
        status: 'reviewed',
        outcome: 'confirmed_duplicate',
        signals: {}
      }
    ],
    confirmedResolutions: [
      createConfirmedResolution({
        assetIds: ['asset-a', 'asset-b'],
        proposedCanonicalAssetId: 'asset-a'
      })
    ]
  });

  assert.equal(decision.status, 'skip_existing_confirmed_keeper_conflict');
});
