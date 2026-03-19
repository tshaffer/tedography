import {
  DuplicateActionExecutionModel,
  type DuplicateActionExecutionDocument
} from '../models/duplicateActionExecutionModel.js';

export interface ListDuplicateActionExecutionsInput {
  planId?: string;
  status?: DuplicateActionExecutionDocument['status'];
}

export function buildDuplicateActionExecutionFilter(
  input: ListDuplicateActionExecutionsInput
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (input.planId) {
    filter.planId = input.planId;
  }

  if (input.status) {
    filter.status = input.status;
  }

  return filter;
}

export async function syncDuplicateActionExecutionIndexes(): Promise<void> {
  await DuplicateActionExecutionModel.syncIndexes();
}

export async function createDuplicateActionExecution(input: {
  executionId: string;
  planId: string;
  groupKey: string;
  operation: DuplicateActionExecutionDocument['operation'];
  status: DuplicateActionExecutionDocument['status'];
  itemResults?: DuplicateActionExecutionDocument['itemResults'];
  succeededCount?: number;
  failedCount?: number;
  skippedCount?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}): Promise<DuplicateActionExecutionDocument> {
  await DuplicateActionExecutionModel.create({
    executionId: input.executionId,
    planId: input.planId,
    groupKey: input.groupKey,
    operation: input.operation,
    status: input.status,
    itemResults: input.itemResults ?? [],
    succeededCount: input.succeededCount ?? 0,
    failedCount: input.failedCount ?? 0,
    skippedCount: input.skippedCount ?? 0,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null
  });

  const created = await DuplicateActionExecutionModel.findOne({ executionId: input.executionId }, { _id: 0 })
    .lean<DuplicateActionExecutionDocument | null>();

  if (!created) {
    throw new Error(`Failed to load duplicate action execution ${input.executionId}.`);
  }

  return created;
}

export async function updateDuplicateActionExecution(input: {
  executionId: string;
  status: DuplicateActionExecutionDocument['status'];
  itemResults: DuplicateActionExecutionDocument['itemResults'];
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}): Promise<DuplicateActionExecutionDocument | null> {
  return DuplicateActionExecutionModel.findOneAndUpdate(
    { executionId: input.executionId },
    {
      $set: {
        status: input.status,
        itemResults: input.itemResults,
        succeededCount: input.succeededCount,
        failedCount: input.failedCount,
        skippedCount: input.skippedCount,
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {})
      }
    },
    {
      new: true,
      projection: { _id: 0 },
      runValidators: true
    }
  ).lean<DuplicateActionExecutionDocument | null>();
}

export async function listDuplicateActionExecutions(
  input: ListDuplicateActionExecutionsInput
): Promise<DuplicateActionExecutionDocument[]> {
  return DuplicateActionExecutionModel.find(buildDuplicateActionExecutionFilter(input), { _id: 0 })
    .sort({ createdAt: -1, executionId: -1 })
    .lean<DuplicateActionExecutionDocument[]>();
}

export async function findDuplicateActionExecutionById(
  executionId: string
): Promise<DuplicateActionExecutionDocument | null> {
  return DuplicateActionExecutionModel.findOne({ executionId }, { _id: 0 })
    .lean<DuplicateActionExecutionDocument | null>();
}

export async function findLatestExecutionForPlan(
  planId: string
): Promise<DuplicateActionExecutionDocument | null> {
  return DuplicateActionExecutionModel.findOne({ planId }, { _id: 0 })
    .sort({ createdAt: -1, executionId: -1 })
    .lean<DuplicateActionExecutionDocument | null>();
}

export async function findCompletedExecutionForPlan(
  planId: string
): Promise<DuplicateActionExecutionDocument | null> {
  return DuplicateActionExecutionModel.findOne({ planId, status: 'completed' }, { _id: 0 })
    .sort({ createdAt: -1, executionId: -1 })
    .lean<DuplicateActionExecutionDocument | null>();
}
