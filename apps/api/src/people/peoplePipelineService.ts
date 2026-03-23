import type {
  FaceDetection,
  FaceDetectionIgnoredReason,
  FaceMatchReview,
  MediaAsset,
  MediaAssetPerson,
  Person
} from '@tedography/domain';
import { MediaType } from '@tedography/domain';
import type {
  ListAssetFaceDetectionsResponse,
  ProcessPeopleAssetResponse,
  ReviewFaceDetectionRequest,
  ReviewFaceDetectionResponse
} from '@tedography/shared';
import { config } from '../config.js';
import { findById, updateMediaAssetPeople } from '../repositories/assetRepository.js';
import {
  findFaceDetectionById,
  listFaceDetectionsByAssetId,
  replaceFaceDetectionsForAsset,
  updateFaceDetection
} from '../repositories/faceDetectionRepository.js';
import {
  listFaceMatchReviewsByAssetId,
  replaceFaceMatchReviewsForAsset,
  upsertFaceMatchReview
} from '../repositories/faceMatchReviewRepository.js';
import { createPerson, findPeopleByIds, listPeople } from '../repositories/personRepository.js';
import {
  AssetMediaPathResolutionError,
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset
} from '../media/resolveAssetMediaPath.js';
import { log } from '../logger.js';
import { getPeopleRecognitionEngine } from './engineFactory.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isEligibleMediaAsset(asset: MediaAsset): { eligible: boolean; reason?: string } {
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

function resolvePipelineImagePath(asset: MediaAsset): string {
  const format = asset.originalFileFormat.toLowerCase();
  if (format === 'jpg' || format === 'jpeg' || format === 'png') {
    return resolveOriginalAbsolutePathForAsset(asset);
  }

  return resolveDisplayAbsolutePathForAsset(asset);
}

function computeFaceAreaPercent(asset: MediaAsset, detection: { boundingBox: FaceDetection['boundingBox'] }): number | null {
  const width = asset.width ?? null;
  const height = asset.height ?? null;
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  const areaPercent = detection.boundingBox.width * detection.boundingBox.height * 100;
  return Number(areaPercent.toFixed(4));
}

function computeCropDimensions(asset: MediaAsset, detection: { boundingBox: FaceDetection['boundingBox'] }): {
  widthPx: number;
  heightPx: number;
} | null {
  if (!asset.width || !asset.height) {
    return null;
  }

  return {
    widthPx: Math.round(asset.width * detection.boundingBox.width),
    heightPx: Math.round(asset.height * detection.boundingBox.height)
  };
}

function determineIgnoredReason(input: {
  asset: MediaAsset;
  detectionConfidence: number | null;
  qualityScore: number | null;
  boundingBox: FaceDetection['boundingBox'];
}): FaceDetectionIgnoredReason | null {
  if (input.detectionConfidence !== null && input.detectionConfidence < config.peoplePipeline.minDetectionConfidence) {
    return 'too-low-quality';
  }

  const faceAreaPercent = computeFaceAreaPercent(input.asset, input);
  if (faceAreaPercent !== null && faceAreaPercent < config.peoplePipeline.minFaceAreaPercent) {
    return 'too-small';
  }

  const cropDimensions = computeCropDimensions(input.asset, input);
  if (
    cropDimensions &&
    (cropDimensions.widthPx < config.peoplePipeline.minCropWidthPx ||
      cropDimensions.heightPx < config.peoplePipeline.minCropHeightPx)
  ) {
    return 'too-small';
  }

  if (input.qualityScore !== null && input.qualityScore < 0.45) {
    return 'too-low-quality';
  }

  return null;
}

