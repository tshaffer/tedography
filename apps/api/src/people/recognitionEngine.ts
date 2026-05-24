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

export interface FaceMatchResult {
  candidates: FaceMatchCandidate[];
  /** Sharpness of the searched face as reported by the recognition engine (0–1). */
  searchQualitySharpness?: number | null;
  /** Brightness of the searched face as reported by the recognition engine (0–1). */
  searchQualityBrightness?: number | null;
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

export interface RemoveEnrollmentExampleResult {
  subjectKey?: string | null;
  exampleId?: string | null;
}

export interface PeopleRecognitionEngine {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly supportsEnrollment: boolean;
  readonly prefersFaceCrop: boolean;
  readonly supportsEnrollmentExampleRemoval?: boolean;
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
  }): Promise<FaceMatchResult>;
  enrollFaceExample?(input: {
    person: Person;
    asset: MediaAsset;
    imagePath: string;
    cropImagePath: string;
    detection: Pick<FaceDetection, 'id' | 'faceIndex' | 'boundingBox'>;
  }): Promise<FaceEnrollmentResult>;
  removeEnrolledFaceExample?(input: {
    person: Person;
    exampleId: string;
    subjectKey?: string | null;
  }): Promise<RemoveEnrollmentExampleResult>;
}
