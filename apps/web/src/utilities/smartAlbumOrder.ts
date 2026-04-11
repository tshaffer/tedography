import type { MediaAsset, MediaAssetAlbumMembership } from '@tedography/domain';

export type AlbumOrderingMode =
  | 'capture-time'
  | 'manual'
  | 'manual-no-capture-time';

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

function getUsableCaptureTimestamp(asset: MediaAsset): number | null {
  const parsed = parseDate(asset.captureDateTime);
  return parsed ? parsed.getTime() : null;
}

function getImportedTimestamp(asset: MediaAsset): number | null {
  const parsed = parseDate(asset.importedAt);
  return parsed ? parsed.getTime() : null;
}

function getAlbumMembership(
  asset: MediaAsset,
  albumId: string
): MediaAssetAlbumMembership | null {
  return (
    asset.albumMemberships?.find((membership) => membership.albumId === albumId) ?? null
  );
}

export function isForcedManualOrderInAlbum(asset: MediaAsset, albumId: string): boolean {
  if (!(asset.albumIds ?? []).includes(albumId)) {
    return false;
  }

  return getAlbumMembership(asset, albumId)?.forceManualOrder === true;
}

export function usesCaptureTimeOrderInAlbum(asset: MediaAsset, albumId: string): boolean {
  if (!(asset.albumIds ?? []).includes(albumId)) {
    return false;
  }

  return getUsableCaptureTimestamp(asset) !== null && !isForcedManualOrderInAlbum(asset, albumId);
}

export function getAlbumOrderingModeInAlbum(
  asset: MediaAsset,
  albumId: string
): AlbumOrderingMode | null {
  if (!(asset.albumIds ?? []).includes(albumId)) {
    return null;
  }

  if (usesCaptureTimeOrderInAlbum(asset, albumId)) {
    return 'capture-time';
  }

  return getUsableCaptureTimestamp(asset) === null ? 'manual-no-capture-time' : 'manual';
}

export function formatAlbumOrderingModeLabel(mode: AlbumOrderingMode | null): string | null {
  switch (mode) {
    case 'capture-time':
      return 'Capture Time';
    case 'manual':
      return 'Manual';
    case 'manual-no-capture-time':
      return 'Manual (No Capture Time)';
    default:
      return null;
  }
}

export function isManualOrderEligibleInAlbum(asset: MediaAsset, albumId: string): boolean {
  if (!(asset.albumIds ?? []).includes(albumId)) {
    return false;
  }

  return isForcedManualOrderInAlbum(asset, albumId) || getUsableCaptureTimestamp(asset) === null;
}

export function sortAssetsForSmartAlbumOrder(
  assets: MediaAsset[],
  albumId: string
): MediaAsset[] {
  return [...assets].sort((left, right) => {
    const leftCapture = getUsableCaptureTimestamp(left);
    const rightCapture = getUsableCaptureTimestamp(right);
    const leftUsesCaptureTime = leftCapture !== null && !isForcedManualOrderInAlbum(left, albumId);
    const rightUsesCaptureTime = rightCapture !== null && !isForcedManualOrderInAlbum(right, albumId);

    if (leftUsesCaptureTime && rightUsesCaptureTime) {
      if (leftCapture !== rightCapture) {
        return leftCapture - rightCapture;
      }
    } else if (leftUsesCaptureTime && !rightUsesCaptureTime) {
      return -1;
    } else if (!leftUsesCaptureTime && rightUsesCaptureTime) {
      return 1;
    } else {
      const leftManualOrder = getAlbumMembership(left, albumId)?.manualSortOrdinal;
      const rightManualOrder = getAlbumMembership(right, albumId)?.manualSortOrdinal;
      const leftHasManualOrder = typeof leftManualOrder === 'number' && Number.isFinite(leftManualOrder);
      const rightHasManualOrder = typeof rightManualOrder === 'number' && Number.isFinite(rightManualOrder);

      if (leftHasManualOrder && rightHasManualOrder && leftManualOrder !== rightManualOrder) {
        return leftManualOrder - rightManualOrder;
      }

      if (leftHasManualOrder && !rightHasManualOrder) {
        return -1;
      }

      if (!leftHasManualOrder && rightHasManualOrder) {
        return 1;
      }

      const leftImported = getImportedTimestamp(left);
      const rightImported = getImportedTimestamp(right);
      if (leftImported !== null && rightImported !== null && leftImported !== rightImported) {
        return leftImported - rightImported;
      }

      if (leftImported !== null && rightImported === null) {
        return -1;
      }

      if (leftImported === null && rightImported !== null) {
        return 1;
      }
    }

    const filenameComparison = left.filename.localeCompare(right.filename);
    if (filenameComparison !== 0) {
      return filenameComparison;
    }

    return left.id.localeCompare(right.id);
  });
}
