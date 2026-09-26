import type { AlbumTreeNode, AssetLocationDisplayMode, LocationDisplayMode, MediaAsset } from '@tedography/domain';

// Decides what text the Location field shows. Precedence:
//   1. the photo's own choice (including its custom text)
//   2. the album's choice (the album being viewed, else the first album with one)
//   3. the global default from Display Options
// If the chosen piece is missing (e.g. "Place name" on an EXIF photo, which
// never has one), it falls back to the next most useful piece rather than
// showing nothing.

export const locationDisplayModeLabels: Record<LocationDisplayMode, string> = {
  placeName: 'Place name',
  placeNameAndCity: 'Place name and city',
  address: 'Full address',
  cityStateCountry: 'City, State, Country'
};

export const defaultGlobalLocationDisplayMode: LocationDisplayMode = 'placeNameAndCity';

export interface LocationDisplayFields {
  placeName?: string | null | undefined;
  locationLabel?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  country?: string | null | undefined;
}

function clean(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// When a file has GPS but no place-name tags, the EXIF import stores the raw
// GPSPosition string (e.g. `36 deg 26' 1.2" N, 121 deg 55' 2.3" W`) as its
// label. Coordinates are never shown to the user.
function looksLikeCoordinates(value: string): boolean {
  return /\d\s*(deg\b|°)/i.test(value) || /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(value);
}

function joinUnique(parts: Array<string | null | undefined>): string | null {
  const values = parts
    .map(clean)
    .filter((value): value is string => value !== null)
    .filter((value, index, all) => all.indexOf(value) === index);
  return values.length > 0 ? values.join(', ') : null;
}

export function formatLocationForDisplay(fields: LocationDisplayFields, mode: LocationDisplayMode): string | null {
  const placeName = clean(fields.placeName);
  const rawAddress = clean(fields.locationLabel);
  const address = rawAddress && !looksLikeCoordinates(rawAddress) ? rawAddress : null;
  const cityStateCountry = joinUnique([fields.city, fields.state, fields.country]);
  const placeNameAndCity = placeName ? joinUnique([placeName, fields.city, fields.state]) : null;

  const preference: Array<string | null> =
    mode === 'placeName'
      ? [placeName, cityStateCountry, address]
      : mode === 'placeNameAndCity'
        ? [placeNameAndCity, cityStateCountry, address]
        : mode === 'address'
          ? [address, cityStateCountry, placeName]
          : [cityStateCountry, placeName, address];

  return preference.find((value): value is string => value !== null) ?? null;
}

/** The album whose choice applies: the one being viewed if the photo is in it, else the first that has one. */
function findAlbumDisplayMode(
  albumIds: string[],
  albumNodesById: Map<string, AlbumTreeNode>,
  preferredAlbumId: string | null
): LocationDisplayMode | null {
  if (preferredAlbumId && albumIds.includes(preferredAlbumId)) {
    const preferred = albumNodesById.get(preferredAlbumId)?.locationDisplayMode;
    if (preferred) {
      return preferred;
    }
  }

  for (const albumId of albumIds) {
    const mode = albumNodesById.get(albumId)?.locationDisplayMode;
    if (mode) {
      return mode;
    }
  }

  return null;
}

/** The mode that applies to a photo when it doesn't use its own choice. */
export function resolveInheritedLocationDisplayMode(
  asset: Pick<MediaAsset, 'albumIds'>,
  albumNodesById: Map<string, AlbumTreeNode>,
  preferredAlbumId: string | null,
  globalMode: LocationDisplayMode
): LocationDisplayMode {
  return findAlbumDisplayMode(asset.albumIds ?? [], albumNodesById, preferredAlbumId) ?? globalMode;
}

export interface ResolvedAssetLocation {
  /** Text for the Location field; null when the photo has no location of its own. */
  text: string | null;
  /** The mode that produced the text (null when custom text is shown). */
  mode: LocationDisplayMode | null;
  isCustom: boolean;
}

export function resolveAssetLocation(
  asset: Pick<MediaAsset, 'albumIds' | 'locationDisplayMode' | 'customLocationLabel'> & LocationDisplayFields,
  albumNodesById: Map<string, AlbumTreeNode>,
  preferredAlbumId: string | null,
  globalMode: LocationDisplayMode
): ResolvedAssetLocation {
  const ownChoice: AssetLocationDisplayMode | null = asset.locationDisplayMode ?? null;
  const customText = clean(asset.customLocationLabel);
  if (ownChoice === 'custom' && customText) {
    return { text: customText, mode: null, isCustom: true };
  }

  const mode =
    ownChoice && ownChoice !== 'custom'
      ? ownChoice
      : resolveInheritedLocationDisplayMode(asset, albumNodesById, preferredAlbumId, globalMode);
  return { text: formatLocationForDisplay(asset, mode), mode, isCustom: false };
}

/** An album's default location, as its photos would show it. */
export function formatAlbumDefaultLocation(album: AlbumTreeNode, mode: LocationDisplayMode): string | null {
  return formatLocationForDisplay(
    {
      placeName: album.defaultPlaceName,
      locationLabel: album.defaultLocationLabel,
      city: album.defaultCity,
      state: album.defaultState,
      country: album.defaultCountry
    },
    mode
  );
}
