import type { MediaAsset } from '@tedography/domain';
import type { DuplicateGroupListItem } from '@tedography/shared';

export interface DuplicateResolutionVisibilitySummary {
  assetId: string;
  groupKey: string;
  selectedCanonicalAssetId: string;
  role: 'canonical' | 'secondary';
  isSuppressedByDefault: boolean;
  resolutionStatus: 'confirmed';
}

export function buildDuplicateResolutionVisibilityMap(
  groups: DuplicateGroupListItem[]
): Map<string, DuplicateResolutionVisibilitySummary> {
  const summaries = new Map<string, DuplicateResolutionVisibilitySummary>();

  for (const group of groups) {
    if (group.resolutionStatus !== 'confirmed') {
      continue;
    }

    for (const assetId of group.assetIds) {
      const role = assetId === group.selectedCanonicalAssetId ? 'canonical' : 'secondary';
      summaries.set(assetId, {
        assetId,
        groupKey: group.groupKey,
        selectedCanonicalAssetId: group.selectedCanonicalAssetId,
        role,
        isSuppressedByDefault: role === 'secondary',
        resolutionStatus: 'confirmed'
      });
    }
  }

  return summaries;
}

export function filterAssetsByDuplicateSuppression(
  assets: MediaAsset[],
  duplicateResolutionVisibilityMap: Map<string, DuplicateResolutionVisibilitySummary>,
  showSuppressedDuplicates: boolean
): MediaAsset[] {
  if (showSuppressedDuplicates) {
    return assets;
  }

  return assets.filter((asset) => !duplicateResolutionVisibilityMap.get(asset.id)?.isSuppressedByDefault);
}

export function getDuplicateVisibilityBadgeLabel(
  summary: DuplicateResolutionVisibilitySummary | undefined
): string | null {
  if (!summary) {
    return null;
  }

  return summary.role === 'canonical' ? 'Keeper' : 'Duplicate';
}
