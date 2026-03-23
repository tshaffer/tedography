import type { MediaAsset, Person } from '@tedography/domain';
import type { DetectedFaceResult, FaceMatchCandidate, PeopleRecognitionEngine } from './recognitionEngine.js';

export class NoopRecognitionEngine implements PeopleRecognitionEngine {
  public readonly engineName = 'none';
  public readonly engineVersion = 'none';

  public async detectFaces(_input: { asset: MediaAsset; imagePath: string }): Promise<DetectedFaceResult[]> {
    return [];
  }

  public async matchFace(_input: {
    asset: MediaAsset;
    imagePath: string;
    detection: { faceIndex: number; boundingBox: DetectedFaceResult['boundingBox'] };
    people: Person[];
  }): Promise<FaceMatchCandidate[]> {
    return [];
  }
}
