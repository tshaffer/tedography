export interface CandidateGenerationThresholds {
  maxAspectRatioDelta: number;
  maxVeryLikelyDHashDistance: number;
  maxVeryLikelyPHashDistance: number;
  maxPossibleDHashDistance: number;
  maxPossiblePHashDistance: number;
  maxSimilarDHashDistance: number;
  maxSimilarPHashDistance: number;
  minVeryLikelyScore: number;
  minPossibleScore: number;
  minSimilarScore: number;
}

export const DEFAULT_CANDIDATE_GENERATION_THRESHOLDS: CandidateGenerationThresholds = {
  maxAspectRatioDelta: 0.08,
  maxVeryLikelyDHashDistance: 4,
  maxVeryLikelyPHashDistance: 8,
  maxPossibleDHashDistance: 8,
  maxPossiblePHashDistance: 14,
  maxSimilarDHashDistance: 10,
  maxSimilarPHashDistance: 18,
  minVeryLikelyScore: 0.9,
  minPossibleScore: 0.82,
  minSimilarScore: 0.72
};
