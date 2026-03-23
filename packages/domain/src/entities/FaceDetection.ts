export type FaceDetectionMatchStatus =
  | 'unmatched'
  | 'suggested'
  | 'autoMatched'
  | 'confirmed'
  | 'rejected'
  | 'ignored';

export type FaceDetectionIgnoredReason =
  | 'too-small'
  | 'too-low-quality'
  | 'background-face'
  | 'non-person-face'
  | 'user-ignored'
  | 'other';

export interface FaceBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FaceDetection {
  id: string;
  mediaAssetId: string;
  faceIndex: number;
  boundingBox: FaceBoundingBox;
  cropPath?: string | null;
  previewPath?: string | null;
  detectionConfidence?: number | null;
  qualityScore?: number | null;
  faceAreaPercent?: number | null;
  engine: string;
  engineVersion?: string | null;
  pipelineVersion: string;
  matchedPersonId?: string | null;
  matchConfidence?: number | null;
  matchStatus: FaceDetectionMatchStatus;
  autoMatchCandidatePersonId?: string | null;
  autoMatchCandidateConfidence?: number | null;
  ignoredReason?: FaceDetectionIgnoredReason | null;
  createdAt?: string;
  updatedAt?: string;
}
