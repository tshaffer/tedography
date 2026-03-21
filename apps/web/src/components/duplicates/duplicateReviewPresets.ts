import type {
  DuplicateCandidateClassification,
  DuplicateCandidateOutcomeFilter,
  DuplicateCandidateStatus
} from '@tedography/shared';

export type DuplicateReviewFilters = {
  status: DuplicateCandidateStatus | 'all';
  classification: DuplicateCandidateClassification | 'all';
  outcome: DuplicateCandidateOutcomeFilter | 'all';
  assetId: string;
  minScore: string;
};

export type DuplicateReviewPresetId =
  | 'unreviewed'
  | 'very_likely'
  | 'possible'
  | 'similar'
  | 'high_confidence_quick_pass';

export type DuplicateReviewQueueProgress = {
  currentPosition: number;
  totalMatching: number;
  remainingTotal: number;
  loadedCount: number;
  remainingLoaded: number;
};

export const defaultDuplicateReviewFilters: DuplicateReviewFilters = {
  status: 'unreviewed',
  classification: 'all',
  outcome: 'all',
  assetId: '',
  minScore: ''
};

export const duplicateReviewPresets: ReadonlyArray<{
  id: DuplicateReviewPresetId;
  label: string;
  description: string;
  filters: DuplicateReviewFilters;
}> = [
  {
    id: 'unreviewed',
    label: 'Unreviewed',
    description: 'All pairs still waiting for review.',
    filters: {
      ...defaultDuplicateReviewFilters
    }
  },
  {
    id: 'very_likely',
    label: 'Very Likely',
    description: 'Unreviewed pairs classified as very likely duplicates.',
    filters: {
      ...defaultDuplicateReviewFilters,
      classification: 'very_likely_duplicate'
    }
  },
  {
    id: 'possible',
    label: 'Possible',
    description: 'Unreviewed pairs classified as possible duplicates.',
    filters: {
      ...defaultDuplicateReviewFilters,
      classification: 'possible_duplicate'
    }
  },
  {
    id: 'similar',
    label: 'Similar',
    description: 'Unreviewed pairs that look similar but are less certain duplicates.',
    filters: {
      ...defaultDuplicateReviewFilters,
      classification: 'similar_image'
    }
  },
  {
    id: 'high_confidence_quick_pass',
    label: 'High-Confidence Quick Pass',
    description: 'Unreviewed, very likely duplicate pairs with score >= 0.90.',
    filters: {
      ...defaultDuplicateReviewFilters,
      classification: 'very_likely_duplicate',
      minScore: '0.90'
    }
  }
];

export function getDuplicateReviewPresetFilters(id: DuplicateReviewPresetId): DuplicateReviewFilters {
  const preset = duplicateReviewPresets.find((entry) => entry.id === id);
  return preset ? { ...preset.filters } : { ...defaultDuplicateReviewFilters };
}

export function getActiveDuplicateReviewPresetId(
  filters: DuplicateReviewFilters
): DuplicateReviewPresetId | null {
  const normalized = {
    ...filters,
    assetId: filters.assetId.trim()
  };

  const match = duplicateReviewPresets.find((preset) =>
    preset.filters.status === normalized.status &&
    preset.filters.classification === normalized.classification &&
    preset.filters.outcome === normalized.outcome &&
    preset.filters.assetId === normalized.assetId &&
    preset.filters.minScore === normalized.minScore
  );

  return match?.id ?? null;
}

export function getDuplicateReviewQueueProgress(input: {
  currentIndex: number;
  loadedCount: number;
  totalMatching: number;
  hasCurrentPair: boolean;
}): DuplicateReviewQueueProgress {
  const currentPosition = input.hasCurrentPair ? input.currentIndex + 1 : 0;
  const remainingTotal = Math.max(input.totalMatching - currentPosition, 0);
  const remainingLoaded = Math.max(input.loadedCount - currentPosition, 0);

  return {
    currentPosition,
    totalMatching: input.totalMatching,
    remainingTotal,
    loadedCount: input.loadedCount,
    remainingLoaded
  };
}
