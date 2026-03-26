import type { GetPersonDetailResponse } from '@tedography/shared';
import { findByIds, listAssetsByConfirmedPersonId } from '../repositories/assetRepository.js';
import {
  listConfirmedFaceDetectionsByPersonId,
  summarizeFaceDetectionsByAssetIds
} from '../repositories/faceDetectionRepository.js';
import { findPersonById } from '../repositories/personRepository.js';
import { findFaceDetectionById } from '../repositories/faceDetectionRepository.js';
import { listActivePersonFaceExamplesByPersonId } from '../repositories/personFaceExampleRepository.js';

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
  const [faceSummariesByAssetId, examples, confirmedDetections] = await Promise.all([
    summarizeFaceDetectionsByAssetIds(assets.map((asset) => asset.id)),
    listActivePersonFaceExamplesByPersonId(personId),
    listConfirmedFaceDetectionsByPersonId(personId, 24),
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
  const exampleAssetsById = new Map((await findByIds(Array.from(new Set(examples.map((item) => item.mediaAssetId))))).map((asset) => [asset.id, asset]));
  const exampleDetectionsById = new Map((await Promise.all(examples.map((item) => findFaceDetectionById(item.faceDetectionId)))).flatMap((detection) => (detection ? [[detection.id, detection] as const] : [])));
  const confirmedDetectionAssetsById = new Map(
    (await findByIds(Array.from(new Set(confirmedDetections.map((item) => item.mediaAssetId))))).map((asset) => [asset.id, asset])
  );
  const activeExamplesByDetectionId = new Map(examples.map((example) => [example.faceDetectionId, example]));

  return {
    person,
    assetCount: sortedAssets.length,
    representativeAssetId,
    lastSeenAt,
    reviewableAssetCount,
    exampleCount: examples.length,
    assets: sortedAssets,
    confirmedFaces: confirmedDetections.flatMap((detection) => {
      const asset = confirmedDetectionAssetsById.get(detection.mediaAssetId);
      if (!asset) {
        return [];
      }

      const example = activeExamplesByDetectionId.get(detection.id);
      return [
        {
          detection: {
            id: detection.id,
            faceIndex: detection.faceIndex,
            ...(detection.previewPath !== undefined ? { previewPath: detection.previewPath } : {}),
            ...(detection.cropPath !== undefined ? { cropPath: detection.cropPath } : {}),
            matchStatus: detection.matchStatus,
            ...(detection.matchedPersonId !== undefined ? { matchedPersonId: detection.matchedPersonId } : {}),
            ...(detection.autoMatchCandidatePersonId !== undefined
              ? { autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId }
              : {}),
            ...(detection.updatedAt !== undefined ? { updatedAt: detection.updatedAt } : {}),
            ...(detection.createdAt !== undefined ? { createdAt: detection.createdAt } : {})
          },
          asset: {
            id: asset.id,
            filename: asset.filename,
            captureDateTime: asset.captureDateTime ?? null,
            originalArchivePath: asset.originalArchivePath
          },
          ...(example ? { exampleId: example.id } : {})
        }
      ];
    }),
    exampleFaces: examples.flatMap((example) => {
      const asset = exampleAssetsById.get(example.mediaAssetId);
      const detection = exampleDetectionsById.get(example.faceDetectionId);
      if (!asset || !detection) {
        return [];
      }

      return [
        {
          id: example.id,
          personId: example.personId,
          faceDetectionId: example.faceDetectionId,
          mediaAssetId: example.mediaAssetId,
          engine: example.engine,
          ...(example.subjectKey !== undefined ? { subjectKey: example.subjectKey } : {}),
          ...(example.engineExampleId !== undefined ? { engineExampleId: example.engineExampleId } : {}),
          ...(example.updatedAt !== undefined ? { updatedAt: example.updatedAt } : {}),
          ...(example.createdAt !== undefined ? { createdAt: example.createdAt } : {}),
          detection: {
            id: detection.id,
            faceIndex: detection.faceIndex,
            ...(detection.previewPath !== undefined ? { previewPath: detection.previewPath } : {}),
            ...(detection.cropPath !== undefined ? { cropPath: detection.cropPath } : {}),
            matchStatus: detection.matchStatus,
            ...(detection.matchedPersonId !== undefined ? { matchedPersonId: detection.matchedPersonId } : {}),
            ...(detection.autoMatchCandidatePersonId !== undefined
              ? { autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId }
              : {}),
            ...(detection.updatedAt !== undefined ? { updatedAt: detection.updatedAt } : {}),
            ...(detection.createdAt !== undefined ? { createdAt: detection.createdAt } : {})
          },
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
