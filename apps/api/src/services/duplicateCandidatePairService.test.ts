import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDuplicateCandidatePairKey,
  mapDecisionToReviewUpdate,
  parseDuplicateCandidatePairKey
} from './duplicateCandidatePairService.js';

test('duplicate candidate pair key round-trips canonical identity', () => {
  const identity = {
    assetIdA: 'asset-a',
    assetIdB: 'asset-b',
    analysisVersion: 'analysis-v1',
    generationVersion: 'generation-v1'
  };

  const pairKey = createDuplicateCandidatePairKey(identity);

  assert.equal(pairKey, 'asset-a__asset-b__analysis-v1__generation-v1');
  assert.deepEqual(parseDuplicateCandidatePairKey(pairKey), identity);
});

test('duplicate candidate pair key parser rejects malformed keys', () => {
  assert.equal(parseDuplicateCandidatePairKey('asset-a__asset-b__analysis-v1'), null);
  assert.equal(parseDuplicateCandidatePairKey('asset-a____analysis-v1__generation-v1'), null);
});

test('review decisions map to preserved workflow state transitions', () => {
  assert.deepEqual(mapDecisionToReviewUpdate('confirmed_duplicate'), {
    status: 'reviewed',
    outcome: 'confirmed_duplicate'
  });
  assert.deepEqual(mapDecisionToReviewUpdate('reviewed_uncertain'), {
    status: 'reviewed',
    outcome: null
  });
  assert.deepEqual(mapDecisionToReviewUpdate('confirmed_duplicate_keep_both'), {
    status: 'reviewed',
    outcome: 'confirmed_duplicate'
  });
  assert.deepEqual(mapDecisionToReviewUpdate('confirmed_duplicate_keep_left'), {
    status: 'reviewed',
    outcome: 'confirmed_duplicate'
  });
  assert.deepEqual(mapDecisionToReviewUpdate('confirmed_duplicate_keep_right'), {
    status: 'reviewed',
    outcome: 'confirmed_duplicate'
  });
  assert.deepEqual(mapDecisionToReviewUpdate('not_duplicate'), {
    status: 'reviewed',
    outcome: 'not_duplicate'
  });
  assert.deepEqual(mapDecisionToReviewUpdate('ignored'), {
    status: 'ignored',
    outcome: 'ignored'
  });
});
