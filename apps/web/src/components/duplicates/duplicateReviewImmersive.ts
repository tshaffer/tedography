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
  if (input.key === 'ArrowLeft' || input.key === 'ArrowRight') {
    return input.currentSide === 'left' ? 'right' : 'left';
  }

  return null;
}

export function getDuplicateReviewImmersiveActionForKey(
  key: string
):
  | 'reviewed_uncertain'
  | 'confirmed_duplicate_keep_both'
  | 'keep_current_photo'
  | 'not_duplicate'
  | 'next'
  | 'previous'
  | 'close'
  | null {
  if (key === 'Escape') {
    return 'close';
  }

  if (key === 'c' || key === 'C') {
    return 'reviewed_uncertain';
  }

  if (key === 'b' || key === 'B') {
    return 'confirmed_duplicate_keep_both';
  }

  if (key === 'j' || key === 'J') {
    return 'next';
  }

  if (key === 'k' || key === 'K') {
    return 'keep_current_photo';
  }

  if (key === 'n' || key === 'N') {
    return 'not_duplicate';
  }

  if (key === 'f' || key === 'F') {
    return 'previous';
  }

  return null;
}
