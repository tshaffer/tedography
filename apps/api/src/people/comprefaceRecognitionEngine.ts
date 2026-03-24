import type { FaceDetection, MediaAsset, Person } from '@tedography/domain';
import type {
  DetectedFaceResult,
  FaceEnrollmentResult,
  FaceMatchCandidate,
  PeopleRecognitionEngine
} from './recognitionEngine.js';
import { CompreFaceClient } from './comprefaceClient.js';
import { buildCompreFaceSubjectKey, parseCompreFaceSubjectKey } from './comprefaceSubjectMapping.js';

function normalizeBox(box: {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  probability: number | null;
}, width: number, height: number): DetectedFaceResult {
  const boxWidth = Math.max(0, box.xMax - box.xMin);
  const boxHeight = Math.max(0, box.yMax - box.yMin);

  return {
    boundingBox: {
      left: Number((box.xMin / width).toFixed(4)),
      top: Number((box.yMin / height).toFixed(4)),
      width: Number((boxWidth / width).toFixed(4)),
      height: Number((boxHeight / height).toFixed(4))
    },
    detectionConfidence: box.probability !== null ? Number(box.probability.toFixed(4)) : null,
    qualityScore: null
  };
}

export class CompreFaceRecognitionEngine implements PeopleRecognitionEngine {
  public readonly engineName = 'compreface';
  public readonly engineVersion = 'compreface-v1';
  public readonly supportsEnrollment = true;

  private readonly client = new CompreFaceClient();

  public async detectFaces(input: {
    asset: MediaAsset;
    imagePath: string;
  }): Promise<DetectedFaceResult[]> {
    const width = input.asset.width ?? null;
    const height = input.asset.height ?? null;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error(`Asset ${input.asset.id} is missing usable dimensions for CompreFace detection.`);
    }

    const faces = await this.client.detectFaces(input.imagePath);
    return faces.map((face) => normalizeBox(face.box, width, height));
  }

  public async matchFace(input: {
    asset: MediaAsset;
    imagePath: string;
    cropImagePath?: string | null;
    detection: Pick<FaceDetection, 'faceIndex' | 'boundingBox'>;
    people: Person[];
  }): Promise<FaceMatchCandidate[]> {
    if (input.people.length === 0) {
      return [];
    }

    const peopleById = new Map(input.people.map((person) => [person.id, person]));
    const recognizedFaces = await this.client.recognizeFaces(input.cropImagePath ?? input.imagePath);
    const bestFace = recognizedFaces[0] ?? null;
    if (!bestFace) {
      return [];
    }

    return bestFace.subjects
      .flatMap((subject) => {
        const personId = parseCompreFaceSubjectKey(subject.subject);
        if (!personId || !peopleById.has(personId)) {
          return [];
        }

        return [
          {
            personId,
            confidence: Number(subject.similarity.toFixed(4))
          }
        ];
      })
      .sort((left, right) =>
        right.confidence === left.confidence
          ? left.personId.localeCompare(right.personId)
          : right.confidence - left.confidence
      );
  }

  public async enrollFaceExample(input: {
    person: Person;
    asset: MediaAsset;
    imagePath: string;
    cropImagePath: string;
    detection: Pick<FaceDetection, 'id' | 'faceIndex' | 'boundingBox'>;
  }): Promise<FaceEnrollmentResult> {
    const subjectKey = buildCompreFaceSubjectKey(input.person);
    const response = await this.client.addFaceExample(input.cropImagePath, subjectKey);

    return {
      subjectKey,
      exampleId: response.exampleId ?? null
    };
  }
}
