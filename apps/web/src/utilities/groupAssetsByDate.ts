import { type MediaAsset } from '@tedography/domain';

export interface AssetDateGroup {
  key: string;
  label: string;
  assets: MediaAsset[];
}

function parseDate(value?: string | null): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getTimestamp(value?: string | null): number {
  const parsed = parseDate(value);
  return parsed ? parsed.getTime() : Number.NaN;
}

function getLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function sortVisibleAssetsForTimeline(assets: MediaAsset[]): MediaAsset[] {
  return assets
    .map((asset) => ({
      asset,
      captureTimestamp: getTimestamp(asset.captureDateTime),
      importedTimestamp: getTimestamp(asset.importedAt)
    }))
    .sort((left, right) => {
      const leftHasCapture = Number.isFinite(left.captureTimestamp);
      const rightHasCapture = Number.isFinite(right.captureTimestamp);

      if (leftHasCapture && rightHasCapture) {
        return right.captureTimestamp - left.captureTimestamp;
      }

      if (leftHasCapture && !rightHasCapture) {
        return -1;
      }

      if (!leftHasCapture && rightHasCapture) {
        return 1;
      }

      const leftHasImported = Number.isFinite(left.importedTimestamp);
      const rightHasImported = Number.isFinite(right.importedTimestamp);
      if (leftHasImported && rightHasImported) {
        return right.importedTimestamp - left.importedTimestamp;
      }

      if (leftHasImported && !rightHasImported) {
        return -1;
      }

      if (!leftHasImported && rightHasImported) {
        return 1;
      }

      return left.asset.filename.localeCompare(right.asset.filename);
    })
    .map((entry) => entry.asset);
}

export function groupAssetsByDate(assets: MediaAsset[]): AssetDateGroup[] {
  const grouped = new Map<string, AssetDateGroup>();

  for (const asset of assets) {
    const captureDate = parseDate(asset.captureDateTime);
    const key = captureDate ? getLocalDayKey(captureDate) : 'unknown-date';
    const label = captureDate ? formatLocalDayLabel(captureDate) : 'Unknown Date';

    const existingGroup = grouped.get(key);
    if (existingGroup) {
      existingGroup.assets.push(asset);
      continue;
    }

    grouped.set(key, {
      key,
      label,
      assets: [asset]
    });
  }

  return Array.from(grouped.values());
}
