export type DuplicateActionExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partially_failed'
  | 'failed';

export type DuplicateActionExecutionItemStatus = 'succeeded' | 'failed' | 'skipped';

export type DuplicateActionExecutionOperation = 'MOVE_TO_QUARANTINE';

export interface DuplicateActionExecutionItemResult {
  assetId: string;
  sourceStorageRootId: string;
  sourceArchivePath: string;
  destinationStorageRootId: string;
  destinationArchivePath: string;
  status: DuplicateActionExecutionItemStatus;
  errorMessage?: string | null;
}

export interface DuplicateActionExecutionListItem {
  executionId: string;
  planId: string;
  groupKey: string;
  operation: DuplicateActionExecutionOperation;
  status: DuplicateActionExecutionStatus;
  itemResults: DuplicateActionExecutionItemResult[];
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListDuplicateActionExecutionsResponse {
  items: DuplicateActionExecutionListItem[];
  total: number;
}

export interface GetDuplicateActionExecutionResponse {
  item: DuplicateActionExecutionListItem;
}

export interface CreateDuplicateActionExecutionRequest {
  planId: string;
}

export interface CreateDuplicateActionExecutionResponse {
  item: DuplicateActionExecutionListItem;
}

export interface RetryDuplicateActionExecutionResponse {
  item: DuplicateActionExecutionListItem;
}
