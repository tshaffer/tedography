export type FaceDetectionAssignmentSource =
  | 'auto-match'
  | 'manual-confirm'
  | 'manual-reject'
  | 'manual-merge-adjustment';

export type FaceDetectionAssignmentStatus =
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'ignored';

export interface FaceDetectionAssignment {
  id: string;
  detectedFaceId: string;
  mediaAssetId: string;
  personId: string;
  assignmentSource: FaceDetectionAssignmentSource;
  assignmentStatus: FaceDetectionAssignmentStatus;
  matchConfidence?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
