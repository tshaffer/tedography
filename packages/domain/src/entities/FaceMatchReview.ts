import type { FaceDetectionIgnoredReason } from './FaceDetection.js';

export type FaceMatchReviewDecision =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'assignedToDifferentPerson'
  | 'ignored';

export interface FaceMatchReview {
  id: string;
  faceDetectionId: string;
  mediaAssetId: string;
  suggestedPersonId?: string | null;
  suggestedConfidence?: number | null;
  finalPersonId?: string | null;
  decision: FaceMatchReviewDecision;
  reviewer?: string | null;
  notes?: string | null;
  ignoredReason?: FaceDetectionIgnoredReason | null;
  createdAt?: string;
  updatedAt?: string;
}
