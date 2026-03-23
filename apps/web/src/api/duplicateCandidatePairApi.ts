import type {
  DuplicateCandidateClassification,
  DuplicateGroupResolutionStatus,
  DuplicateGroupSortMode,
  DuplicateCandidateOutcomeFilter,
  DuplicateCandidatePairSummaryResponse,
  DuplicateCandidateStatus,
  GetDuplicateCandidatePairResponse,
  ListDuplicateGroupsResponse,
  ListDuplicateCandidatePairsResponse,
  UpdateDuplicateCandidatePairReviewRequest,
  UpdateDuplicateCandidatePairReviewResponse
} from '@tedography/shared';

export type DuplicateReviewActionDecision =
  | UpdateDuplicateCandidatePairReviewRequest['decision']
  | 'reviewed_uncertain'
  | 'confirmed_duplicate_keep_both'
  | 'confirmed_duplicate_keep_left'
  | 'confirmed_duplicate_keep_right';

type ApiErrorPayload = {
  error?: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listDuplicateCandidatePairs(input?: {
  status?: DuplicateCandidateStatus | 'all';
  classification?: DuplicateCandidateClassification | 'all';
  outcome?: DuplicateCandidateOutcomeFilter | 'all';
  assetId?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}): Promise<ListDuplicateCandidatePairsResponse> {
  const query = new URLSearchParams();

  if (input?.status && input.status !== 'all') {
    query.set('status', input.status);
  }

  if (input?.classification && input.classification !== 'all') {
    query.set('classification', input.classification);
  }

  if (input?.outcome && input.outcome !== 'all') {
    query.set('outcome', input.outcome);
  }

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  if (input?.minScore !== undefined) {
    query.set('minScore', String(input.minScore));
  }

  if (input?.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  if (input?.offset !== undefined) {
    query.set('offset', String(input.offset));
  }

  const search = query.toString();
  return fetchJson<ListDuplicateCandidatePairsResponse>(
    `/api/duplicate-candidate-pairs${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function getDuplicateCandidatePair(
  pairKey: string
): Promise<GetDuplicateCandidatePairResponse> {
  return fetchJson<GetDuplicateCandidatePairResponse>(
    `/api/duplicate-candidate-pairs/${encodeURIComponent(pairKey)}`
  );
}

export async function getDuplicateCandidatePairSummary(input?: {
  assetId?: string;
  minScore?: number;
}): Promise<DuplicateCandidatePairSummaryResponse> {
  const query = new URLSearchParams();

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  if (input?.minScore !== undefined) {
    query.set('minScore', String(input.minScore));
  }

  const search = query.toString();
  return fetchJson<DuplicateCandidatePairSummaryResponse>(
    `/api/duplicate-candidate-pairs/summary${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function listDuplicateGroups(input?: {
  assetId?: string;
  resolutionStatus?: DuplicateGroupResolutionStatus | 'all';
  exactAssetCount?: number;
  minAssetCount?: number;
  readyToConfirmOnly?: boolean;
  sort?: DuplicateGroupSortMode;
}): Promise<ListDuplicateGroupsResponse> {
  const query = new URLSearchParams();

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  if (input?.resolutionStatus && input.resolutionStatus !== 'all') {
    query.set('resolutionStatus', input.resolutionStatus);
  }

  if (input?.exactAssetCount !== undefined) {
    query.set('exactAssetCount', String(input.exactAssetCount));
  }

  if (input?.minAssetCount !== undefined) {
    query.set('minAssetCount', String(input.minAssetCount));
  }

  if (input?.readyToConfirmOnly) {
    query.set('readyToConfirmOnly', 'true');
  }

  if (input?.sort) {
    query.set('sort', input.sort);
  }

  const search = query.toString();
  return fetchJson<ListDuplicateGroupsResponse>(
    `/api/duplicate-candidate-pairs/groups${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function updateDuplicateCandidatePairReview(
  pairKey: string,
  request: { decision: DuplicateReviewActionDecision }
): Promise<UpdateDuplicateCandidatePairReviewResponse> {
  return fetchJson<UpdateDuplicateCandidatePairReviewResponse>(
    `/api/duplicate-candidate-pairs/${encodeURIComponent(pairKey)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}
