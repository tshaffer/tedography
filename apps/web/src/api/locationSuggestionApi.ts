export interface LocationSuggestion {
  sourceAssetId: string;
  sourceFilename: string;
  minutesApart: number | null;
  placeName: string | null;
  locationLabel: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

export interface AlbumLocationSuggestionResult {
  assetId: string;
  filename: string;
  suggestion: LocationSuggestion | null;
}

type ApiErrorPayload = { error?: string };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: 'no-store', ...init });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getAssetLocationSuggestion(assetId: string): Promise<LocationSuggestion | null> {
  const response = await fetchJson<{ suggestion: LocationSuggestion | null }>(
    `/api/assets/${encodeURIComponent(assetId)}/location-suggestion`
  );
  return response.suggestion;
}

export async function getAlbumLocationSuggestions(albumId: string): Promise<AlbumLocationSuggestionResult[]> {
  const response = await fetchJson<{ results: AlbumLocationSuggestionResult[] }>(
    `/api/albums/${encodeURIComponent(albumId)}/location-suggestions`
  );
  return response.results;
}
