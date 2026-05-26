import type {
  PrintJobRequest,
  PrintJobResult,
  PrintProviderInfo,
} from '@tedography/domain';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getPrintProviders(): Promise<{ providers: PrintProviderInfo[] }> {
  return fetchJson<{ providers: PrintProviderInfo[] }>('/api/print/providers');
}

export function submitPrintJob(request: PrintJobRequest): Promise<PrintJobResult> {
  return fetchJson<PrintJobResult>('/api/print/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}
