import { randomUUID } from 'node:crypto';
import type { FaceDetection } from '@tedography/domain';
import { log } from '../logger.js';
import { FaceDetectionModel } from '../models/faceDetectionModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function normalizeFaceDetection(detection: FaceDetection): FaceDetection {
  const createdAt = normalizeOptionalIsoDate((detection as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((detection as { updatedAt?: unknown }).updatedAt);
  return {
    ...detection,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  };
}

export async function syncFaceDetectionIndexes(): Promise<void> {
  await FaceDetectionModel.syncIndexes();
  log.info('Synchronized faceDetections indexes');
}

export async function replaceFaceDetectionsForAsset(input: {
  mediaAssetId: string;
  detections: Array<Omit<FaceDetection, 'id' | 'createdAt' | 'updatedAt'>>;
}): Promise<FaceDetection[]> {
  await FaceDetectionModel.deleteMany({ mediaAssetId: input.mediaAssetId });

  if (input.detections.length === 0) {
    return [];
  }

  const created = input.detections.map((detection) => ({
    ...detection,
    id: randomUUID()
  }));

  await FaceDetectionModel.insertMany(created, { ordered: true });
  const detections = await FaceDetectionModel.find({ mediaAssetId: input.mediaAssetId }, { _id: 0 })
    .sort({ faceIndex: 1, id: 1 })
    .lean<FaceDetection[]>();
  return detections.map(normalizeFaceDetection);
}

export async function listFaceDetectionsByAssetId(mediaAssetId: string): Promise<FaceDetection[]> {
  const detections = await FaceDetectionModel.find({ mediaAssetId }, { _id: 0 })
    .sort({ faceIndex: 1, id: 1 })
    .lean<FaceDetection[]>();
  return detections.map(normalizeFaceDetection);
}

export async function findFaceDetectionById(id: string): Promise<FaceDetection | null> {
  const detection = await FaceDetectionModel.findOne({ id }, { _id: 0 }).lean<FaceDetection | null>();
  return detection ? normalizeFaceDetection(detection) : null;
}

export async function updateFaceDetection(input: {
  id: string;
  matchedPersonId?: string | null;
  matchConfidence?: number | null;
  matchStatus: FaceDetection['matchStatus'];
  autoMatchCandidatePersonId?: string | null;
  autoMatchCandidateConfidence?: number | null;
  ignoredReason?: FaceDetection['ignoredReason'];
}): Promise<FaceDetection | null> {
  const detection = await FaceDetectionModel.findOneAndUpdate(
    { id: input.id },
    {
      $set: {
        matchedPersonId: input.matchedPersonId ?? null,
        matchConfidence: input.matchConfidence ?? null,
        matchStatus: input.matchStatus,
        autoMatchCandidatePersonId: input.autoMatchCandidatePersonId ?? null,
        autoMatchCandidateConfidence: input.autoMatchCandidateConfidence ?? null,
        ignoredReason: input.ignoredReason ?? null
      }
    },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<FaceDetection | null>();
  return detection ? normalizeFaceDetection(detection) : null;
}
