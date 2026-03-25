import type { ListPeopleBrowseResponse } from '@tedography/shared';
import { listPeople } from '../repositories/personRepository.js';
import { listPeopleBrowseSourceAssets } from '../repositories/assetRepository.js';
import { summarizeFaceDetectionsByAssetIds } from '../repositories/faceDetectionRepository.js';
import { countActivePersonFaceExamplesByPersonIds } from '../repositories/personFaceExampleRepository.js';

function getSortableTimestamp(candidate: string | null | undefined): number {
  if (!candidate) {
    return 0;
  }

  const parsed = new Date(candidate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listPeopleBrowseSummaries(): Promise<ListPeopleBrowseResponse> {
  const [people, assets] = await Promise.all([listPeople(), listPeopleBrowseSourceAssets()]);
  const faceSummariesByAssetId = await summarizeFaceDetectionsByAssetIds(assets.map((asset) => asset.id));
  const exampleCountsByPersonId = await countActivePersonFaceExamplesByPersonIds(people.map((person) => person.id));

  const summariesByPersonId = new Map<
    string,
    {
      assetCount: number;
      representativeAssetId: string | null;
      lastSeenAt: string | null;
      reviewableAssetCount: number;
    }
  >();

  for (const asset of assets) {
    const peopleOnAsset = asset.people ?? [];
    if (peopleOnAsset.length === 0) {
      continue;
    }

    const seenAt = asset.captureDateTime ?? asset.importedAt ?? null;
    const seenAtTimestamp = getSortableTimestamp(seenAt);
    const reviewableCount = faceSummariesByAssetId[asset.id]?.reviewableDetectionsCount ?? 0;

    for (const person of peopleOnAsset) {
      const current =
        summariesByPersonId.get(person.personId) ?? {
          assetCount: 0,
          representativeAssetId: null,
          lastSeenAt: null,
          reviewableAssetCount: 0
        };

      const currentTimestamp = getSortableTimestamp(current.lastSeenAt);
      const isMoreRecent = seenAtTimestamp > currentTimestamp;

      summariesByPersonId.set(person.personId, {
        assetCount: current.assetCount + 1,
        representativeAssetId: isMoreRecent ? asset.id : current.representativeAssetId ?? asset.id,
        lastSeenAt: isMoreRecent ? seenAt : current.lastSeenAt ?? seenAt,
        reviewableAssetCount: current.reviewableAssetCount + (reviewableCount > 0 ? 1 : 0)
      });
    }
  }

  return {
    items: people.map((person) => {
      const summary = summariesByPersonId.get(person.id);
      return {
        person,
        assetCount: summary?.assetCount ?? 0,
        representativeAssetId: summary?.representativeAssetId ?? null,
        lastSeenAt: summary?.lastSeenAt ?? null,
        reviewableAssetCount: summary?.reviewableAssetCount ?? 0,
        exampleCount: exampleCountsByPersonId[person.id] ?? 0
      };
    })
  };
}
