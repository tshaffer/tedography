import type { EditQueueEntry } from '@tedography/domain';

export interface EditQueueEntryWithFilename extends EditQueueEntry {
  filename: string;
  albumId: string | null;
  albumPath: string | null;
  editedAssetId: string | null;
}

export interface ImportEditedResult {
  filename: string;
  status: 'imported' | 'skipped' | 'error';
  assetId?: string;
  message?: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getEditQueue(): Promise<EditQueueEntryWithFilename[]> {
  return fetchJson<EditQueueEntryWithFilename[]>('/api/edit-queue');
}

export function addToEditQueue(assetId: string, prompt: string): Promise<EditQueueEntry> {
  return fetchJson<EditQueueEntry>('/api/edit-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, prompt }),
  });
}

export function removeFromEditQueue(assetId: string): Promise<void> {
  return fetchJson<void>(`/api/edit-queue/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
}

export function clearEditQueue(): Promise<void> {
  return fetchJson<void>('/api/edit-queue', { method: 'DELETE' });
}

export function exportEditQueue(assetIds: string[]): Promise<{ editPath: string; count: number }> {
  return fetchJson<{ editPath: string; count: number }>('/api/edit-queue/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds }),
  });
}

export function importEditedFiles(): Promise<{
  results: ImportEditedResult[];
  importedCount: number;
  errorCount: number;
}> {
  return fetchJson('/api/edit-queue/import', { method: 'POST' });
}

export function clearEditFolder(): Promise<{ ok: boolean; deletedCount: number }> {
  return fetchJson<{ ok: boolean; deletedCount: number }>('/api/edit-queue/edit-folder', {
    method: 'DELETE',
  });
}