async function recomputeMediaAssetPeople(assetId: string): Promise<MediaAssetPerson[]> {
  const detections = await listFaceDetectionsByAssetId(assetId);
  const confirmedDetections = detections.filter(
    (detection) => detection.matchStatus === 'confirmed' && typeof detection.matchedPersonId === 'string'
  );
  const matchedPersonIds = Array.from(
    new Set(confirmedDetections.map((detection) => detection.matchedPersonId).filter(Boolean))
  ) as string[];
  const people = await findPeopleByIds(matchedPersonIds);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const derivedPeople: MediaAssetPerson[] = [];

  for (const personId of matchedPersonIds) {
    const person = peopleById.get(personId);
    if (!person) {
      continue;
    }

    const confirmedAt =
      confirmedDetections
        .filter((detection) => detection.matchedPersonId === personId)
        .map((detection) => detection.updatedAt ?? detection.createdAt ?? null)
        .filter((value): value is string => typeof value === 'string')
        .sort((left, right) => left.localeCompare(right))[0] ?? null;

    derivedPeople.push({
      personId,
      displayName: person.displayName,
      source: 'confirmed-face-detection',
      confirmedAt
    });
  }

  derivedPeople
    .sort((left, right) =>
      left.displayName === right.displayName
        ? left.personId.localeCompare(right.personId)
        : left.displayName.localeCompare(right.displayName)
    );

  await updateMediaAssetPeople(assetId, derivedPeople);
  return derivedPeople;
}

async function loadPeoplePipelineAssetState(assetId: string): Promise<ListAssetFaceDetectionsResponse> {
  const [detections, reviews, asset] = await Promise.all([
    listFaceDetectionsByAssetId(assetId),
    listFaceMatchReviewsByAssetId(assetId),
    findById(assetId)
  ]);

  return {
    assetId,
    detections,
    reviews,
    people: asset?.people ?? []
  };
}

