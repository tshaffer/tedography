import type { EditLookupResponse, EditQueueEntry, EditType } from '@tedography/domain';

export interface EditQueueEntryWithFilename extends EditQueueEntry {
  filename: string;
  albumId: string | null;
  albumPath: string | null;
  editedAssetId: string | null;
  orphanedEditFilenames: string[];
  // Returned files that could belong to this photo but also to another one.
  ambiguousEditFilenames: string[];
  isExported: boolean;
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

export interface BulkAddToEditQueueResult {
  addedCount: number;
  skippedCount: number;
  added: string[];
  skipped: string[];
}

export function bulkAddToEditQueue(
  assetIds: string[],
  note: string,
  editType: EditType
): Promise<BulkAddToEditQueueResult> {
  return fetchJson<BulkAddToEditQueueResult>('/api/edit-queue/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds, note, editType }),
  });
}

export function removeFromEditQueue(assetId: string): Promise<void> {
  return fetchJson<void>(`/api/edit-queue/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
}

export function clearEditQueue(): Promise<void> {
  return fetchJson<void>('/api/edit-queue', { method: 'DELETE' });
}

export type ExportStatus = 'exported' | 'alreadyExported' | 'previouslyExported' | 'conflict' | 'failed';

export interface ExportItemResult {
  assetId: string;
  filename: string;
  status: ExportStatus;
  message: string;
}

export interface ExportEditQueueResponse {
  editPath: string;
  exportPath: string;
  returnPath: string;
  count: number;
  counts: Record<ExportStatus, number>;
  results: ExportItemResult[];
}

export function exportEditQueue(assetIds: string[], forceAssetIds: string[] = []): Promise<ExportEditQueueResponse> {
  return fetchJson<ExportEditQueueResponse>('/api/edit-queue/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds, forceAssetIds }),
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

export function updateEditQueueEntryEditType(assetId: string, editType: EditType): Promise<{ ok: boolean; editType: EditType }> {
  return fetchJson(`/api/edit-queue/${encodeURIComponent(assetId)}/edit-type`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editType }),
  });
}

export function clearEditFolder(filenames: string[]): Promise<{ ok: boolean; deletedCount: number }> {
  return fetchJson<{ ok: boolean; deletedCount: number }>('/api/edit-queue/edit-folder', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filenames }),
  });
}

export type ReturnFileImportStatus = 'ready' | 'ambiguous' | 'unmatched' | 'other';

export interface EditFolderFile {
  filename: string;
  size: number;
  modifiedAt: string;
  isEditOutput: boolean;
  importStatus: ReturnFileImportStatus;
}

export interface EditFolderInfo {
  folders: { editPath: string; exportPath: string; returnPath: string; legacy: boolean };
  manifest: { exists: boolean; entryCount: number };
  notesExists: boolean;
  exportedEntryCount: number;
  exportedPresentCount: number;
  files: EditFolderFile[];
  ambiguous: Array<{ filename: string; candidates: Array<{ sourceAssetId: string; sourceFilename: string }> }>;
  clearableFilenames: string[];
}

export function listEditFolderFiles(): Promise<EditFolderInfo> {
  return fetchJson<EditFolderInfo>('/api/edit-queue/edit-folder');
}

export function deleteEditFolderFile(filename: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`/api/edit-queue/edit-folder/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

export async function lookupEditQueueAndHistory(query: string, signal?: AbortSignal): Promise<EditLookupResponse> {
  const response = await fetch(`/api/edit-queue/lookup?q=${encodeURIComponent(query)}`, {
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<EditLookupResponse>;
}
