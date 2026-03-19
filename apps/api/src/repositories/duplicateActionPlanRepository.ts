import {
  DuplicateActionPlanModel,
  type DuplicateActionPlanDocument
} from '../models/duplicateActionPlanModel.js';

export interface ListDuplicateActionPlansInput {
  planStatus?: DuplicateActionPlanDocument['planStatus'];
  primaryActionType?: DuplicateActionPlanDocument['primaryActionType'];
  assetId?: string;
}

export function buildDuplicateActionPlanFilter(
  input: ListDuplicateActionPlansInput
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.planStatus) {
    filter.planStatus = input.planStatus;
  }

  if (input.primaryActionType) {
    filter.primaryActionType = input.primaryActionType;
  }

  if (input.assetId) {
    filter.$or = [
      { canonicalAssetId: input.assetId },
      { secondaryAssetIds: input.assetId }
    ];
  }

  return filter;
}

export async function syncDuplicateActionPlanIndexes(): Promise<void> {
  await DuplicateActionPlanModel.syncIndexes();
}

export async function listDuplicateActionPlans(
  input: ListDuplicateActionPlansInput
): Promise<DuplicateActionPlanDocument[]> {
  return DuplicateActionPlanModel.find(buildDuplicateActionPlanFilter(input), { _id: 0 })
    .sort({ planStatus: 1, updatedAt: -1, groupKey: 1 })
    .lean<DuplicateActionPlanDocument[]>();
}

export async function findDuplicateActionPlanByGroupKey(
  groupKey: string
): Promise<DuplicateActionPlanDocument | null> {
  return DuplicateActionPlanModel.findOne({ groupKey }, { _id: 0 })
    .lean<DuplicateActionPlanDocument | null>();
}

export async function upsertDuplicateActionPlan(input: {
  groupKey: string;
  canonicalAssetId: string;
  secondaryAssetIds: string[];
  primaryActionType: DuplicateActionPlanDocument['primaryActionType'];
  planStatus: DuplicateActionPlanDocument['planStatus'];
  executionReadiness: DuplicateActionPlanDocument['executionReadiness'];
  actionItems: DuplicateActionPlanDocument['actionItems'];
  rationale: string[];
  reviewNote?: string | null;
}): Promise<DuplicateActionPlanDocument> {
  const plan = await DuplicateActionPlanModel.findOneAndUpdate(
    { groupKey: input.groupKey },
    {
      $set: {
        canonicalAssetId: input.canonicalAssetId,
        secondaryAssetIds: input.secondaryAssetIds,
        primaryActionType: input.primaryActionType,
        planStatus: input.planStatus,
        executionReadiness: input.executionReadiness,
        actionItems: input.actionItems,
        rationale: input.rationale,
        reviewNote: input.reviewNote ?? null
      }
    },
    {
      upsert: true,
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateActionPlanDocument | null>();

  if (!plan) {
    throw new Error(`Failed to upsert duplicate action plan for group ${input.groupKey}.`);
  }

  return plan;
}

export async function updateDuplicateActionPlanStatus(input: {
  groupKey: string;
  planStatus: DuplicateActionPlanDocument['planStatus'];
  reviewNote?: string | null;
}): Promise<DuplicateActionPlanDocument | null> {
  return DuplicateActionPlanModel.findOneAndUpdate(
    { groupKey: input.groupKey },
    {
      $set: {
        planStatus: input.planStatus,
        reviewNote: input.reviewNote ?? null
      }
    },
    {
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateActionPlanDocument | null>();
}