export async function processPeoplePipelineForAsset(assetId: string, _options?: {
  force?: boolean;
}): Promise<ProcessPeopleAssetResponse> {
  const asset = await findById(assetId);
  if (!asset) {
    throw new Error(`Media asset not found: ${assetId}`);
  }

  if (!config.peoplePipeline.enabled) {
    return {
      assetId,
      processed: false,
      skippedReason: 'people-pipeline-disabled',
      engine: config.peoplePipeline.engine,
      pipelineVersion: config.peoplePipeline.pipelineVersion,
      detectionsCreated: 0,
      detections: await listFaceDetectionsByAssetId(assetId),
      reviews: await listFaceMatchReviewsByAssetId(assetId),
      people: asset.people ?? []
    };
  }

  const eligibility = isEligibleMediaAsset(asset);
  if (!eligibility.eligible) {
    return {
      assetId,
      processed: false,
      ...(eligibility.reason ? { skippedReason: eligibility.reason } : {}),
      engine: config.peoplePipeline.engine,
      pipelineVersion: config.peoplePipeline.pipelineVersion,
      detectionsCreated: 0,
      detections: await listFaceDetectionsByAssetId(assetId),
      reviews: await listFaceMatchReviewsByAssetId(assetId),
      people: asset.people ?? []
    };
  }

  let imagePath: string;
  try {
    imagePath = resolvePipelineImagePath(asset);
  } catch (error) {
    if (error instanceof AssetMediaPathResolutionError) {
      return {
        assetId,
        processed: false,
        skippedReason: error.message,
        engine: config.peoplePipeline.engine,
        pipelineVersion: config.peoplePipeline.pipelineVersion,
        detectionsCreated: 0,
        detections: await listFaceDetectionsByAssetId(assetId),
        reviews: await listFaceMatchReviewsByAssetId(assetId),
        people: asset.people ?? []
      };
    }

    throw error;
  }

  const people = await listPeople();
  const engine = getPeopleRecognitionEngine();
  const detectedFaces = await engine.detectFaces({ asset, imagePath });

  const nextDetections: Array<Omit<FaceDetection, 'id' | 'createdAt' | 'updatedAt'>> = [];
  const pendingReviewSpecs: Array<Omit<FaceMatchReview, 'id' | 'createdAt' | 'updatedAt'>> = [];

  for (const [index, detectedFace] of detectedFaces.entries()) {
    const normalizedBoundingBox = {
      left: Number(clamp(detectedFace.boundingBox.left, 0, 1).toFixed(4)),
      top: Number(clamp(detectedFace.boundingBox.top, 0, 1).toFixed(4)),
      width: Number(clamp(detectedFace.boundingBox.width, 0.01, 1).toFixed(4)),
      height: Number(clamp(detectedFace.boundingBox.height, 0.01, 1).toFixed(4))
    };
    const ignoredReason = determineIgnoredReason({
      asset,
      detectionConfidence: detectedFace.detectionConfidence ?? null,
      qualityScore: detectedFace.qualityScore ?? null,
      boundingBox: normalizedBoundingBox
    });

    const faceDetectionBase = {
      mediaAssetId: asset.id,
      faceIndex: index,
      boundingBox: normalizedBoundingBox,
      cropPath: null,
      previewPath: null,
      detectionConfidence: detectedFace.detectionConfidence ?? null,
      qualityScore: detectedFace.qualityScore ?? null,
      faceAreaPercent: computeFaceAreaPercent(asset, { boundingBox: normalizedBoundingBox }),
      engine: engine.engineName,
      engineVersion: engine.engineVersion,
      pipelineVersion: config.peoplePipeline.pipelineVersion
    };

    if (ignoredReason) {
      nextDetections.push({
        ...faceDetectionBase,
        matchedPersonId: null,
        matchConfidence: null,
        matchStatus: 'ignored',
        autoMatchCandidatePersonId: null,
        autoMatchCandidateConfidence: null,
        ignoredReason
      });
      continue;
    }

    const candidates = await engine.matchFace({
      asset,
      imagePath,
      detection: { faceIndex: index, boundingBox: normalizedBoundingBox },
      people
    });
    const bestCandidate = candidates[0] ?? null;

    if (!bestCandidate || bestCandidate.confidence < config.peoplePipeline.reviewThreshold) {
      nextDetections.push({
        ...faceDetectionBase,
        matchedPersonId: null,
        matchConfidence: null,
        matchStatus: 'unmatched',
        autoMatchCandidatePersonId: null,
        autoMatchCandidateConfidence: null,
        ignoredReason: null
      });
      continue;
    }

    const matchStatus = bestCandidate.confidence >= config.peoplePipeline.autoMatchThreshold
      ? 'autoMatched'
      : 'suggested';

    nextDetections.push({
      ...faceDetectionBase,
      matchedPersonId: null,
      matchConfidence: null,
      matchStatus,
      autoMatchCandidatePersonId: bestCandidate.personId,
      autoMatchCandidateConfidence: bestCandidate.confidence,
      ignoredReason: null
    });
  }

  const detections = await replaceFaceDetectionsForAsset({
    mediaAssetId: asset.id,
    detections: nextDetections
  });

  for (const detection of detections) {
    if (detection.matchStatus !== 'suggested' && detection.matchStatus !== 'autoMatched') {
      continue;
    }

    pendingReviewSpecs.push({
      faceDetectionId: detection.id,
      mediaAssetId: asset.id,
      suggestedPersonId: detection.autoMatchCandidatePersonId ?? null,
      suggestedConfidence: detection.autoMatchCandidateConfidence ?? null,
      finalPersonId: null,
      decision: 'pending',
      reviewer: null,
      notes: null,
      ignoredReason: null
    });
  }

  const reviews = await replaceFaceMatchReviewsForAsset({
    mediaAssetId: asset.id,
    reviews: pendingReviewSpecs
  });
  const derivedPeople = await recomputeMediaAssetPeople(asset.id);

  return {
    assetId: asset.id,
    processed: true,
    engine: engine.engineName,
    pipelineVersion: config.peoplePipeline.pipelineVersion,
    detectionsCreated: detections.length,
    detections,
    reviews,
    people: derivedPeople
  };
}

export async function listAssetFaceDetections(assetId: string): Promise<ListAssetFaceDetectionsResponse> {
  return loadPeoplePipelineAssetState(assetId);
}

function determineConfirmedReviewDecision(
  detection: FaceDetection,
  requestedPersonId: string | null
): FaceMatchReview['decision'] {
  const suggestedPersonId = detection.autoMatchCandidatePersonId ?? detection.matchedPersonId ?? null;
  if (!suggestedPersonId || !requestedPersonId) {
    return 'confirmed';
  }

  return suggestedPersonId === requestedPersonId ? 'confirmed' : 'assignedToDifferentPerson';
}

