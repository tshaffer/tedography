import type { FaceBoundingBox, FaceDetection, MediaAsset, Person } from '@tedography/domain';

export interface DetectedFaceResult {
  boundingBox: FaceBoundingBox;
  detectionConfidence?: number | null;
  qualityScore?: number | null;
}

export interface FaceMatchCandidate {
  personId: string;
  confidence: number;
}

export interface PeopleRecognitionEngine {
  readonly engineName: string;
  readonly engineVersion: string;
  detectFaces(input: {
    asset: MediaAsset;
    imagePath: string;
  }): Promise<DetectedFaceResult[]>;
  matchFace(input: {
    asset: MediaAsset;
    imagePath: string;
    detection: Pick<FaceDetection, 'faceIndex' | 'boundingBox'>;
    people: Person[];
  }): Promise<FaceMatchCandidate[]>;
}
