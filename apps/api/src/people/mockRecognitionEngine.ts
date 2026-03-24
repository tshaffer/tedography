import { createHash } from 'node:crypto';
import type { MediaAsset, Person } from '@tedography/domain';
import type { DetectedFaceResult, FaceMatchCandidate, PeopleRecognitionEngine } from './recognitionEngine.js';

function buildDeterministicSeed(...parts: string[]): number {
  const digest = createHash('sha256').update(parts.join('::')).digest();
  return digest.readUInt32BE(0);
}

function normalizeSeed(seed: number, min: number, max: number): number {
  const ratio = seed / 0xffffffff;
  return min + (max - min) * ratio;
}

function buildMockFaces(asset: MediaAsset): DetectedFaceResult[] {
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  if (width < 320 || height < 320) {
    return [];
  }

  const seed = buildDeterministicSeed(asset.id, asset.originalContentHash);
  const count = (seed % 3) === 0 ? 0 : (seed % 2) + 1;
  const detections: DetectedFaceResult[] = [];

  for (let index = 0; index < count; index += 1) {
    const boxSeed = buildDeterministicSeed(asset.id, String(index));
    const widthRatio = normalizeSeed(boxSeed, 0.18, 0.32);
    const heightRatio = normalizeSeed(boxSeed >>> 1, 0.18, 0.34);
    const left = normalizeSeed(boxSeed >>> 2, 0.08, Math.max(0.08, 0.92 - widthRatio));
    const top = normalizeSeed(boxSeed >>> 3, 0.08, Math.max(0.08, 0.92 - heightRatio));

    detections.push({
      boundingBox: {
        left: Number(left.toFixed(4)),
        top: Number(top.toFixed(4)),
        width: Number(widthRatio.toFixed(4)),
        height: Number(heightRatio.toFixed(4))
      },
      detectionConfidence: Number(normalizeSeed(boxSeed >>> 4, 0.86, 0.995).toFixed(4)),
      qualityScore: Number(normalizeSeed(boxSeed >>> 5, 0.72, 0.98).toFixed(4))
    });
  }

  return detections;
}

export class MockRecognitionEngine implements PeopleRecognitionEngine {
  public readonly engineName = 'mock';
  public readonly engineVersion = 'mock-v1';
  public readonly supportsEnrollment = false;

  public async detectFaces(input: { asset: MediaAsset; imagePath: string }): Promise<DetectedFaceResult[]> {
    return buildMockFaces(input.asset);
  }

  public async matchFace(input: {
    asset: MediaAsset;
    imagePath: string;
    cropImagePath?: string | null;
    detection: { faceIndex: number; boundingBox: DetectedFaceResult['boundingBox'] };
    people: Person[];
  }): Promise<FaceMatchCandidate[]> {
    if (input.people.length === 0) {
      return [];
    }

    const scored = input.people.map((person) => {
      const seed = buildDeterministicSeed(input.asset.id, input.imagePath, person.id, String(input.detection.faceIndex));
      return {
        personId: person.id,
        confidence: Number(normalizeSeed(seed, 0.55, 0.995).toFixed(4))
      };
    });

    return scored.sort((left, right) =>
      right.confidence === left.confidence
        ? left.personId.localeCompare(right.personId)
        : right.confidence - left.confidence
    );
  }
}
