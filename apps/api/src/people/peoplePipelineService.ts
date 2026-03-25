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
  EnrollPersonFromDetectionResponse,
  ListAssetFaceDetectionsResponse,
  PeoplePipelineSummaryResponse,
  PeopleReviewQueueSort,
  ListPeopleReviewQueueResponse,
  PeopleReviewQueueItem,
  ProcessPeopleAssetResponse,
  ReviewFaceDetectionRequest,
  ReviewFaceDetectionResponse
} from '@tedography/shared';
import { config } from '../config.js';
import { findById, findByIds, updateMediaAssetPeople } from '../repositories/assetRepository.js';
import {
  countFaceDetectionsByStatus,
  findFaceDetectionById,
  listFaceDetections,
  listFaceDetectionsByAssetId,
  replaceFaceDetectionsForAsset,
  updateFaceDetection
} from '../repositories/faceDetectionRepository.js';
import {
  listFaceMatchReviewsByDetectionIds,
  listFaceMatchReviewsByAssetId,
  countFaceMatchReviewsByDecision,
  replaceFaceMatchReviewsForAsset,
  upsertFaceMatchReview
} from '../repositories/faceMatchReviewRepository.js';
import { createPerson, findPeopleByIds, findPersonById, listPeople } from '../repositories/personRepository.js';
import {
  AssetMediaPathResolutionError,
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset
} from '../media/resolveAssetMediaPath.js';
import { log } from '../logger.js';
import { generateFaceCropForAsset } from './faceCropStorage.js';
import { getPeopleRecognitionEngine } from './engineFactory.js';
import { PeopleRecognitionEngineError } from './recognitionEngine.js';

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

function getDetectionSortConfidence(detection: FaceDetection): number {
  return detection.autoMatchCandidateConfidence ?? detection.matchConfidence ?? detection.detectionConfidence ?? -1;
}

function sortPeopleReviewItems(items: PeopleReviewQueueItem[], sort: PeopleReviewQueueSort): PeopleReviewQueueItem[] {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (sort === 'assetId') {
      return left.asset.id === right.asset.id
        ? left.detection.faceIndex - right.detection.faceIndex
        : left.asset.id.localeCompare(right.asset.id);
    }

    if (sort === 'filename') {
      return left.asset.filename === right.asset.filename
        ? left.asset.id.localeCompare(right.asset.id)
        : left.asset.filename.localeCompare(right.asset.filename);
    }

    if (sort === 'highestConfidence' || sort === 'lowestConfidence') {
      const leftConfidence = getDetectionSortConfidence(left.detection);
      const rightConfidence = getDetectionSortConfidence(right.detection);
      if (leftConfidence !== rightConfidence) {
        return sort === 'highestConfidence' ? rightConfidence - leftConfidence : leftConfidence - rightConfidence;
      }
    }

    const leftUpdated = left.detection.updatedAt ?? left.detection.createdAt ?? '';
    const rightUpdated = right.detection.updatedAt ?? right.detection.createdAt ?? '';
    if (leftUpdated !== rightUpdated) {
      return rightUpdated.localeCompare(leftUpdated);
    }

    return left.detection.id.localeCompare(right.detection.id);
  });

  return sorted;
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
  let detectedFaces;
  try {
    detectedFaces = await engine.detectFaces({ asset, imagePath });
  } catch (error) {
    if (error instanceof PeopleRecognitionEngineError) {
      return {
        assetId,
        processed: false,
        skippedReason: error.message,
        engine: engine.engineName,
        pipelineVersion: config.peoplePipeline.pipelineVersion,
        detectionsCreated: 0,
        detections: await listFaceDetectionsByAssetId(assetId),
        reviews: await listFaceMatchReviewsByAssetId(assetId),
        people: asset.people ?? []
      };
    }

    throw error;
  }

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
      cropPath: null as string | null,
      previewPath: null as string | null,
      detectionConfidence: detectedFace.detectionConfidence ?? null,
      qualityScore: detectedFace.qualityScore ?? null,
      faceAreaPercent: computeFaceAreaPercent(asset, { boundingBox: normalizedBoundingBox }),
      engine: engine.engineName,
      engineVersion: engine.engineVersion,
      pipelineVersion: config.peoplePipeline.pipelineVersion
    };

    const shouldPersistFaceCrop = config.peoplePipeline.storeFaceCrops || engine.prefersFaceCrop;
    let cropImagePath: string | null = null;
    let cropRelativePath: string | null = null;
    if (shouldPersistFaceCrop) {
      const crop = await generateFaceCropForAsset({
        asset,
        imagePath,
        detection: { faceIndex: index, boundingBox: normalizedBoundingBox },
        pipelineVersion: config.peoplePipeline.pipelineVersion,
        forceRegenerate: true
      });
      cropImagePath = crop.absolutePath;
      cropRelativePath = crop.relativePath;
      faceDetectionBase.cropPath = cropRelativePath;
      faceDetectionBase.previewPath = cropRelativePath;
    }

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

    let candidates;
    try {
      candidates = await engine.matchFace({
        asset,
        imagePath,
        cropImagePath,
        detection: { faceIndex: index, boundingBox: normalizedBoundingBox },
        people
      });
    } catch (error) {
      if (error instanceof PeopleRecognitionEngineError) {
        return {
          assetId,
          processed: false,
          skippedReason: error.message,
          engine: engine.engineName,
          pipelineVersion: config.peoplePipeline.pipelineVersion,
          detectionsCreated: 0,
          detections: await listFaceDetectionsByAssetId(assetId),
          reviews: await listFaceMatchReviewsByAssetId(assetId),
          people: asset.people ?? []
        };
      }

      throw error;
    }
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

