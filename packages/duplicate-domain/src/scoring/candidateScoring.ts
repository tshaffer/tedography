import type {
  DuplicateCandidateClassification,
  DuplicateCandidateSignals
} from '../models/DuplicateCandidatePair.js';
import type { CandidateGenerationThresholds } from './thresholds.js';
import { DEFAULT_CANDIDATE_GENERATION_THRESHOLDS } from './thresholds.js';

export interface CandidateScoringInput {
  dHashDistance?: number;
  dHashBitLength?: number;
  pHashDistance?: number;
  pHashBitLength?: number;
  width?: number;
  height?: number;
  otherWidth?: number;
  otherHeight?: number;
  sourceUpdatedTimeDeltaMs?: number;
}

export interface CandidateScoringResult {
  score: number;
  classification: DuplicateCandidateClassification;
  signals: DuplicateCandidateSignals;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeDimensionSimilarity(
  width: number,
  height: number,
  otherWidth: number,
  otherHeight: number
): number {
  const widthSimilarity = Math.min(width, otherWidth) / Math.max(width, otherWidth);
  const heightSimilarity = Math.min(height, otherHeight) / Math.max(height, otherHeight);

  return (widthSimilarity + heightSimilarity) / 2;
}

function computeAspectRatioDelta(
  width: number,
  height: number,
  otherWidth: number,
  otherHeight: number
): number {
  const leftRatio = width / height;
  const rightRatio = otherWidth / otherHeight;
  return Math.abs(leftRatio - rightRatio);
}

function computeHashSimilarity(distance: number, bitLength: number): number {
  return clamp(1 - distance / bitLength, 0, 1);
}

export function scoreCandidatePair(
  input: CandidateScoringInput,
  thresholds: CandidateGenerationThresholds = DEFAULT_CANDIDATE_GENERATION_THRESHOLDS
): CandidateScoringResult | null {
  const signals: DuplicateCandidateSignals = {};
  const weightedSimilarities: Array<{ weight: number; similarity: number }> = [];

  if (
    input.width !== undefined &&
    input.height !== undefined &&
    input.otherWidth !== undefined &&
    input.otherHeight !== undefined
  ) {
    const dimensionsSimilarity = computeDimensionSimilarity(
      input.width,
      input.height,
      input.otherWidth,
      input.otherHeight
    );
    const aspectRatioDelta = computeAspectRatioDelta(
      input.width,
      input.height,
      input.otherWidth,
      input.otherHeight
    );

    signals.dimensionsSimilarity = dimensionsSimilarity;
    signals.aspectRatioDelta = aspectRatioDelta;
    weightedSimilarities.push({ weight: 0.1, similarity: dimensionsSimilarity });

    if (aspectRatioDelta > thresholds.maxAspectRatioDelta) {
      return null;
    }
  }

  if (input.dHashDistance !== undefined && input.dHashBitLength !== undefined) {
    signals.dHashDistance = input.dHashDistance;
    weightedSimilarities.push({
      weight: 0.45,
      similarity: computeHashSimilarity(input.dHashDistance, input.dHashBitLength)
    });
  }

  if (input.pHashDistance !== undefined && input.pHashBitLength !== undefined) {
    signals.pHashDistance = input.pHashDistance;
    weightedSimilarities.push({
      weight: 0.45,
      similarity: computeHashSimilarity(input.pHashDistance, input.pHashBitLength)
    });
  }

  if (input.sourceUpdatedTimeDeltaMs !== undefined) {
    signals.sourceUpdatedTimeDeltaMs = input.sourceUpdatedTimeDeltaMs;
  }

  if (weightedSimilarities.length === 0) {
    return null;
  }

  const weightSum = weightedSimilarities.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedScore =
    weightedSimilarities.reduce((sum, entry) => sum + entry.weight * entry.similarity, 0) /
    weightSum;
  const score = Number(weightedScore.toFixed(4));

  const dHashDistance = signals.dHashDistance;
  const pHashDistance = signals.pHashDistance;
  const aspectRatioDelta = signals.aspectRatioDelta ?? 0;

  if (
    dHashDistance !== undefined &&
    pHashDistance !== undefined &&
    dHashDistance <= thresholds.maxVeryLikelyDHashDistance &&
    pHashDistance <= thresholds.maxVeryLikelyPHashDistance &&
    aspectRatioDelta <= 0.02 &&
    score >= thresholds.minVeryLikelyScore
  ) {
    return { score, classification: 'very_likely_duplicate', signals };
  }

  if (
    dHashDistance !== undefined &&
    pHashDistance !== undefined &&
    dHashDistance <= thresholds.maxPossibleDHashDistance &&
    pHashDistance <= thresholds.maxPossiblePHashDistance &&
    aspectRatioDelta <= 0.03 &&
    score >= thresholds.minPossibleScore
  ) {
    return { score, classification: 'possible_duplicate', signals };
  }

  const withinSimilarDistance =
    (dHashDistance !== undefined && dHashDistance <= thresholds.maxSimilarDHashDistance) ||
    (pHashDistance !== undefined && pHashDistance <= thresholds.maxSimilarPHashDistance);

  if (withinSimilarDistance && aspectRatioDelta <= 0.05 && score >= thresholds.minSimilarScore) {
    return { score, classification: 'similar_image', signals };
  }

  return null;
}
