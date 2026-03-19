import type { DuplicateReviewFocusSide } from './focusMode';

export function getInitialDuplicateReviewImmersiveSide(
  focusedSide: DuplicateReviewFocusSide
): DuplicateReviewFocusSide {
  return focusedSide;
}

export function getDuplicateReviewImmersiveSideForKey(input: {
  key: string;
  currentSide: DuplicateReviewFocusSide;
}): DuplicateReviewFocusSide | null {
  if (input.key === 'Tab') {
    return input.currentSide === 'left' ? 'right' : 'left';
  }

  if (input.key === 'ArrowLeft') {
    return 'left';
  }

  if (input.key === 'ArrowRight') {
    return 'right';
  }

  return null;
}

export function getDuplicateReviewImmersiveActionForKey(
  key: string
): 'confirmed_duplicate' | 'not_duplicate' | 'ignored' | 'next' | 'previous' | 'close' | null {
  if (key === 'Escape') {
    return 'close';
  }

  if (key === 'd' || key === 'D') {
    return 'confirmed_duplicate';
  }

  if (key === 'n' || key === 'N') {
    return 'not_duplicate';
  }

  if (key === 'i' || key === 'I') {
    return 'ignored';
  }

  if (key === 'j' || key === 'J') {
    return 'next';
  }

  if (key === 'k' || key === 'K') {
    return 'previous';
  }

  return null;
}