export async function listPeopleReviewQueue(input?: {
  statuses?: FaceDetection['matchStatus'][];
  assetId?: string;
  limit?: number;
  sort?: PeopleReviewQueueSort;
}): Promise<ListPeopleReviewQueueResponse> {
  const detections = await listFaceDetections({
    ...(input?.assetId ? { mediaAssetId: input.assetId } : {}),
    ...(input?.statuses ? { statuses: input.statuses } : {}),
    ...(input?.limit !== undefined ? { limit: input.limit } : {})
  });
  const [reviews, assets, counts] = await Promise.all([
    listFaceMatchReviewsByDetectionIds(detections.map((item) => item.id)),
    findByIds(Array.from(new Set(detections.map((item) => item.mediaAssetId)))),
    countFaceDetectionsByStatus(input?.assetId ? { mediaAssetId: input.assetId } : undefined)
  ]);

  const reviewsByDetectionId = new Map(reviews.map((review) => [review.faceDetectionId, review]));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const personIds = Array.from(
    new Set(
      detections.flatMap((detection) =>
        [detection.autoMatchCandidatePersonId ?? null, detection.matchedPersonId ?? null].filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      )
    )
  );
  const peopleById = new Map((await findPeopleByIds(personIds)).map((person) => [person.id, person]));

  const items: PeopleReviewQueueItem[] = detections.flatMap((detection) => {
    const asset = assetsById.get(detection.mediaAssetId);
    if (!asset) {
      return [];
    }

    return [
      {
        detection,
        review: reviewsByDetectionId.get(detection.id) ?? null,
        asset: {
          id: asset.id,
          filename: asset.filename,
          originalArchivePath: asset.originalArchivePath,
          captureDateTime: asset.captureDateTime ?? null,
          photoState: asset.photoState,
          people: asset.people ?? []
        },
        suggestedPerson: detection.autoMatchCandidatePersonId
          ? peopleById.get(detection.autoMatchCandidatePersonId) ?? null
          : null,
        matchedPerson: detection.matchedPersonId ? peopleById.get(detection.matchedPersonId) ?? null : null
      }
    ];
  });

  return { items: sortPeopleReviewItems(items, input?.sort ?? 'newest'), counts };
}

