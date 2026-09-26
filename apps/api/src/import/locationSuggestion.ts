import type { MediaAsset } from '@tedography/domain';

export interface LocationSuggestion {
  sourceAssetId: string;
  sourceFilename: string;
  /** Minutes between the target's and source's captureDateTime, when both are known. */
  minutesApart: number | null;
  placeName: string | null;
  locationLabel: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

function hasUsableLocation(asset: MediaAsset): boolean {
  return (
    (asset.locationLatitude != null && asset.locationLongitude != null) ||
    Boolean(asset.city || asset.state || asset.country || asset.locationLabel)
  );
}

function toSuggestion(source: MediaAsset, minutesApart: number | null): LocationSuggestion {
  return {
    sourceAssetId: source.id,
    sourceFilename: source.filename,
    minutesApart,
    placeName: source.placeName ?? null,
    locationLabel: source.locationLabel ?? null,
    city: source.city ?? null,
    state: source.state ?? null,
    country: source.country ?? null,
    locationLatitude: source.locationLatitude ?? null,
    locationLongitude: source.locationLongitude ?? null
  };
}

/**
 * Finds the best location suggestion for `target` among `candidates` (other
 * assets sharing at least one album). Prefers the candidate nearest in
 * capture time to the target; falls back to any location-bearing candidate
 * when time-based matching isn't possible (target or candidates lack a
 * capture date).
 */
export function findLocationSuggestion(
  target: Pick<MediaAsset, 'id' | 'captureDateTime'>,
  candidates: MediaAsset[]
): LocationSuggestion | null {
  const withLocation = candidates.filter((candidate) => candidate.id !== target.id && hasUsableLocation(candidate));
  if (withLocation.length === 0) {
    return null;
  }

  const targetTime = target.captureDateTime ? new Date(target.captureDateTime).getTime() : NaN;

  if (!Number.isNaN(targetTime)) {
    let best: MediaAsset | null = null;
    let bestDiffMs = Infinity;

    for (const candidate of withLocation) {
      if (!candidate.captureDateTime) {
        continue;
      }
      const candidateTime = new Date(candidate.captureDateTime).getTime();
      if (Number.isNaN(candidateTime)) {
        continue;
      }
      const diffMs = Math.abs(candidateTime - targetTime);
      if (diffMs < bestDiffMs) {
        bestDiffMs = diffMs;
        best = candidate;
      }
    }

    if (best) {
      return toSuggestion(best, Math.round(bestDiffMs / 60000));
    }
  }

  // No time-based match possible — fall back to the first location-bearing sibling.
  return toSuggestion(withLocation[0]!, null);
}
