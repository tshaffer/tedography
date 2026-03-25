import type { GetPersonDetailResponse } from '@tedography/shared';
import { findByIds, listAssetsByConfirmedPersonId } from '../repositories/assetRepository.js';
import {
  listConfirmedFaceDetectionsByPersonId,
  summarizeFaceDetectionsByAssetIds
} from '../repositories/faceDetectionRepository.js';
import { findPersonById } from '../repositories/personRepository.js';

function getSortableTimestamp(candidate: string | null | undefined): number {
  if (!candidate) {
    return 0;
  }

  const parsed = new Date(candidate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPersonDetail(personId: string): Promise<GetPersonDetailResponse | null> {
  const person = await findPersonById(personId);
  if (!person) {
    return null;
  }

  const assets = await listAssetsByConfirmedPersonId(personId);
  const [faceSummariesByAssetId, exampleDetections] = await Promise.all([
    summarizeFaceDetectionsByAssetIds(assets.map((asset) => asset.id)),
    listConfirmedFaceDetectionsByPersonId(personId, 10),
  ]);

  const assetsWithSummary = assets.map((asset) => ({
    ...asset,
    reviewableDetectionsCount: faceSummariesByAssetId[asset.id]?.reviewableDetectionsCount ?? 0
  }));

  const sortedAssets = [...assetsWithSummary].sort((left, right) => {
    const leftSeen = getSortableTimestamp(left.captureDateTime ?? left.importedAt);
    const rightSeen = getSortableTimestamp(right.captureDateTime ?? right.importedAt);
    return rightSeen - leftSeen || right.id.localeCompare(left.id);
  });

  const representativeAssetId = sortedAssets[0]?.id ?? null;
  const lastSeenAt = sortedAssets[0]?.captureDateTime ?? sortedAssets[0]?.importedAt ?? null;
  const reviewableAssetCount = sortedAssets.filter((asset) => asset.reviewableDetectionsCount > 0).length;
  const exampleAssetsById = new Map((await findByIds(Array.from(new Set(exampleDetections.map((item) => item.mediaAssetId))))).map((asset) => [asset.id, asset]));

  return {
    person,
    assetCount: sortedAssets.length,
    representativeAssetId,
    lastSeenAt,
    reviewableAssetCount,
    assets: sortedAssets,
    exampleFaces: exampleDetections.flatMap((detection) => {
      const asset = exampleAssetsById.get(detection.mediaAssetId);
      if (!asset) {
        return [];
      }

      return [
        {
          id: detection.id,
          mediaAssetId: detection.mediaAssetId,
          faceIndex: detection.faceIndex,
          ...(detection.previewPath !== undefined ? { previewPath: detection.previewPath } : {}),
          ...(detection.cropPath !== undefined ? { cropPath: detection.cropPath } : {}),
          matchStatus: detection.matchStatus,
          ...(detection.matchedPersonId !== undefined ? { matchedPersonId: detection.matchedPersonId } : {}),
          ...(detection.autoMatchCandidatePersonId !== undefined
            ? { autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId }
            : {}),
          ...(detection.updatedAt !== undefined ? { updatedAt: detection.updatedAt } : {}),
          ...(detection.createdAt !== undefined ? { createdAt: detection.createdAt } : {}),
          asset: {
            id: asset.id,
            filename: asset.filename,
            captureDateTime: asset.captureDateTime ?? null
          }
        }
      ];
    })
  };
}
