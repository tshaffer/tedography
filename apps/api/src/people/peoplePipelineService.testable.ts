import { MediaType, type FaceDetection, type FaceMatchReview, type MediaAsset, type MediaAssetPerson } from '@tedography/domain';

export function determinePeoplePipelineEligibilityForTest(
  asset: MediaAsset
): { eligible: boolean; reason?: string } {
  if (asset.mediaType !== MediaType.Photo) {
    return { eligible: false, reason: 'only-photo-assets-supported' };
  }

  const format = asset.originalFileFormat.toLowerCase();
  if (format === 'jpg' || format === 'jpeg' || format === 'png') {
    return { eligible: true };
  }

  if ((format === 'heic' || format === 'heif') && asset.displayFileFormat.toLowerCase() === 'jpg') {
    return { eligible: true };
  }

  return { eligible: false, reason: 'unsupported-format' };
}

export function normalizeDerivedAssetPeopleForTest(people: MediaAssetPerson[]): MediaAssetPerson[] {
  return [...people].sort((left, right) =>
    left.displayName === right.displayName
      ? left.personId.localeCompare(right.personId)
      : left.displayName.localeCompare(right.displayName)
  );
}

export function determineConfirmedReviewDecisionForTest(
  detection: FaceDetection,
  requestedPersonId: string | null
): FaceMatchReview['decision'] {
  const suggestedPersonId = detection.autoMatchCandidatePersonId ?? detection.matchedPersonId ?? null;
  if (!suggestedPersonId || !requestedPersonId) {
    return 'confirmed';
  }

  return suggestedPersonId === requestedPersonId ? 'confirmed' : 'assignedToDifferentPerson';
}
