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
  return [...assets].sort((left, right) => {
    const leftCapture = parseDate(left.captureDateTime);
    const rightCapture = parseDate(right.captureDateTime);

    if (leftCapture && rightCapture) {
      return rightCapture.getTime() - leftCapture.getTime();
    }

    if (leftCapture && !rightCapture) {
      return -1;
    }

    if (!leftCapture && rightCapture) {
      return 1;
    }

    const leftImportedAt = parseDate(left.importedAt);
    const rightImportedAt = parseDate(right.importedAt);
    if (leftImportedAt && rightImportedAt) {
      return rightImportedAt.getTime() - leftImportedAt.getTime();
    }

    if (leftImportedAt && !rightImportedAt) {
      return -1;
    }

    if (!leftImportedAt && rightImportedAt) {
      return 1;
    }

    return left.filename.localeCompare(right.filename);
  });
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
