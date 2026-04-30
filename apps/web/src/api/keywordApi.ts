import type {
  CreateKeywordRequest,
  CreateKeywordResponse,
  DeleteKeywordResponse,
  ListAssetKeywordsResponse,
  ListKeywordsResponse,
  ListKeywordTreeResponse,
  UpdateKeywordLabelRequest,
  UpdateKeywordLabelResponse,
  UpdateKeywordParentRequest,
  UpdateKeywordParentResponse,
  UpdateAssetKeywordsRequest,
  UpdateAssetKeywordsResponse
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

export async function listKeywords(): Promise<ListKeywordsResponse> {
  return fetchJson<ListKeywordsResponse>('/api/keywords');
}

export async function createKeyword(
  request: CreateKeywordRequest
): Promise<CreateKeywordResponse> {
  return fetchJson<CreateKeywordResponse>('/api/keywords', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function listKeywordsForAsset(assetId: string): Promise<ListAssetKeywordsResponse> {
  return fetchJson<ListAssetKeywordsResponse>(`/api/assets/${encodeURIComponent(assetId)}/keywords`);
}

export async function listKeywordTree(): Promise<ListKeywordTreeResponse> {
  return fetchJson<ListKeywordTreeResponse>('/api/keywords/tree');
}

export async function updateKeywordParent(
  keywordId: string,
  request: UpdateKeywordParentRequest
): Promise<UpdateKeywordParentResponse> {
  return fetchJson<UpdateKeywordParentResponse>(`/api/keywords/${encodeURIComponent(keywordId)}/parent`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function updateKeywordLabel(
  keywordId: string,
  request: UpdateKeywordLabelRequest
): Promise<UpdateKeywordLabelResponse> {
  return fetchJson<UpdateKeywordLabelResponse>(`/api/keywords/${encodeURIComponent(keywordId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function deleteKeyword(keywordId: string): Promise<DeleteKeywordResponse> {
  return fetchJson<DeleteKeywordResponse>(`/api/keywords/${encodeURIComponent(keywordId)}`, {
    method: 'DELETE'
  });
}

export async function addKeywordsToAssets(
  request: UpdateAssetKeywordsRequest
): Promise<UpdateAssetKeywordsResponse> {
  return fetchJson<UpdateAssetKeywordsResponse>('/api/assets/keywords/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function removeKeywordsFromAssets(
  request: UpdateAssetKeywordsRequest
): Promise<UpdateAssetKeywordsResponse> {
  return fetchJson<UpdateAssetKeywordsResponse>('/api/assets/keywords/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}
