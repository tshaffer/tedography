import type { PhotoState, RefreshOperationResponse } from '@tedography/domain';
import type { FindSimilarAssetsResponse } from '@tedography/shared';

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

export async function reimportAsset(assetId: string): Promise<RefreshOperationResponse> {
  return fetchJson<RefreshOperationResponse>(`/api/assets/${encodeURIComponent(assetId)}/reimport`, {
    method: 'POST'
  });
}

export async function rebuildAssetDerivedFiles(
  assetId: string
): Promise<RefreshOperationResponse> {
  return fetchJson<RefreshOperationResponse>(
    `/api/assets/${encodeURIComponent(assetId)}/rebuild-derived`,
    {
      method: 'POST'
    }
  );
}

export async function findSimilarAssets(
  assetId: string,
  input?: {
    limit?: number;
    photoState?: PhotoState;
  }
): Promise<FindSimilarAssetsResponse> {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) {
    params.set('limit', String(input.limit));
  }

  if (input?.photoState) {
    params.set('photoState', input.photoState);
  }

  const search = params.toString();
  return fetchJson<FindSimilarAssetsResponse>(
    `/api/assets/${encodeURIComponent(assetId)}/similar${search.length > 0 ? `?${search}` : ''}`
  );
}
