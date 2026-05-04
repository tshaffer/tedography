import type { AiEditQueueEntry } from '@tedography/domain';

export interface AiQueueEntryWithFilename extends AiEditQueueEntry {
  filename: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getAiQueue(): Promise<AiQueueEntryWithFilename[]> {
  return fetchJson<AiQueueEntryWithFilename[]>('/api/ai-queue');
}

export function addToAiQueue(assetId: string, prompt: string): Promise<AiEditQueueEntry> {
  return fetchJson<AiEditQueueEntry>('/api/ai-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, prompt }),
  });
}

export function removeFromAiQueue(assetId: string): Promise<void> {
  return fetchJson<void>(`/api/ai-queue/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
}

export function clearAiQueue(): Promise<void> {
  return fetchJson<void>('/api/ai-queue', { method: 'DELETE' });
}

export function exportAiQueue(): Promise<{ exportPath: string; count: number }> {
  return fetchJson<{ exportPath: string; count: number }>('/api/ai-queue/export', { method: 'POST' });
}