export async function reviewFaceDetection(
  detectionId: string,
  request: ReviewFaceDetectionRequest
): Promise<ReviewFaceDetectionResponse | null> {
  const detection = await findFaceDetectionById(detectionId);
  if (!detection) {
    return null;
  }

  let finalPerson: Person | null = null;
  let nextDecision: FaceMatchReview['decision'];
  let nextStatus: FaceDetection['matchStatus'];
  let ignoredReason: FaceDetection['ignoredReason'] = null;

  if (request.action === 'confirm') {
    const personId = request.personId ?? detection.autoMatchCandidatePersonId ?? detection.matchedPersonId ?? null;
    if (!personId) {
      throw new Error('personId is required to confirm a face detection without a suggested candidate.');
    }

    finalPerson = await createOrResolveExistingPerson(personId, undefined);
    nextDecision = determineConfirmedReviewDecision(detection, finalPerson.id);
    nextStatus = 'confirmed';
  } else if (request.action === 'assign') {
    if (!request.personId) {
      throw new Error('personId is required when assigning to an existing person.');
    }

    finalPerson = await createOrResolveExistingPerson(request.personId, undefined);
    nextDecision = determineConfirmedReviewDecision(detection, finalPerson.id);
    nextStatus = 'confirmed';
  } else if (request.action === 'createAndAssign') {
    if (typeof request.displayName !== 'string' || request.displayName.trim().length === 0) {
      throw new Error('displayName is required when creating and assigning a new person.');
    }

    finalPerson = await createPerson({ displayName: request.displayName.trim() });
    nextDecision = determineConfirmedReviewDecision(detection, finalPerson.id);
    nextStatus = 'confirmed';
  } else if (request.action === 'ignore') {
    ignoredReason = request.ignoredReason ?? 'user-ignored';
    nextDecision = 'ignored';
    nextStatus = 'ignored';
  } else {
    nextDecision = 'rejected';
    nextStatus = 'rejected';
  }

  const updatedDetection = await updateFaceDetection({
    id: detection.id,
    matchedPersonId: finalPerson?.id ?? null,
    matchConfidence:
      nextStatus === 'confirmed'
        ? detection.autoMatchCandidateConfidence ?? detection.matchConfidence ?? null
        : null,
    matchStatus: nextStatus,
    autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId ?? null,
    autoMatchCandidateConfidence: detection.autoMatchCandidateConfidence ?? null,
    ignoredReason
  });
  if (!updatedDetection) {
    return null;
  }

  const review = await upsertFaceMatchReview({
    faceDetectionId: detection.id,
    mediaAssetId: detection.mediaAssetId,
    suggestedPersonId: detection.autoMatchCandidatePersonId ?? null,
    suggestedConfidence: detection.autoMatchCandidateConfidence ?? null,
    finalPersonId: finalPerson?.id ?? null,
    decision: nextDecision,
    reviewer: request.reviewer?.trim() || null,
    notes: request.notes?.trim() || null,
    ignoredReason
  });

  const people = await recomputeMediaAssetPeople(detection.mediaAssetId);
  return {
    detection: updatedDetection,
    review,
    people
  };
}

async function createOrResolveExistingPerson(personId: string, displayName: string | undefined): Promise<Person> {
  const existingPeople = await findPeopleByIds([personId]);
  const existing = existingPeople[0] ?? null;
  if (existing) {
    return existing;
  }

  if (displayName && displayName.trim().length > 0) {
    return createPerson({ displayName: displayName.trim() });
  }

  throw new Error(`Person not found: ${personId}`);
}

export function schedulePeoplePipelineForAsset(assetId: string): void {
  if (!config.peoplePipeline.enabled) {
    return;
  }

  setImmediate(() => {
    void processPeoplePipelineForAsset(assetId).catch((error) => {
      log.error(`People pipeline processing failed for asset ${assetId}`, error);
    });
  });
}
