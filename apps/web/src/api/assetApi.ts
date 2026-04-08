import type { PhotoState, RefreshOperationResponse } from '@tedography/domain';
import type { ListUnknownCaptureReviewGroupsResponse } from '@tedography/shared';

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

export async function updateAssetPhotoState(assetId: string, photoState: PhotoState) {
  return fetchJson(`/api/assets/${encodeURIComponent(assetId)}/photoState`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoState })
  });
}

export async function listUnknownCaptureReviewItems(
  runsRoot?: string
): Promise<ListUnknownCaptureReviewGroupsResponse> {
  const query = new URLSearchParams();
  if (runsRoot && runsRoot.trim().length > 0) {
    query.set('runsRoot', runsRoot.trim());
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return fetchJson<ListUnknownCaptureReviewGroupsResponse>(`/api/tools/unknown-capture-review${suffix}`);
}
