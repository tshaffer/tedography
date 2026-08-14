import type { MediaAsset, RefreshOperationResponse } from '@tedography/domain';

type ApiErrorPayload = {
  error?: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: 'no-store', ...init });
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

export async function rotateAssetClockwise(assetId: string): Promise<MediaAsset> {
  return fetchJson<MediaAsset>(`/api/assets/${encodeURIComponent(assetId)}/rotate-clockwise`, {
    method: 'POST'
  });
}

export async function rotateAssetCounterclockwise(assetId: string): Promise<MediaAsset> {
  return fetchJson<MediaAsset>(`/api/assets/${encodeURIComponent(assetId)}/rotate-counterclockwise`, {
    method: 'POST'
  });
}

export async function rotateAsset180(assetId: string): Promise<MediaAsset> {
  return fetchJson<MediaAsset>(`/api/assets/${encodeURIComponent(assetId)}/rotate-180`, {
    method: 'POST'
  });
}

export async function updateAssetRating(assetId: string, rating: number | null): Promise<MediaAsset> {
  return fetchJson<MediaAsset>(`/api/assets/${encodeURIComponent(assetId)}/rating`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating })
  });
}

export async function openAssetInPreview(assetId: string): Promise<void> {
  await fetchJson<{ ok: boolean }>(`/api/assets/${encodeURIComponent(assetId)}/open-in-preview`, {
    method: 'POST'
  });
}

export async function getAssetFileStat(assetId: string): Promise<{ mtimeMs: number }> {
  return fetchJson<{ mtimeMs: number }>(`/api/assets/${encodeURIComponent(assetId)}/file-stat`);
}

export async function updateAssetsCaptureDateTime(request: {
  assetIds: string[];
  captureDateTime?: string | null;
  captureDate?: string;
}): Promise<MediaAsset[]> {
  return fetchJson<MediaAsset[]>('/api/assets/capture-date', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function updateAssetsCaptureDateMarkedWrong(request: {
  assetIds: string[];
  markedWrong: boolean;
}): Promise<MediaAsset[]> {
  return fetchJson<MediaAsset[]>('/api/assets/capture-date-marked-wrong', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function fetchExportedAssetBlob(assetId: string, format: 'jpeg' | 'png' | 'original'): Promise<Blob> {
  const response = await fetch(`/api/media/export/${encodeURIComponent(assetId)}?format=${format}`, {
    cache: 'no-store'
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
  return response.blob();
}
