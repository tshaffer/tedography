import type {
  GenerateDuplicateReconciliationsResponse,
  GetDuplicateReconciliationResponse,
  ListDuplicateReconciliationsResponse,
  DuplicateReconciliationStatus
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

export async function listDuplicateReconciliations(input?: {
  groupKey?: string;
  assetId?: string;
  status?: DuplicateReconciliationStatus | 'all';
}): Promise<ListDuplicateReconciliationsResponse> {
  const params = new URLSearchParams();

  if (input?.groupKey) {
    params.set('groupKey', input.groupKey);
  }

  if (input?.assetId) {
    params.set('assetId', input.assetId);
  }

  if (input?.status && input.status !== 'all') {
    params.set('status', input.status);
  }

  const query = params.toString();
  return fetchJson<ListDuplicateReconciliationsResponse>(
    `/api/duplicate-reconciliations${query ? `?${query}` : ''}`
  );
}

export async function getDuplicateReconciliation(
  reconciliationId: string
): Promise<GetDuplicateReconciliationResponse> {
  return fetchJson<GetDuplicateReconciliationResponse>(
    `/api/duplicate-reconciliations/${encodeURIComponent(reconciliationId)}`
  );
}

export async function generateDuplicateReconciliations(input?: {
  onlyMissing?: boolean;
}): Promise<GenerateDuplicateReconciliationsResponse> {
  return fetchJson<GenerateDuplicateReconciliationsResponse>('/api/duplicate-reconciliations/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input ?? {})
  });
}
