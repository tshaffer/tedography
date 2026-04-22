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

export interface FaceLandmark {
  type: string;
  x: number;
  y: number;
}

export interface FacePose {
  pitch?: number | null;
  roll?: number | null;
  yaw?: number | null;
}

export type FaceDetectionProvider = 'amazon-rekognition';
export type FaceDetectionSourceImageVariant = 'original' | 'display-jpeg' | 'thumbnail';

export interface FaceDetection {
  id: string;
  mediaAssetId: string;
  faceIndex: number;
  boundingBox: FaceBoundingBox;
  cropPath?: string | null;
  previewPath?: string | null;
  detectionProvider?: FaceDetectionProvider | null;
  detectionModelVersion?: string | null;
  detectionConfidence?: number | null;
  landmarks?: FaceLandmark[];
  ageRangeLow?: number | null;
  ageRangeHigh?: number | null;
  estimatedAgeMidpoint?: number | null;
  sharpness?: number | null;
  brightness?: number | null;
  pose?: FacePose | null;
  sourceImageVariant?: FaceDetectionSourceImageVariant | null;
  detectionRunId?: string | null;
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
