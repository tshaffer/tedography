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

export class PeopleRecognitionEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'config-missing'
      | 'service-unavailable'
      | 'request-failed'
      | 'invalid-response'
      | 'unsupported-operation'
  ) {
    super(message);
  }
}

export interface FaceEnrollmentResult {
  subjectKey: string;
  exampleId?: string | null;
}

export interface PeopleRecognitionEngine {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly supportsEnrollment: boolean;
  readonly prefersFaceCrop: boolean;
  detectFaces(input: {
    asset: MediaAsset;
    imagePath: string;
  }): Promise<DetectedFaceResult[]>;
  matchFace(input: {
    asset: MediaAsset;
    imagePath: string;
    cropImagePath?: string | null;
    detection: Pick<FaceDetection, 'faceIndex' | 'boundingBox'>;
    people: Person[];
  }): Promise<FaceMatchCandidate[]>;
  enrollFaceExample?(input: {
    person: Person;
    asset: MediaAsset;
    imagePath: string;
    cropImagePath: string;
    detection: Pick<FaceDetection, 'id' | 'faceIndex' | 'boundingBox'>;
  }): Promise<FaceEnrollmentResult>;
}
