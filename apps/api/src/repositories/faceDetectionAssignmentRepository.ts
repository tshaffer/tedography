import { randomUUID } from 'node:crypto';
import type { FaceBoundingBox, FaceDetectionAssignment } from '@tedography/domain';
import type { PipelineStage } from 'mongoose';
import { log } from '../logger.js';
import { FaceDetectionAssignmentModel } from '../models/faceDetectionAssignmentModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function normalizeFaceDetectionAssignment(item: FaceDetectionAssignment): FaceDetectionAssignment {
  const createdAt = normalizeOptionalIsoDate((item as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((item as { updatedAt?: unknown }).updatedAt);
  return {
    ...item,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  };
}

export type PersonPhotoByEstimatedAgeItem = {
  mediaAssetId: string;
  detectedFaceId: string;
  estimatedAgeMidpoint: number;
  ageRangeLow: number | null;
  ageRangeHigh: number | null;
  boundingBox: FaceBoundingBox;
  personId: string;
  personFaceCountInAsset?: number;
};

export async function syncFaceDetectionAssignmentIndexes(): Promise<void> {
  await FaceDetectionAssignmentModel.syncIndexes();
  log.info('Synchronized faceDetectionAssignments indexes');
}

export async function assignDetectedFaceToPerson(input: {
  detectedFaceId: string;
  mediaAssetId: string;
  personId: string;
  assignmentSource: FaceDetectionAssignment['assignmentSource'];
  assignmentStatus: FaceDetectionAssignment['assignmentStatus'];
  matchConfidence?: number | null;
}): Promise<FaceDetectionAssignment> {
  const item = await FaceDetectionAssignmentModel.findOneAndUpdate(
    { detectedFaceId: input.detectedFaceId },
    {
      $set: {
        mediaAssetId: input.mediaAssetId,
        personId: input.personId,
        assignmentSource: input.assignmentSource,
        assignmentStatus: input.assignmentStatus,
        matchConfidence: input.matchConfidence ?? null
      },
      $setOnInsert: {
        id: randomUUID()
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<FaceDetectionAssignment | null>();

  if (!item) {
    throw new Error(`Failed to upsert face detection assignment for detection ${input.detectedFaceId}`);
  }

  return normalizeFaceDetectionAssignment(item);
}

export async function replaceFaceDetectionAssignmentsForAsset(input: {
  mediaAssetId: string;
  assignments: Array<Omit<FaceDetectionAssignment, 'id' | 'createdAt' | 'updatedAt'>>;
}): Promise<FaceDetectionAssignment[]> {
  await FaceDetectionAssignmentModel.deleteMany({ mediaAssetId: input.mediaAssetId });

  if (input.assignments.length === 0) {
    return [];
  }

  await FaceDetectionAssignmentModel.insertMany(
    input.assignments.map((assignment) => ({
      ...assignment,
      id: randomUUID()
    })),
    { ordered: true }
  );

  const items = await FaceDetectionAssignmentModel.find({ mediaAssetId: input.mediaAssetId }, { _id: 0 })
    .sort({ personId: 1, detectedFaceId: 1 })
    .lean<FaceDetectionAssignment[]>();
  return items.map(normalizeFaceDetectionAssignment);
}

export async function listFaceDetectionAssignmentsByMediaAssetId(
  mediaAssetId: string
): Promise<FaceDetectionAssignment[]> {
  const items = await FaceDetectionAssignmentModel.find({ mediaAssetId }, { _id: 0 })
    .sort({ personId: 1, detectedFaceId: 1 })
    .lean<FaceDetectionAssignment[]>();
  return items.map(normalizeFaceDetectionAssignment);
}

export async function getPhotosForPersonOrderedByEstimatedAge(
  personId: string,
  options?: {
    uniquePhotosOnly?: boolean;
    sortDirection?: 'asc' | 'desc';
  }
): Promise<PersonPhotoByEstimatedAgeItem[]> {
  const sortDirection = options?.sortDirection === 'desc' ? -1 : 1;
  const uniquePhotosOnly = options?.uniquePhotosOnly !== false;

  const basePipeline: PipelineStage[] = [
    {
      $match: {
        personId,
        assignmentStatus: 'confirmed'
      }
    },
    {
      $lookup: {
        from: 'faceDetections',
        localField: 'detectedFaceId',
        foreignField: 'id',
        as: 'detection'
      }
    },
    { $unwind: '$detection' },
    {
      $match: {
        'detection.estimatedAgeMidpoint': { $ne: null }
      }
    }
  ];

  const pipeline: PipelineStage[] = uniquePhotosOnly
    ? [
        {
          $match: {
            personId,
            assignmentStatus: 'confirmed'
          }
        },
        {
          $lookup: {
            from: 'faceDetections',
            localField: 'detectedFaceId',
            foreignField: 'id',
            as: 'detection'
          }
        },
        { $unwind: '$detection' },
        {
          $addFields: {
            boundingBoxArea: {
              $multiply: ['$detection.boundingBox.width', '$detection.boundingBox.height']
            },
            hasEstimatedAge: {
              $cond: [{ $ne: ['$detection.estimatedAgeMidpoint', null] }, 1, 0]
            }
          }
        },
        {
          $sort: {
            mediaAssetId: 1,
            hasEstimatedAge: -1,
            boundingBoxArea: -1,
            detectedFaceId: 1
          }
        },
        {
          $group: {
            _id: '$mediaAssetId',
            personFaceCountInAsset: { $sum: 1 },
            representative: { $first: '$$ROOT' }
          }
        },
        {
          $match: {
            'representative.detection.estimatedAgeMidpoint': { $ne: null }
          }
        },
        {
          $project: {
            _id: 0,
            mediaAssetId: '$_id',
            detectedFaceId: '$representative.detectedFaceId',
            estimatedAgeMidpoint: '$representative.detection.estimatedAgeMidpoint',
            ageRangeLow: '$representative.detection.ageRangeLow',
            ageRangeHigh: '$representative.detection.ageRangeHigh',
            boundingBox: '$representative.detection.boundingBox',
            personId: '$representative.personId',
            personFaceCountInAsset: '$personFaceCountInAsset'
          }
        },
        {
          $sort: {
            estimatedAgeMidpoint: sortDirection,
            mediaAssetId: 1
          }
        }
      ]
    : [
        ...basePipeline,
        {
          $project: {
            _id: 0,
            mediaAssetId: 1,
            detectedFaceId: 1,
            estimatedAgeMidpoint: '$detection.estimatedAgeMidpoint',
            ageRangeLow: '$detection.ageRangeLow',
            ageRangeHigh: '$detection.ageRangeHigh',
            boundingBox: '$detection.boundingBox',
            personId: 1
          }
        },
        {
          $sort: {
            estimatedAgeMidpoint: sortDirection,
            mediaAssetId: 1
          }
        }
      ];

  const items = await FaceDetectionAssignmentModel.aggregate<PersonPhotoByEstimatedAgeItem>(pipeline);
  return items.map((item) => ({
    ...item,
    ageRangeLow: item.ageRangeLow ?? null,
    ageRangeHigh: item.ageRangeHigh ?? null,
    ...(typeof item.personFaceCountInAsset === 'number'
      ? { personFaceCountInAsset: item.personFaceCountInAsset }
      : {})
  }));
}
