import type { DuplicateCandidatePairListItem } from '@tedography/shared';

export interface DuplicateReviewQueueState {
  items: DuplicateCandidatePairListItem[];
  currentIndex: number;
}

export function getNextDuplicateReviewIndex(currentIndex: number, totalItems: number): number {
  if (totalItems <= 0) {
    return 0;
  }

  return currentIndex + 1 < totalItems ? currentIndex + 1 : currentIndex;
}

export function getPreviousDuplicateReviewIndex(currentIndex: number): number {
  return currentIndex > 0 ? currentIndex - 1 : 0;
}

export function removeReviewedDuplicatePair(
  state: DuplicateReviewQueueState,
  pairKey: string
): DuplicateReviewQueueState {
  const items = state.items.filter((item) => item.pairKey !== pairKey);
  if (items.length === 0) {
    return { items, currentIndex: 0 };
  }

  return {
    items,
    currentIndex: Math.min(state.currentIndex, items.length - 1)
  };
}

export function replaceDuplicateReviewQueue(
  items: DuplicateCandidatePairListItem[],
  activePairKey: string | null
): DuplicateReviewQueueState {
  if (items.length === 0) {
    return { items, currentIndex: 0 };
  }

  const matchedIndex =
    activePairKey === null ? -1 : items.findIndex((item) => item.pairKey === activePairKey);

  return {
    items,
    currentIndex: matchedIndex >= 0 ? matchedIndex : 0
  };
}