export async function getPeoplePipelineSummary(): Promise<PeoplePipelineSummaryResponse> {
  const [detectionCounts, reviewDecisionCounts, people, detections] = await Promise.all([
    countFaceDetectionsByStatus(),
    countFaceMatchReviewsByDecision(),
    listPeople(),
    listFaceDetections({ limit: 5000 })
  ]);
  const reviews = await listFaceMatchReviewsByDetectionIds(detections.map((item) => item.id));

  return {
    config: {
      enabled: config.peoplePipeline.enabled,
      engine: config.peoplePipeline.engine,
      pipelineVersion: config.peoplePipeline.pipelineVersion,
      thresholds: {
        minDetectionConfidence: config.peoplePipeline.minDetectionConfidence,
        minFaceAreaPercent: config.peoplePipeline.minFaceAreaPercent,
        minCropWidthPx: config.peoplePipeline.minCropWidthPx,
        minCropHeightPx: config.peoplePipeline.minCropHeightPx,
        reviewThreshold: config.peoplePipeline.reviewThreshold,
        autoMatchThreshold: config.peoplePipeline.autoMatchThreshold
      },
      engineConfig: {
        ...(config.peoplePipeline.engine === 'rekognition'
          ? {
              region: config.peoplePipeline.rekognition.region,
              collectionId: config.peoplePipeline.rekognition.collectionId,
              maxResults: config.peoplePipeline.rekognition.maxResults,
              faceMatchThreshold: config.peoplePipeline.rekognition.faceMatchThreshold
            }
          : {})
      }
    },
    detectionCounts,
    reviewDecisionCounts,
    totals: {
      peopleCount: people.length,
      detectionsCount: Object.values(detectionCounts).reduce((sum, value) => sum + value, 0),
      reviewsCount: reviews.length
    }
  };
}

export async function enrollPersonFromDetection(input: {
  personId: string;
  detectionId: string;
}): Promise<EnrollPersonFromDetectionResponse> {
  const engine = getPeopleRecognitionEngine();
  if (!engine.supportsEnrollment || !engine.enrollFaceExample) {
    throw new Error(`People engine "${engine.engineName}" does not support enrollment.`);
  }

  const [person, detection] = await Promise.all([
    findPersonById(input.personId),
    findFaceDetectionById(input.detectionId)
  ]);
  if (!person) {
    throw new Error(`Person not found: ${input.personId}`);
  }

  if (!detection) {
    throw new Error(`Face detection not found: ${input.detectionId}`);
  }

  const asset = await findById(detection.mediaAssetId);
  if (!asset) {
    throw new Error(`Media asset not found: ${detection.mediaAssetId}`);
  }

  const imagePath = resolvePipelineImagePath(asset);
  const crop = await generateFaceCropForAsset({
    asset,
    imagePath,
    detection: { faceIndex: detection.faceIndex, boundingBox: detection.boundingBox },
    pipelineVersion: config.peoplePipeline.pipelineVersion,
    forceRegenerate: true
  });

  const enrollment = await engine.enrollFaceExample({
    person,
    asset,
    imagePath,
    cropImagePath: crop.absolutePath,
    detection: {
      id: detection.id,
      faceIndex: detection.faceIndex,
      boundingBox: detection.boundingBox
    }
  });

  const updatedDetection = await updateFaceDetection({
    id: detection.id,
    cropPath: crop.relativePath,
    previewPath: crop.relativePath,
    matchedPersonId: detection.matchedPersonId ?? null,
    matchConfidence: detection.matchConfidence ?? null,
    matchStatus: detection.matchStatus,
    autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId ?? null,
    autoMatchCandidateConfidence: detection.autoMatchCandidateConfidence ?? null,
    ignoredReason: detection.ignoredReason ?? null
  });

  return {
    person,
    detection: updatedDetection ?? { ...detection, cropPath: crop.relativePath, previewPath: crop.relativePath },
    subjectKey: enrollment.subjectKey,
    ...(enrollment.exampleId ? { exampleId: enrollment.exampleId } : {})
  };
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
