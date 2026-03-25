export type PersonFaceExampleStatus = 'active' | 'removed';

export interface PersonFaceExample {
  id: string;
  personId: string;
  faceDetectionId: string;
  mediaAssetId: string;
  engine: string;
  subjectKey?: string | null;
  engineExampleId?: string | null;
  status: PersonFaceExampleStatus;
  removedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
