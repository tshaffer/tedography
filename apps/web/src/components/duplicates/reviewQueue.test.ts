import test from 'node:test';
import assert from 'node:assert/strict';
import type { DuplicateCandidatePairAssetSummary, DuplicateCandidatePairListItem } from '@tedography/shared';
import {
  getNextDuplicateReviewIndex,
  getPreviousDuplicateReviewIndex,
  removeReviewedDuplicatePair,
  replaceDuplicateReviewQueue
} from './reviewQueue';
import {
  getDefaultDuplicateReviewFocusSide,
  toggleDuplicateReviewFocusSide
} from './focusMode';
import {
  getDuplicateReviewImmersiveActionForKey,
  getDuplicateReviewImmersiveSideForKey,
  getInitialDuplicateReviewImmersiveSide
} from './duplicateReviewImmersive';
import {
  defaultDuplicateReviewFilters,
  getActiveDuplicateReviewPresetId,
  getDuplicateReviewPresetFilters,
  getDuplicateReviewQueueProgress
} from './duplicateReviewPresets';

const photoMediaType = 'Photo' as DuplicateCandidatePairAssetSummary['mediaType'];

function createPair(pairKey: string, assetIdA: string, assetIdB: string): DuplicateCandidatePairListItem {
  return {
    pairKey,
    assetIdA,
    assetIdB,
    analysisVersion: 'analysis-v1',
    generationVersion: 'generation-v1',
    score: 0.95,
    classification: 'very_likely_duplicate',
    status: 'unreviewed',
    outcome: null,
    signals: {},
    assetA: {
      id: assetIdA,
      filename: `${assetIdA}.jpg`,
      mediaType: photoMediaType,
      originalArchivePath: `/archive/${assetIdA}.jpg`
    },
    assetB: {
      id: assetIdB,
      filename: `${assetIdB}.jpg`,
      mediaType: photoMediaType,
      originalArchivePath: `/archive/${assetIdB}.jpg`
    }
  };
}

test('getNextDuplicateReviewIndex advances until the end of the loaded queue', () => {
  assert.equal(getNextDuplicateReviewIndex(0, 3), 1);
  assert.equal(getNextDuplicateReviewIndex(2, 3), 2);
});

test('getPreviousDuplicateReviewIndex moves back without going negative', () => {
  assert.equal(getPreviousDuplicateReviewIndex(2), 1);
  assert.equal(getPreviousDuplicateReviewIndex(0), 0);
});

test('removeReviewedDuplicatePair drops the reviewed pair and preserves the next valid queue position', () => {
  const state = {
    items: [
      createPair('pair-1', 'asset-1a', 'asset-1b'),
      createPair('pair-2', 'asset-2a', 'asset-2b'),
      createPair('pair-3', 'asset-3a', 'asset-3b')
    ],
    currentIndex: 1
  };

  const remaining = removeReviewedDuplicatePair(state, 'pair-2');

  assert.deepEqual(remaining.items.map((item) => item.pairKey), ['pair-1', 'pair-3']);
  assert.equal(remaining.currentIndex, 1);
});

test('replaceDuplicateReviewQueue preserves the active pair when it still exists after reload', () => {
  const state = replaceDuplicateReviewQueue(
    [
      createPair('pair-1', 'asset-1a', 'asset-1b'),
      createPair('pair-2', 'asset-2a', 'asset-2b'),
      createPair('pair-3', 'asset-3a', 'asset-3b')
    ],
    'pair-2'
  );

  assert.equal(state.currentIndex, 1);
});

test('duplicate focus mode defaults to the left asset and toggles deterministically', () => {
  assert.equal(getDefaultDuplicateReviewFocusSide(), 'left');
  assert.equal(toggleDuplicateReviewFocusSide('left'), 'right');
  assert.equal(toggleDuplicateReviewFocusSide('right'), 'left');
});

test('duplicate immersive mode opens on the currently focused side and maps keyboard controls predictably', () => {
  assert.equal(getInitialDuplicateReviewImmersiveSide('left'), 'left');
  assert.equal(getInitialDuplicateReviewImmersiveSide('right'), 'right');
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'Tab', currentSide: 'left' }),
    'right'
  );
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'ArrowLeft', currentSide: 'right' }),
    'left'
  );
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'ArrowRight', currentSide: 'left' }),
    'right'
  );
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'A', currentSide: 'right' }),
    null
  );
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'D', currentSide: 'left' }),
    null
  );
  assert.equal(
    getDuplicateReviewImmersiveSideForKey({ key: 'Escape', currentSide: 'left' }),
    null
  );
});

test('duplicate immersive mode keyboard actions map to review commands predictably', () => {
  assert.equal(getDuplicateReviewImmersiveActionForKey('D'), 'confirmed_duplicate');
  assert.equal(getDuplicateReviewImmersiveActionForKey('n'), 'not_duplicate');
  assert.equal(getDuplicateReviewImmersiveActionForKey('I'), 'ignored');
  assert.equal(getDuplicateReviewImmersiveActionForKey('j'), 'next');
  assert.equal(getDuplicateReviewImmersiveActionForKey('K'), 'previous');
  assert.equal(getDuplicateReviewImmersiveActionForKey('Escape'), 'close');
  assert.equal(getDuplicateReviewImmersiveActionForKey('Tab'), null);
});

test('duplicate review presets map to concrete filter values and match the active slice', () => {
  const veryLikely = getDuplicateReviewPresetFilters('very_likely');
  const highConfidenceQuickPass = getDuplicateReviewPresetFilters('high_confidence_quick_pass');

  assert.deepEqual(veryLikely, {
    ...defaultDuplicateReviewFilters,
    classification: 'very_likely_duplicate'
  });
  assert.equal(getActiveDuplicateReviewPresetId(veryLikely), 'very_likely');
  assert.equal(getActiveDuplicateReviewPresetId(highConfidenceQuickPass), 'high_confidence_quick_pass');
  assert.equal(
    getActiveDuplicateReviewPresetId({
      ...veryLikely,
      assetId: 'asset-123'
    }),
    null
  );
});

test('duplicate review queue progress is derived from the current filtered queue state', () => {
  assert.deepEqual(
    getDuplicateReviewQueueProgress({
      currentIndex: 2,
      loadedCount: 100,
      totalMatching: 245,
      hasCurrentPair: true
    }),
    {
      currentPosition: 3,
      totalMatching: 245,
      remainingTotal: 242,
      loadedCount: 100,
      remainingLoaded: 97
    }
  );

  assert.deepEqual(
    getDuplicateReviewQueueProgress({
      currentIndex: 0,
      loadedCount: 0,
      totalMatching: 0,
      hasCurrentPair: false
    }),
    {
      currentPosition: 0,
      totalMatching: 0,
      remainingTotal: 0,
      loadedCount: 0,
      remainingLoaded: 0
    }
  );
});
