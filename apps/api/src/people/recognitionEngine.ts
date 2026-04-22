import type {
  FaceBoundingBox,
  FaceDetection,
  FaceDetectionProvider,
  FaceDetectionSourceImageVariant,
  FaceLandmark,
  FacePose,
  MediaAsset,
  Person
} from '@tedography/domain';

export interface DetectedFaceResult {
  boundingBox: FaceBoundingBox;
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
  sourceImageVariant?: FaceDetectionSourceImageVariant;
  detectionRunId?: string | null;
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
  }): Promise<FaceMatchCandidate[]>;
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
