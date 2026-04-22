import { randomUUID } from 'node:crypto';
import type { FaceDetection } from '@tedography/domain';
import { log } from '../logger.js';
import { FaceDetectionModel } from '../models/faceDetectionModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function computeEstimatedAgeMidpoint(input: {
  ageRangeLow?: number | null;
  ageRangeHigh?: number | null;
}): number | null {
  if (typeof input.ageRangeLow !== 'number' || typeof input.ageRangeHigh !== 'number') {
    return null;
  }

  return Number((((input.ageRangeLow + input.ageRangeHigh) / 2)).toFixed(4));
}

function normalizeFaceDetection(detection: FaceDetection): FaceDetection {
  const createdAt = normalizeOptionalIsoDate((detection as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((detection as { updatedAt?: unknown }).updatedAt);
  return {
    ...detection,
    ageRangeLow: detection.ageRangeLow ?? null,
    ageRangeHigh: detection.ageRangeHigh ?? null,
    estimatedAgeMidpoint:
      typeof detection.estimatedAgeMidpoint === 'number'
        ? detection.estimatedAgeMidpoint
        : computeEstimatedAgeMidpoint(detection),
    sharpness: detection.sharpness ?? null,
    brightness: detection.brightness ?? null,
    pose: detection.pose ?? null,
    detectionProvider: detection.detectionProvider ?? null,
    detectionModelVersion: detection.detectionModelVersion ?? null,
    sourceImageVariant: detection.sourceImageVariant ?? null,
    detectionRunId: detection.detectionRunId ?? null,
    landmarks: Array.isArray(detection.landmarks) ? detection.landmarks : [],
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
    estimatedAgeMidpoint:
      typeof detection.estimatedAgeMidpoint === 'number'
        ? detection.estimatedAgeMidpoint
        : computeEstimatedAgeMidpoint(detection),
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

export async function getDetectedFacesForMediaAsset(mediaAssetId: string): Promise<FaceDetection[]> {
  return listFaceDetectionsByAssetId(mediaAssetId);
}

export async function createDetectedFace(
  detection: Omit<FaceDetection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FaceDetection> {
  const id = randomUUID();
  await FaceDetectionModel.create({
    ...detection,
    estimatedAgeMidpoint:
      typeof detection.estimatedAgeMidpoint === 'number'
        ? detection.estimatedAgeMidpoint
        : computeEstimatedAgeMidpoint(detection),
    id
  });

  const created = await findFaceDetectionById(id);
  if (!created) {
    throw new Error(`Failed to load newly created detected face: ${id}`);
  }

  return created;
}

export async function bulkCreateDetectedFaces(
  detections: Array<Omit<FaceDetection, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<FaceDetection[]> {
  if (detections.length === 0) {
    return [];
  }

  const created = detections.map((detection) => ({
    ...detection,
    estimatedAgeMidpoint:
      typeof detection.estimatedAgeMidpoint === 'number'
        ? detection.estimatedAgeMidpoint
        : computeEstimatedAgeMidpoint(detection),
    id: randomUUID()
  }));

  await FaceDetectionModel.insertMany(created, { ordered: true });

  const ids = created.map((item) => item.id);
  const items = await FaceDetectionModel.find({ id: { $in: ids } }, { _id: 0 })
    .sort({ mediaAssetId: 1, faceIndex: 1, id: 1 })
    .lean<FaceDetection[]>();
  return items.map(normalizeFaceDetection);
}

export async function listFaceDetections(input?: {
  mediaAssetId?: string;
  mediaAssetIds?: string[];
  personId?: string;
  statuses?: FaceDetection['matchStatus'][];
  limit?: number;
}): Promise<FaceDetection[]> {
  const query: Record<string, unknown> = {};
  if (input?.mediaAssetId) {
    query.mediaAssetId = input.mediaAssetId;
  } else if (input?.mediaAssetIds && input.mediaAssetIds.length > 0) {
    query.mediaAssetId = { $in: input.mediaAssetIds };
  }

  if (input?.personId) {
    query.$or = [
      { matchedPersonId: input.personId },
      { autoMatchCandidatePersonId: input.personId }
    ];
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
  mediaAssetIds?: string[];
  personId?: string;
}): Promise<Record<FaceDetection['matchStatus'], number>> {
  const query: Record<string, unknown> = {};
  if (input?.mediaAssetId) {
    query.mediaAssetId = input.mediaAssetId;
  } else if (input?.mediaAssetIds && input.mediaAssetIds.length > 0) {
    query.mediaAssetId = { $in: input.mediaAssetIds };
  }

  if (input?.personId) {
    query.$or = [
      { matchedPersonId: input.personId },
      { autoMatchCandidatePersonId: input.personId }
    ];
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

export async function listConfirmedFaceDetectionsByPersonId(
  personId: string,
  limit?: number
): Promise<FaceDetection[]> {
  const query = FaceDetectionModel.find(
    { matchedPersonId: personId, matchStatus: 'confirmed' },
    { _id: 0 }
  )
    .sort({ updatedAt: -1, createdAt: -1, mediaAssetId: 1, faceIndex: 1, id: 1 });

  if (typeof limit === 'number') {
    query.limit(limit);
  }

  const detections = await query.lean<FaceDetection[]>();
  return detections.map(normalizeFaceDetection);
}

export async function summarizeFaceDetectionsByAssetIds(mediaAssetIds: string[]): Promise<
  Record<
    string,
    {
      detectionsCount: number;
      reviewableDetectionsCount: number;
      confirmedDetectionsCount: number;
    }
  >
> {
  if (mediaAssetIds.length === 0) {
    return {};
  }

  const grouped = await FaceDetectionModel.aggregate<{
    _id: string;
    detectionsCount: number;
    reviewableDetectionsCount: number;
    confirmedDetectionsCount: number;
  }>([
    { $match: { mediaAssetId: { $in: mediaAssetIds } } },
    {
      $group: {
        _id: '$mediaAssetId',
        detectionsCount: { $sum: 1 },
        reviewableDetectionsCount: {
          $sum: {
            $cond: [{ $in: ['$matchStatus', ['unmatched', 'suggested', 'autoMatched']] }, 1, 0]
          }
        },
        confirmedDetectionsCount: {
          $sum: {
            $cond: [{ $eq: ['$matchStatus', 'confirmed'] }, 1, 0]
          }
        }
      }
    }
  ]);

  const summaries: Record<
    string,
    {
      detectionsCount: number;
      reviewableDetectionsCount: number;
      confirmedDetectionsCount: number;
    }
  > = {};

  for (const item of grouped) {
    summaries[item._id] = {
      detectionsCount: item.detectionsCount,
      reviewableDetectionsCount: item.reviewableDetectionsCount,
      confirmedDetectionsCount: item.confirmedDetectionsCount
    };
  }

  return summaries;
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
    { returnDocument: 'after', projection: { _id: 0 }, runValidators: true }
  ).lean<FaceDetection | null>();
  return detection ? normalizeFaceDetection(detection) : null;
}
