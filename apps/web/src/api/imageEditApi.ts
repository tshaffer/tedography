import type { MediaAsset } from '@tedography/domain';

type ApiErrorPayload = { error?: string };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function aiEditAsset(
  assetId: string,
  prompt: string
): Promise<{ asset: MediaAsset; backupPath: string }> {
  return fetchJson<{ asset: MediaAsset; backupPath: string }>(
    `/api/assets/${encodeURIComponent(assetId)}/ai-edit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }
  );
}
