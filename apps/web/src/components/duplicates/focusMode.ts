export type DuplicateReviewFocusSide = 'left' | 'right';

export function getDefaultDuplicateReviewFocusSide(): DuplicateReviewFocusSide {
  return 'left';
}

export function toggleDuplicateReviewFocusSide(
  current: DuplicateReviewFocusSide
): DuplicateReviewFocusSide {
  return current === 'left' ? 'right' : 'left';
}
