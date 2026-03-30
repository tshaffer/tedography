import {
  DuplicateGroupResolutionModel,
  type DuplicateGroupResolutionDocument
} from '../models/duplicateGroupResolutionModel.js';

export type { DuplicateGroupResolutionDocument } from '../models/duplicateGroupResolutionModel.js';

export async function syncDuplicateGroupResolutionIndexes(): Promise<void> {
  await DuplicateGroupResolutionModel.syncIndexes();
}

export async function findDuplicateGroupResolutionByKey(
  groupKey: string
): Promise<DuplicateGroupResolutionDocument | null> {
  return DuplicateGroupResolutionModel.findOne({ groupKey }, { _id: 0 })
    .lean<DuplicateGroupResolutionDocument | null>();
}

export async function upsertDuplicateGroupResolution(input: {
  groupKey: string;
  assetIds: string[];
  proposedCanonicalAssetId: string;
  manualCanonicalAssetId?: string | null;
  resolutionStatus: 'proposed' | 'confirmed';
  rereviewRequiredAt?: Date | null;
}): Promise<DuplicateGroupResolutionDocument> {
  const resolution = await DuplicateGroupResolutionModel.findOneAndUpdate(
    { groupKey: input.groupKey },
    {
      $set: {
        assetIds: input.assetIds,
        proposedCanonicalAssetId: input.proposedCanonicalAssetId,
        manualCanonicalAssetId: input.manualCanonicalAssetId ?? null,
        resolutionStatus: input.resolutionStatus,
        confirmedAt: input.resolutionStatus === 'confirmed' ? new Date() : null,
        rereviewRequiredAt: input.rereviewRequiredAt ?? null
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateGroupResolutionDocument | null>();

  if (!resolution) {
    throw new Error(`Failed to upsert duplicate group resolution for ${input.groupKey}.`);
  }

  return resolution;
}

export async function listDuplicateGroupResolutions(input?: {
  resolutionStatus?: DuplicateGroupResolutionDocument['resolutionStatus'];
}): Promise<DuplicateGroupResolutionDocument[]> {
  const filter = input?.resolutionStatus ? { resolutionStatus: input.resolutionStatus } : {};
  return DuplicateGroupResolutionModel.find(filter, { _id: 0 })
    .lean<DuplicateGroupResolutionDocument[]>();
}

export async function listDuplicateGroupResolutionsByOverlappingAssetIds(input: {
  assetIds: string[];
  resolutionStatus?: DuplicateGroupResolutionDocument['resolutionStatus'];
}): Promise<DuplicateGroupResolutionDocument[]> {
  if (input.assetIds.length === 0) {
    return [];
  }

  const filter: Record<string, unknown> = {
    assetIds: { $in: input.assetIds }
  };

  if (input.resolutionStatus) {
    filter.resolutionStatus = input.resolutionStatus;
  }

  return DuplicateGroupResolutionModel.find(filter, { _id: 0 })
    .lean<DuplicateGroupResolutionDocument[]>();
}

export async function deleteDuplicateGroupResolutionByKey(groupKey: string): Promise<void> {
  await DuplicateGroupResolutionModel.deleteOne({ groupKey });
}

export async function deleteDuplicateGroupResolutionsByOverlappingAssetIds(
  assetIds: string[]
): Promise<void> {
  if (assetIds.length === 0) {
    return;
  }

  await DuplicateGroupResolutionModel.deleteMany({
    assetIds: { $in: assetIds }
  });
}

export async function markDuplicateGroupResolutionsForRereviewByKeys(
  groupKeys: string[]
): Promise<void> {
  if (groupKeys.length === 0) {
    return;
  }

  await DuplicateGroupResolutionModel.updateMany(
    {
      groupKey: { $in: groupKeys },
      resolutionStatus: 'confirmed',
      rereviewRequiredAt: null
    },
    {
      $set: {
        rereviewRequiredAt: new Date()
      }
    }
  );
}

export async function clearDuplicateGroupResolutionRereviewByKey(
  groupKey: string
): Promise<DuplicateGroupResolutionDocument | null> {
  return DuplicateGroupResolutionModel.findOneAndUpdate(
    { groupKey, resolutionStatus: 'confirmed' },
    {
      $set: {
        rereviewRequiredAt: null
      }
    },
    {
      returnDocument: 'after',
      projection: { _id: 0 }
    }
  ).lean<DuplicateGroupResolutionDocument | null>();
}
