async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export interface GooglePhotosStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
}

export interface PublishResult {
  albumId: string | null;
  albumTitle: string;
  albumUrl: string | null;
  uploadedCount: number;
  errorCount: number;
  errors: Array<{ filename: string; error: string }>;
}

export function getGooglePhotosStatus(): Promise<GooglePhotosStatus> {
  return fetchJson<GooglePhotosStatus>('/api/google-photos/status');
}

export function getGooglePhotosAuthUrl(): Promise<{ authUrl: string }> {
  return fetchJson<{ authUrl: string }>('/api/google-photos/auth-url');
}

export function disconnectGooglePhotos(): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>('/api/google-photos/disconnect', { method: 'DELETE' });
}

export function publishToGooglePhotos(params: {
  assetIds: string[];
  albumTitle: string;
  uploadVersion: 'original' | 'display';
}): Promise<PublishResult> {
  return fetchJson<PublishResult>('/api/google-photos/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
