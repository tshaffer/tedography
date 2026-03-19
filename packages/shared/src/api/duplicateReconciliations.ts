import type { DuplicateActionExecutionStatus } from './duplicateActionExecutions.js';
import type { DuplicateActionPlanStatus } from './duplicateActionPlans.js';
import type { DuplicateCandidatePairAssetSummary } from './duplicateCandidatePairs.js';

export type DuplicateReconciliationStatus = 'auto_applied' | 'no_changes';
export type DuplicateReconciliationFieldName = 'albumIds';

export interface DuplicateReconciliationEntry {
  fieldName: DuplicateReconciliationFieldName;
  originalCanonicalValue: string[];
  reconciledValue: string[];
  addedValues: string[];
  contributedAssetIds: string[];
  rationale: string[];
  status: DuplicateReconciliationStatus;
}

export interface DuplicateReconciliationListItem {
  reconciliationId: string;
  groupKey: string;
  canonicalAssetId: string;
  canonicalAsset: DuplicateCandidatePairAssetSummary | null;
  sourceSecondaryAssetIds: string[];
  sourceSecondaryAssets: DuplicateCandidatePairAssetSummary[];
  status: DuplicateReconciliationStatus;
  entries: DuplicateReconciliationEntry[];
  rationale: string[];
  actionPlanStatus?: DuplicateActionPlanStatus;
  latestCompletedExecutionStatus?: DuplicateActionExecutionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface DuplicateReconciliationSummary {
  total: number;
  statusCounts: Record<DuplicateReconciliationStatus, number>;
  totalAddedAlbumAssociations: number;
}

export interface ListDuplicateReconciliationsResponse {
  items: DuplicateReconciliationListItem[];
  total: number;
  summary: DuplicateReconciliationSummary;
}

export interface GetDuplicateReconciliationResponse {
  item: DuplicateReconciliationListItem;
}

export interface GenerateDuplicateReconciliationsRequest {
  onlyMissing?: boolean;
}

export interface GenerateDuplicateReconciliationsResponse {
  generatedCount: number;
  skippedCount: number;
  reconciliationIds: string[];
}
