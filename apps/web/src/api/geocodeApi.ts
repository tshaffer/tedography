export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string | null;
}

export interface ResolvedPlace {
  formattedAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
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

export async function autocompletePlace(
  input: string,
  sessionToken: string
): Promise<PlacePrediction[]> {
  const url = new URL('/api/geocode/autocomplete', window.location.origin);
  url.searchParams.set('input', input);
  url.searchParams.set('sessionToken', sessionToken);
  const response = await fetchJson<{ predictions: PlacePrediction[] }>(url.toString());
  return response.predictions;
}

export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<ResolvedPlace> {
  const url = new URL('/api/geocode/place-details', window.location.origin);
  url.searchParams.set('placeId', placeId);
  url.searchParams.set('sessionToken', sessionToken);
  return fetchJson<ResolvedPlace>(url.toString());
}
