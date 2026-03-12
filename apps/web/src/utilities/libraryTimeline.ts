import { type MediaAsset } from '@tedography/domain';

export interface TimelineMonthGroup {
  key: string;
  label: string;
  yearKey: string;
  yearLabel: string;
  assets: MediaAsset[];
}

export interface TimelineNavigationMonth {
  key: string;
  label: string;
  assetCount: number;
}

export interface TimelineNavigationYear {
  key: string;
  label: string;
  months: TimelineNavigationMonth[];
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

function getLocalMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatLocalMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long'
  }).format(date);
}

export function groupAssetsByCaptureMonth(assets: MediaAsset[]): TimelineMonthGroup[] {
  const grouped = new Map<string, TimelineMonthGroup>();

  for (const asset of assets) {
    const captureDate = parseDate(asset.captureDateTime);
    const key = captureDate ? getLocalMonthKey(captureDate) : 'unknown-date';
    const label = captureDate ? formatLocalMonthLabel(captureDate) : 'Unknown Date';
    const yearKey = captureDate ? String(captureDate.getFullYear()) : 'unknown-date';
    const yearLabel = captureDate ? String(captureDate.getFullYear()) : 'Unknown Date';

    const existing = grouped.get(key);
    if (existing) {
      existing.assets.push(asset);
      continue;
    }

    grouped.set(key, {
      key,
      label,
      yearKey,
      yearLabel,
      assets: [asset]
    });
  }

  return Array.from(grouped.values());
}

export function buildTimelineNavigationYears(
  monthGroups: TimelineMonthGroup[]
): TimelineNavigationYear[] {
  const years = new Map<string, TimelineNavigationYear>();

  for (const group of monthGroups) {
    const existingYear = years.get(group.yearKey);
    const month: TimelineNavigationMonth = {
      key: group.key,
      label: group.label,
      assetCount: group.assets.length
    };

    if (existingYear) {
      existingYear.months.push(month);
      continue;
    }

    years.set(group.yearKey, {
      key: group.yearKey,
      label: group.yearLabel,
      months: [month]
    });
  }

  return Array.from(years.values());
}
