import {
  DuplicateReconciliationModel,
  type DuplicateReconciliationDocument
} from '../models/duplicateReconciliationModel.js';

export interface ListDuplicateReconciliationsInput {
  groupKey?: string;
  assetId?: string;
  status?: DuplicateReconciliationDocument['status'];
}

export function buildDuplicateReconciliationFilter(
  input: ListDuplicateReconciliationsInput
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.groupKey) {
    filter.groupKey = input.groupKey;
  }

  if (input.status) {
    filter.status = input.status;
  }

  if (input.assetId) {
    filter.$or = [{ canonicalAssetId: input.assetId }, { sourceSecondaryAssetIds: input.assetId }];
  }

  return filter;
}

export async function syncDuplicateReconciliationIndexes(): Promise<void> {
  await DuplicateReconciliationModel.syncIndexes();
}

export async function listDuplicateReconciliations(
  input: ListDuplicateReconciliationsInput
): Promise<DuplicateReconciliationDocument[]> {
  return DuplicateReconciliationModel.find(buildDuplicateReconciliationFilter(input), { _id: 0 })
    .sort({ updatedAt: -1, groupKey: 1 })
    .lean<DuplicateReconciliationDocument[]>();
}

export async function findDuplicateReconciliationByGroupKey(
  groupKey: string
): Promise<DuplicateReconciliationDocument | null> {
  return DuplicateReconciliationModel.findOne({ groupKey }, { _id: 0 })
    .lean<DuplicateReconciliationDocument | null>();
}

export async function upsertDuplicateReconciliation(input: {
  groupKey: string;
  canonicalAssetId: string;
  sourceSecondaryAssetIds: string[];
  status: DuplicateReconciliationDocument['status'];
  entries: DuplicateReconciliationDocument['entries'];
  rationale: string[];
}): Promise<DuplicateReconciliationDocument> {
  const record = await DuplicateReconciliationModel.findOneAndUpdate(
    { groupKey: input.groupKey },
    {
      $set: {
        canonicalAssetId: input.canonicalAssetId,
        sourceSecondaryAssetIds: input.sourceSecondaryAssetIds,
        status: input.status,
        entries: input.entries,
        rationale: input.rationale
      }
    },
    {
      upsert: true,
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateReconciliationDocument | null>();

  if (!record) {
    throw new Error(`Failed to upsert duplicate reconciliation for group ${input.groupKey}.`);
  }

  return record;
}
