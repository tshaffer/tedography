async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export interface LabelDetectionResult {
  outputPath: string;
  assetCount: number;
  labelledCount: number;
  errorCount: number;
}

export function runLabelDetection(assetIds: string[], minConfidence?: number): Promise<LabelDetectionResult> {
  return fetchJson<LabelDetectionResult>('/api/label-detection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds, minConfidence }),
  });
}
