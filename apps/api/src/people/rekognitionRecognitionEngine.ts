import type { FaceDetection, MediaAsset, Person } from '@tedography/domain';
import type {
  DetectedFaceResult,
  FaceEnrollmentResult,
  FaceMatchCandidate,
  PeopleRecognitionEngine,
  RemoveEnrollmentExampleResult
} from './recognitionEngine.js';
import { buildPeopleEngineIdentityKey, parsePeopleEngineIdentityKey } from './peopleEngineIdentityKey.js';
import { RekognitionClient } from './rekognitionClient.js';

function normalizeBoundingBox(value: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DetectedFaceResult['boundingBox'] {
  return {
    left: Number(value.left.toFixed(4)),
    top: Number(value.top.toFixed(4)),
    width: Number(value.width.toFixed(4)),
    height: Number(value.height.toFixed(4))
  };
}

export class RekognitionRecognitionEngine implements PeopleRecognitionEngine {
  public readonly engineName = 'rekognition';
  public readonly engineVersion = 'rekognition-v1';
  public readonly supportsEnrollment = true;
  public readonly supportsEnrollmentExampleRemoval = true;
  public readonly prefersFaceCrop = true;

  private readonly client = new RekognitionClient();

  public async detectFaces(input: {
    asset: MediaAsset;
    imagePath: string;
  }): Promise<DetectedFaceResult[]> {
    const faces = await this.client.detectFaces(input.imagePath);
    return faces.map((face) => ({
      boundingBox: normalizeBoundingBox(face.boundingBox),
      detectionProvider: 'amazon-rekognition',
      detectionModelVersion: face.modelVersion ?? null,
      detectionConfidence: face.confidence !== null ? Number(face.confidence.toFixed(4)) : null,
      landmarks: face.landmarks.map((landmark) => ({
        type: landmark.type,
        x: Number(landmark.x.toFixed(4)),
        y: Number(landmark.y.toFixed(4))
      })),
      ageRangeLow: face.ageRangeLow,
      ageRangeHigh: face.ageRangeHigh,
      estimatedAgeMidpoint: face.estimatedAgeMidpoint,
      sharpness: face.sharpness !== null ? Number(face.sharpness.toFixed(4)) : null,
      brightness: face.brightness !== null ? Number(face.brightness.toFixed(4)) : null,
      pose: face.pose
        ? {
            pitch: face.pose.pitch !== null ? Number(face.pose.pitch.toFixed(4)) : null,
            roll: face.pose.roll !== null ? Number(face.pose.roll.toFixed(4)) : null,
            yaw: face.pose.yaw !== null ? Number(face.pose.yaw.toFixed(4)) : null
          }
        : null,
      sourceImageVariant:
        input.asset.originalFileFormat.toLowerCase() === 'jpg' ||
        input.asset.originalFileFormat.toLowerCase() === 'jpeg' ||
        input.asset.originalFileFormat.toLowerCase() === 'png'
          ? 'original'
          : 'display-jpeg',
      qualityScore: face.qualityScore !== null ? Number(face.qualityScore.toFixed(4)) : null
    }));
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
    const matches = await this.client.searchUsersByImage(input.cropImagePath ?? input.imagePath);

    return matches
      .flatMap((match) => {
        const personId = parsePeopleEngineIdentityKey(match.userId);
        if (!personId || !peopleById.has(personId)) {
          return [];
        }

        return [
          {
            personId,
            confidence: Number(match.similarity.toFixed(4))
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
    const subjectKey = buildPeopleEngineIdentityKey(input.person);
    const response = await this.client.enrollUserFaceExample({
      userId: subjectKey,
      imagePath: input.cropImagePath,
      externalImageId: `${input.person.id}__${input.detection.id}`
    });

    return {
      subjectKey,
      exampleId: response.faceIds[0] ?? null
    };
  }

  public async removeEnrolledFaceExample(input: {
    person: Person;
    exampleId: string;
    subjectKey?: string | null;
  }): Promise<RemoveEnrollmentExampleResult> {
    const subjectKey = input.subjectKey ?? buildPeopleEngineIdentityKey(input.person);
    await this.client.removeUserFaceExample({
      userId: subjectKey,
      faceId: input.exampleId
    });

    return {
      subjectKey,
      exampleId: input.exampleId
    };
  }
}
