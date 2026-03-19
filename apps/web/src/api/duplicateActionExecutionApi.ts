import type {
  CreateDuplicateActionExecutionResponse,
  DuplicateActionExecutionStatus,
  GetDuplicateActionExecutionResponse,
  ListDuplicateActionExecutionsResponse,
  RetryDuplicateActionExecutionResponse
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

export async function listDuplicateActionExecutions(input?: {
  planId?: string;
  status?: DuplicateActionExecutionStatus | 'all';
}): Promise<ListDuplicateActionExecutionsResponse> {
  const query = new URLSearchParams();

  if (input?.planId) {
    query.set('planId', input.planId);
  }

  if (input?.status && input.status !== 'all') {
    query.set('status', input.status);
  }

  const search = query.toString();
  return fetchJson<ListDuplicateActionExecutionsResponse>(
    `/api/duplicate-action-executions${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function createDuplicateActionExecution(
  planId: string
): Promise<CreateDuplicateActionExecutionResponse> {
  return fetchJson<CreateDuplicateActionExecutionResponse>('/api/duplicate-action-executions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ planId })
  });
}

export async function getDuplicateActionExecution(
  executionId: string
): Promise<GetDuplicateActionExecutionResponse> {
  return fetchJson<GetDuplicateActionExecutionResponse>(
    `/api/duplicate-action-executions/${encodeURIComponent(executionId)}`
  );
}

export async function retryDuplicateActionExecution(
  executionId: string
): Promise<RetryDuplicateActionExecutionResponse> {
  return fetchJson<RetryDuplicateActionExecutionResponse>(
    `/api/duplicate-action-executions/${encodeURIComponent(executionId)}/retry`,
    {
      method: 'POST'
    }
  );
}
