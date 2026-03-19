export type DuplicateCandidateClassification =
  | 'very_likely_duplicate'
  | 'possible_duplicate'
  | 'similar_image';

export type DuplicateCandidateStatus = 'unreviewed' | 'ignored' | 'reviewed';
export type DuplicateCandidateReviewOutcome =
  | 'confirmed_duplicate'
  | 'not_duplicate'
  | 'ignored';

export interface DuplicateCandidateSignals {
  dHashDistance?: number;
  pHashDistance?: number;
  dimensionsSimilarity?: number;
  aspectRatioDelta?: number;
  sourceUpdatedTimeDeltaMs?: number;
}

export interface DuplicateCandidatePair {
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
  score: number;
  classification: DuplicateCandidateClassification;
  status: DuplicateCandidateStatus;
  outcome?: DuplicateCandidateReviewOutcome | null;
  signals: DuplicateCandidateSignals;
  createdAt?: Date;
  updatedAt?: Date;
}
