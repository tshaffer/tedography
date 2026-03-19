import type {
  DuplicateActionPlanStatus,
  DuplicateActionType,
  ExportDuplicateActionPlansResponse,
  GenerateDuplicateActionPlansResponse,
  GetDuplicateActionPlanResponse,
  ListDuplicateActionPlansResponse,
  UpdateDuplicateActionPlanRequest,
  UpdateDuplicateActionPlanResponse
} from '@tedography/shared';

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

export async function listDuplicateActionPlans(input?: {
  planStatus?: DuplicateActionPlanStatus | 'all';
  primaryActionType?: DuplicateActionType | 'all';
  assetId?: string;
}): Promise<ListDuplicateActionPlansResponse> {
  const query = new URLSearchParams();

  if (input?.planStatus && input.planStatus !== 'all') {
    query.set('planStatus', input.planStatus);
  }

  if (input?.primaryActionType && input.primaryActionType !== 'all') {
    query.set('primaryActionType', input.primaryActionType);
  }

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  const search = query.toString();
  return fetchJson<ListDuplicateActionPlansResponse>(
    `/api/duplicate-action-plans${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function generateDuplicateActionPlans(input?: {
  onlyMissing?: boolean;
}): Promise<GenerateDuplicateActionPlansResponse> {
  return fetchJson<GenerateDuplicateActionPlansResponse>('/api/duplicate-action-plans/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input ?? {})
  });
}

export async function getDuplicateActionPlan(planId: string): Promise<GetDuplicateActionPlanResponse> {
  return fetchJson<GetDuplicateActionPlanResponse>(
    `/api/duplicate-action-plans/${encodeURIComponent(planId)}`
  );
}

export async function updateDuplicateActionPlan(
  planId: string,
  request: UpdateDuplicateActionPlanRequest
): Promise<UpdateDuplicateActionPlanResponse> {
  return fetchJson<UpdateDuplicateActionPlanResponse>(
    `/api/duplicate-action-plans/${encodeURIComponent(planId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}

export function buildDuplicateActionPlansExportUrl(input?: {
  planStatus?: DuplicateActionPlanStatus | 'all';
  primaryActionType?: DuplicateActionType | 'all';
  assetId?: string;
}): string {
  const query = new URLSearchParams();

  if (input?.planStatus && input.planStatus !== 'all') {
    query.set('planStatus', input.planStatus);
  }

  if (input?.primaryActionType && input.primaryActionType !== 'all') {
    query.set('primaryActionType', input.primaryActionType);
  }

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  const search = query.toString();
  return `/api/duplicate-action-plans/export${search.length > 0 ? `?${search}` : ''}`;
}

export async function exportDuplicateActionPlans(input?: {
  planStatus?: DuplicateActionPlanStatus | 'all';
  primaryActionType?: DuplicateActionType | 'all';
  assetId?: string;
}): Promise<ExportDuplicateActionPlansResponse> {
  return fetchJson<ExportDuplicateActionPlansResponse>(buildDuplicateActionPlansExportUrl(input));
}
