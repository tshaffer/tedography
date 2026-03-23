import { randomUUID } from 'node:crypto';
import type { FaceMatchReview } from '@tedography/domain';
import { log } from '../logger.js';
import { FaceMatchReviewModel } from '../models/faceMatchReviewModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function normalizeFaceMatchReview(review: FaceMatchReview): FaceMatchReview {
  const createdAt = normalizeOptionalIsoDate((review as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((review as { updatedAt?: unknown }).updatedAt);
  return {
    ...review,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  };
}

export async function syncFaceMatchReviewIndexes(): Promise<void> {
  await FaceMatchReviewModel.syncIndexes();
  log.info('Synchronized faceMatchReviews indexes');
}

export async function replaceFaceMatchReviewsForAsset(input: {
  mediaAssetId: string;
  reviews: Array<Omit<FaceMatchReview, 'id' | 'createdAt' | 'updatedAt'>>;
}): Promise<FaceMatchReview[]> {
  await FaceMatchReviewModel.deleteMany({ mediaAssetId: input.mediaAssetId });

  if (input.reviews.length === 0) {
    return [];
  }

  await FaceMatchReviewModel.insertMany(
    input.reviews.map((review) => ({
      ...review,
      id: randomUUID()
    })),
    { ordered: true }
  );

  const reviews = await FaceMatchReviewModel.find({ mediaAssetId: input.mediaAssetId }, { _id: 0 })
    .sort({ faceDetectionId: 1, id: 1 })
    .lean<FaceMatchReview[]>();
  return reviews.map(normalizeFaceMatchReview);
}

export async function listFaceMatchReviewsByAssetId(mediaAssetId: string): Promise<FaceMatchReview[]> {
  const reviews = await FaceMatchReviewModel.find({ mediaAssetId }, { _id: 0 })
    .sort({ faceDetectionId: 1, id: 1 })
    .lean<FaceMatchReview[]>();
  return reviews.map(normalizeFaceMatchReview);
}

export async function findFaceMatchReviewByDetectionId(faceDetectionId: string): Promise<FaceMatchReview | null> {
  const review = await FaceMatchReviewModel.findOne({ faceDetectionId }, { _id: 0 }).lean<FaceMatchReview | null>();
  return review ? normalizeFaceMatchReview(review) : null;
}

export async function upsertFaceMatchReview(input: {
  faceDetectionId: string;
  mediaAssetId: string;
  suggestedPersonId?: string | null;
  suggestedConfidence?: number | null;
  finalPersonId?: string | null;
  decision: FaceMatchReview['decision'];
  reviewer?: string | null;
  notes?: string | null;
  ignoredReason?: FaceMatchReview['ignoredReason'];
}): Promise<FaceMatchReview> {
  const review = await FaceMatchReviewModel.findOneAndUpdate(
    { faceDetectionId: input.faceDetectionId },
    {
      $set: {
        mediaAssetId: input.mediaAssetId,
        suggestedPersonId: input.suggestedPersonId ?? null,
        suggestedConfidence: input.suggestedConfidence ?? null,
        finalPersonId: input.finalPersonId ?? null,
        decision: input.decision,
        reviewer: input.reviewer ?? null,
        notes: input.notes ?? null,
        ignoredReason: input.ignoredReason ?? null
      },
      $setOnInsert: {
        id: randomUUID()
      }
    },
    {
      upsert: true,
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<FaceMatchReview | null>();

  if (!review) {
    throw new Error(`Failed to upsert face match review for detection ${input.faceDetectionId}`);
  }

  return normalizeFaceMatchReview(review);
}
