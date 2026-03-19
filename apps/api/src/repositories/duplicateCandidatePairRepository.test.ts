import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateCandidatePairFilter } from './duplicateCandidatePairRepository.js';

test('buildDuplicateCandidatePairFilter includes classification, status, outcome, assetId, and minScore', () => {
  assert.deepEqual(
    buildDuplicateCandidatePairFilter({
      status: 'reviewed',
      classification: 'very_likely_duplicate',
      outcome: 'confirmed_duplicate',
      assetId: 'asset-123',
      minScore: 0.9
    }),
    {
      status: 'reviewed',
      classification: 'very_likely_duplicate',
      outcome: 'confirmed_duplicate',
      $or: [{ assetIdA: 'asset-123' }, { assetIdB: 'asset-123' }],
      score: { $gte: 0.9 }
    }
  );
});

test('buildDuplicateCandidatePairFilter maps unresolved outcome filter to null outcome', () => {
  assert.deepEqual(
    buildDuplicateCandidatePairFilter({
      outcome: 'none'
    }),
    {
      outcome: null
    }
  );
});
