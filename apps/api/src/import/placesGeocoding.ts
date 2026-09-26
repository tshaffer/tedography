import { config } from '../config.js';

// Server-side wrapper around Google Places API (New) — used for forward
// geocoding (place name -> coordinates) in the Set Location dialog. Called
// only from the server so the API key never reaches the browser. Reverse
// geocoding (coordinates -> place name) stays on Nominatim; see exifMetadata.ts.

export interface PlacePrediction {
  placeId: string;
  /** Full display text, e.g. "Downieville, CA, USA". */
  description: string;
  /** The matched place name only, e.g. "Downieville" (falls back to description). */
  mainText: string;
  /** The rest of the address, e.g. "CA, USA", when available. */
  secondaryText: string | null;
}

export interface ResolvedPlace {
  /** The place's name, e.g. "Garrapata State Park" (for a street address, the street line). */
  placeName: string | null;
  formattedAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

function requireApiKey(): string {
  const apiKey = config.googlePlaces.apiKey;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured in .env');
  }
  return apiKey;
}

export async function autocompletePlace(input: string, sessionToken: string): Promise<PlacePrediction[]> {
  const apiKey = requireApiKey();
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return [];
  }

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify({ input: trimmedInput, sessionToken })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Places autocomplete failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as PlacesAutocompleteResponse;
  const suggestions = payload.suggestions ?? [];

  return suggestions
    .map((suggestion): PlacePrediction | null => {
      const prediction = suggestion.placePrediction;
      const placeId = prediction?.placeId;
      const description = prediction?.text?.text;
      if (!placeId || !description) {
        return null;
      }

      return {
        placeId,
        description,
        mainText: prediction?.structuredFormat?.mainText?.text ?? description,
        secondaryText: prediction?.structuredFormat?.secondaryText?.text ?? null
      };
    })
    .filter((prediction): prediction is PlacePrediction => prediction !== null);
}

function pickAddressComponent(
  components: PlaceDetailsResponse['addressComponents'],
  type: string
): string | null {
  const match = (components ?? []).find((component) => component.types?.includes(type));
  return match?.longText ?? null;
}

export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<ResolvedPlace> {
  const apiKey = requireApiKey();
  // displayName is a Place Details Pro field — requesting it bills the whole
  // lookup at the Pro SKU rather than Essentials.
  const fieldMask = ['displayName', 'formattedAddress', 'location', 'addressComponents'].join(',');

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('sessionToken', sessionToken);

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Place details lookup failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as PlaceDetailsResponse;

  return {
    placeName: payload.displayName?.text?.trim() || null,
    formattedAddress: payload.formattedAddress ?? null,
    city:
      pickAddressComponent(payload.addressComponents, 'locality') ??
      pickAddressComponent(payload.addressComponents, 'postal_town') ??
      pickAddressComponent(payload.addressComponents, 'sublocality'),
    state: pickAddressComponent(payload.addressComponents, 'administrative_area_level_1'),
    country: pickAddressComponent(payload.addressComponents, 'country'),
    latitude: payload.location?.latitude ?? null,
    longitude: payload.location?.longitude ?? null
  };
}
