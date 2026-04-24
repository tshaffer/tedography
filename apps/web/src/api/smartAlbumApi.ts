import type {
  CreateSmartAlbumRequest,
  CreateSmartAlbumResponse,
  DeleteSmartAlbumResponse,
  GetSmartAlbumResponse,
  ListSmartAlbumsResponse,
  UpdateSmartAlbumRequest,
  UpdateSmartAlbumResponse
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

export async function createSmartAlbum(
  request: CreateSmartAlbumRequest
): Promise<CreateSmartAlbumResponse> {
  return fetchJson<CreateSmartAlbumResponse>('/api/smart-albums', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function listSmartAlbums(): Promise<ListSmartAlbumsResponse> {
  return fetchJson<ListSmartAlbumsResponse>('/api/smart-albums');
}

export async function getSmartAlbum(id: string): Promise<GetSmartAlbumResponse> {
  return fetchJson<GetSmartAlbumResponse>(`/api/smart-albums/${encodeURIComponent(id)}`);
}

export async function updateSmartAlbum(
  id: string,
  request: UpdateSmartAlbumRequest
): Promise<UpdateSmartAlbumResponse> {
  return fetchJson<UpdateSmartAlbumResponse>(`/api/smart-albums/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function deleteSmartAlbum(id: string): Promise<DeleteSmartAlbumResponse> {
  return fetchJson<DeleteSmartAlbumResponse>(`/api/smart-albums/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
