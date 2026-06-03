import type { EditHistoryEntry, EditHistoryArchive } from '@tedography/domain';

export interface EditHistoryEntryWithNavigation extends EditHistoryEntry {
  navigateAssetId: string | null;
  albumId: string | null;
  albumPath: string | null;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getEditHistory(): Promise<EditHistoryEntryWithNavigation[]> {
  return fetchJson<EditHistoryEntryWithNavigation[]>('/api/edit-history');
}

export function updateEditHistoryNote(entryId: string, note: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`/api/edit-history/${encodeURIComponent(entryId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
}

export function getEditHistoryArchives(): Promise<EditHistoryArchive[]> {
  return fetchJson<EditHistoryArchive[]>('/api/edit-history/archives');
}

export function createEditHistoryArchive(
  entryIds: string[],
  name?: string
): Promise<EditHistoryArchive> {
  return fetchJson<EditHistoryArchive>('/api/edit-history/archives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryIds, name }),
  });
}

export function getEditHistoryArchiveEntries(
  archiveId: string
): Promise<{ archive: EditHistoryArchive; entries: EditHistoryEntryWithNavigation[] }> {
  return fetchJson(`/api/edit-history/archives/${encodeURIComponent(archiveId)}`);
}

export function renameEditHistoryArchive(archiveId: string, name: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`/api/edit-history/archives/${encodeURIComponent(archiveId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function appendToEditHistoryArchive(
  archiveId: string,
  entryIds: string[]
): Promise<{ ok: boolean; appended: number }> {
  return fetchJson<{ ok: boolean; appended: number }>(
    `/api/edit-history/archives/${encodeURIComponent(archiveId)}/append`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds }),
    }
  );
}

export function deleteEditHistoryArchive(archiveId: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(
    `/api/edit-history/archives/${encodeURIComponent(archiveId)}`,
    { method: 'DELETE' }
  );
}
