import type { EditHistoryEntry } from '@tedography/domain';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getEditHistory(): Promise<EditHistoryEntry[]> {
  return fetchJson<EditHistoryEntry[]>('/api/edit-history');
}
