import type { DuplicateCandidatePairAssetSummary } from './duplicateCandidatePairs.js';

export type DuplicateActionPlanStatus =
  | 'proposed'
  | 'needs_manual_review'
  | 'approved'
  | 'rejected';

export type DuplicateActionType =
  | 'KEEP_CANONICAL'
  | 'PROPOSE_ARCHIVE_SECONDARY'
  | 'NEEDS_MANUAL_REVIEW';

export type DuplicateActionExecutionReadiness = 'eligible_for_future_execution' | 'blocked';

export interface DuplicateActionPlanActionItem {
  assetId: string;
  actionType: DuplicateActionType;
  rationale: string[];
}

export interface DuplicateActionPlanListItem {
  planId: string;
  groupKey: string;
  canonicalAssetId: string;
  canonicalAsset: DuplicateCandidatePairAssetSummary | null;
  secondaryAssetIds: string[];
  secondaryAssets: DuplicateCandidatePairAssetSummary[];
  actionItems: DuplicateActionPlanActionItem[];
  primaryActionType: DuplicateActionType;
  planStatus: DuplicateActionPlanStatus;
  executionReadiness: DuplicateActionExecutionReadiness;
  rationale: string[];
  reviewNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DuplicateActionPlanSummary {
  total: number;
  statusCounts: Record<DuplicateActionPlanStatus, number>;
  actionTypeCounts: Record<DuplicateActionType, number>;
  eligibleForFutureExecutionCount: number;
}

export interface ListDuplicateActionPlansResponse {
  items: DuplicateActionPlanListItem[];
  total: number;
  summary: DuplicateActionPlanSummary;
}

export interface GetDuplicateActionPlanResponse {
  item: DuplicateActionPlanListItem;
}

export interface GenerateDuplicateActionPlansRequest {
  onlyMissing?: boolean;
}

export interface GenerateDuplicateActionPlansResponse {
  generatedCount: number;
  skippedCount: number;
  planIds: string[];
}

export interface UpdateDuplicateActionPlanRequest {
  planStatus: DuplicateActionPlanStatus;
  reviewNote?: string;
}

export interface UpdateDuplicateActionPlanResponse {
  item: DuplicateActionPlanListItem;
}

export interface ExportDuplicateActionPlansResponse {
  generatedAt: string;
  total: number;
  items: DuplicateActionPlanListItem[];
}
