import type { PhotoState } from '@tedography/domain';
import type {
  DuplicateCandidateClassification,
  DuplicateCandidatePairAssetSummary,
  DuplicateCandidateSignals
} from './duplicateCandidatePairs.js';

export interface SimilarAssetMatch {
  asset: DuplicateCandidatePairAssetSummary;
  score: number;
  classification: DuplicateCandidateClassification;
  signals: DuplicateCandidateSignals;
}

export interface FindSimilarAssetsResponse {
  sourceAsset: DuplicateCandidatePairAssetSummary;
  photoStateFilter?: PhotoState;
  analysisVersion: string;
  items: SimilarAssetMatch[];
  totalCandidatesConsidered: number;
}
