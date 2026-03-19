import {
  DuplicateGroupResolutionModel,
  type DuplicateGroupResolutionDocument
} from '../models/duplicateGroupResolutionModel.js';

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
}): Promise<DuplicateGroupResolutionDocument> {
  const resolution = await DuplicateGroupResolutionModel.findOneAndUpdate(
    { groupKey: input.groupKey },
    {
      $set: {
        assetIds: input.assetIds,
        proposedCanonicalAssetId: input.proposedCanonicalAssetId,
        manualCanonicalAssetId: input.manualCanonicalAssetId ?? null,
        resolutionStatus: input.resolutionStatus,
        confirmedAt: input.resolutionStatus === 'confirmed' ? new Date() : null
      }
    },
    {
      upsert: true,
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateGroupResolutionDocument | null>();

  if (!resolution) {
    throw new Error(`Failed to upsert duplicate group resolution for ${input.groupKey}.`);
  }

  return resolution;
}
