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

export async function listFaceDetections(input?: {
  mediaAssetId?: string;
  statuses?: FaceDetection['matchStatus'][];
  limit?: number;
}): Promise<FaceDetection[]> {
  const query: Record<string, unknown> = {};
  if (input?.mediaAssetId) {
    query.mediaAssetId = input.mediaAssetId;
  }

  if (input?.statuses && input.statuses.length > 0) {
    query.matchStatus = { $in: input.statuses };
  }

  const detections = await FaceDetectionModel.find(query, { _id: 0 })
    .sort({ updatedAt: -1, createdAt: -1, mediaAssetId: 1, faceIndex: 1, id: 1 })
    .limit(input?.limit ?? 500)
    .lean<FaceDetection[]>();
  return detections.map(normalizeFaceDetection);
}

export async function countFaceDetectionsByStatus(input?: {
  mediaAssetId?: string;
}): Promise<Record<FaceDetection['matchStatus'], number>> {
  const query: Record<string, unknown> = {};
  if (input?.mediaAssetId) {
    query.mediaAssetId = input.mediaAssetId;
  }

  const grouped = await FaceDetectionModel.aggregate<{ _id: FaceDetection['matchStatus']; count: number }>([
    { $match: query },
    { $group: { _id: '$matchStatus', count: { $sum: 1 } } }
  ]);

  const counts: Record<FaceDetection['matchStatus'], number> = {
    unmatched: 0,
    suggested: 0,
    autoMatched: 0,
    confirmed: 0,
    rejected: 0,
    ignored: 0
  };

  for (const item of grouped) {
    counts[item._id] = item.count;
  }

  return counts;
}

export async function findFaceDetectionById(id: string): Promise<FaceDetection | null> {
  const detection = await FaceDetectionModel.findOne({ id }, { _id: 0 }).lean<FaceDetection | null>();
  return detection ? normalizeFaceDetection(detection) : null;
}

export async function updateFaceDetection(input: {
  id: string;
  cropPath?: string | null;
  previewPath?: string | null;
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
        ...(input.cropPath !== undefined ? { cropPath: input.cropPath } : {}),
        ...(input.previewPath !== undefined ? { previewPath: input.previewPath } : {}),
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
