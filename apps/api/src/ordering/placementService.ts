import type { MediaAsset } from '@tedography/domain';
import { getEffectiveAlbumSortTime, sortAssetsForSmartAlbumOrder } from '@tedography/shared';

export interface PlacementUpdate {
  assetId: string;
  manualSortTime: number;
}

// Spacing used when placing into open-ended gaps (start/end of album).
const OPEN_GAP_MS = 1000;

/**
 * Compute virtual sort times that place `movedAssetIds` (in the given order)
 * immediately after `placeAfterAssetId` (or at the start of the album when null).
 *
 * Rules:
 * - Between two distinct effective times, moved photos are spaced evenly in the
 *   open interval. Fractional milliseconds are fine — manualSortTime is a double.
 * - When the anchor sits inside a clump of identical effective times, the next
 *   *distinct* time bounds the interval, so the placement lands after the whole
 *   clump (members of an identical-time clump are indistinguishable by time).
 * - Placing after a photo with no effective time (legacy/unplaced section) pins
 *   that anchor first, so "after it" is well-defined; the pin is included in the
 *   returned updates.
 */
export function computePlacementUpdates(input: {
  albumId: string;
  albumAssets: MediaAsset[];
  movedAssetIds: string[];
  placeAfterAssetId: string | null;
}): PlacementUpdate[] {
  const { albumId, albumAssets, movedAssetIds, placeAfterAssetId } = input;

  const movedIdSet = new Set(movedAssetIds);
  const sorted = sortAssetsForSmartAlbumOrder(albumAssets, albumId);
  const remaining = sorted.filter((asset) => !movedIdSet.has(asset.id));
  const remainingTimes = remaining.map((asset) => getEffectiveAlbumSortTime(asset, albumId));

  const updates: PlacementUpdate[] = [];

  const maxTime = remainingTimes.reduce<number | null>(
    (max, time) => (time !== null && (max === null || time > max) ? time : max),
    null
  );

  let leftTime: number | null;
  let anchorIndex: number;

  if (placeAfterAssetId === null) {
    anchorIndex = -1;
    leftTime = null;
  } else {
    anchorIndex = remaining.findIndex((asset) => asset.id === placeAfterAssetId);
    if (anchorIndex < 0) {
      throw new Error('placeAfterAssetId is not a member of the album');
    }

    leftTime = remainingTimes[anchorIndex] ?? null;
    if (leftTime === null) {
      // Anchor has no effective time — pin it after everything timed so the
      // moved photos can follow it.
      leftTime = (maxTime ?? Date.now()) + OPEN_GAP_MS;
      updates.push({ assetId: placeAfterAssetId, manualSortTime: leftTime });
    }
  }

  // The right bound is the next *distinct* effective time after the anchor.
  let rightTime: number | null = null;
  for (let index = anchorIndex + 1; index < remaining.length; index += 1) {
    const time = remainingTimes[index] ?? null;
    if (time !== null && (leftTime === null || time > leftTime)) {
      rightTime = time;
      break;
    }
  }

  const count = movedAssetIds.length;
  for (let position = 0; position < count; position += 1) {
    const assetId = movedAssetIds[position];
    if (assetId === undefined) {
      continue;
    }

    let manualSortTime: number;
    if (leftTime !== null && rightTime !== null) {
      manualSortTime = leftTime + ((rightTime - leftTime) * (position + 1)) / (count + 1);
    } else if (leftTime === null && rightTime !== null) {
      manualSortTime = rightTime - (count - position) * OPEN_GAP_MS;
    } else if (leftTime !== null) {
      manualSortTime = leftTime + (position + 1) * OPEN_GAP_MS;
    } else {
      manualSortTime = Date.now() + position * OPEN_GAP_MS;
    }

    updates.push({ assetId, manualSortTime });
  }

  return updates;
}
