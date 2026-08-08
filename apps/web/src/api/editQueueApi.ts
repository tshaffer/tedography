import type { EditQueueEntry } from '@tedography/domain';

export interface EditQueueEntryWithFilename extends EditQueueEntry {
  filename: string;
  albumId: string | null;
  albumPath: string | null;
  editedAssetId: string | null;
  orphanedEditFilenames: string[];
}

export interface ImportEditedResult {
  filename: string;
  status: 'imported' | 'skipped' | 'error';
  assetId?: string;
  destPath?: string;
  message?: string;
}

export interface EditedFileCandidate {
  filename: string;
  sourceAssetId: string;
  sourceFilename: string;
}

export type EditMethod = 'ai' | 'manual';

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

export function addToEditQueue(assetId: string, note: string): Promise<EditQueueEntry> {
  return fetchJson<EditQueueEntry>('/api/edit-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, note }),
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

export function scanEditedFiles(): Promise<{ files: EditedFileCandidate[] }> {
  return fetchJson<{ files: EditedFileCandidate[] }>('/api/edit-queue/import/scan');
}

export function importEditedFiles(
  files: { filename: string; editMethod: EditMethod }[]
): Promise<{
  results: ImportEditedResult[];
  importedCount: number;
  errorCount: number;
}> {
  return fetchJson('/api/edit-queue/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
}

export function updateAssetEditMethod(assetId: string, editMethod: EditMethod): Promise<{ ok: boolean; editMethod: EditMethod }> {
  return fetchJson(`/api/edit-queue/assets/${encodeURIComponent(assetId)}/edit-method`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editMethod }),
  });
}

export function clearEditFolder(): Promise<{ ok: boolean; deletedCount: number }> {
  return fetchJson<{ ok: boolean; deletedCount: number }>('/api/edit-queue/edit-folder', {
    method: 'DELETE',
  });
}

export interface EditFolderFile {
  filename: string;
  size: number;
  modifiedAt: string;
}

export function listEditFolderFiles(): Promise<{ files: EditFolderFile[] }> {
  return fetchJson<{ files: EditFolderFile[] }>('/api/edit-queue/edit-folder');
}

export function deleteEditFolderFile(filename: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`/api/edit-queue/edit-folder/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}
