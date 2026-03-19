export type DuplicateReviewFocusSide = 'left' | 'right';
export type DuplicateReviewComparisonMode = 'side_by_side' | 'focus';

export function getDefaultDuplicateReviewFocusSide(): DuplicateReviewFocusSide {
  return 'left';
}

export function toggleDuplicateReviewFocusSide(
  current: DuplicateReviewFocusSide
): DuplicateReviewFocusSide {
  return current === 'left' ? 'right' : 'left';
}

