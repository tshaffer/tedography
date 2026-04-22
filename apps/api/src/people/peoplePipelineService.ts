import { randomUUID } from 'node:crypto';
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
  MergePersonResponse,
  ListAssetFaceDetectionsResponse,
  RemovePersonExampleResponse,
  PeoplePipelineSummaryResponse,
  PeopleReviewQueueSort,
  ListPeopleReviewQueueResponse,
  PeopleReviewQueueItem,
  ProcessPeopleAssetResponse,
  SplitPersonResponse,
  ReviewFaceDetectionRequest,
  ReviewFaceDetectionResponse
} from '@tedography/shared';
import { config } from '../config.js';
import { findById, findByIds, updateMediaAssetPeople } from '../repositories/assetRepository.js';
import {
  countFaceDetectionsByStatus,
  findFaceDetectionById,
  listConfirmedFaceDetectionsByPersonId,
  listFaceDetections,
  listFaceDetectionsByAssetId,
  summarizeFaceDetectionsByAssetIds,
  replaceFaceDetectionsForAsset,
  updateFaceDetection
} from '../repositories/faceDetectionRepository.js';
import {
  assignDetectedFaceToPerson,
  replaceFaceDetectionAssignmentsForAsset
} from '../repositories/faceDetectionAssignmentRepository.js';
import { listFaceMatchReviewsByDetectionIds, listFaceMatchReviewsByAssetId, countFaceMatchReviewsByDecision, replaceFaceMatchReviewsForAsset, upsertFaceMatchReview } from '../repositories/faceMatchReviewRepository.js';
import { createPerson, findPeopleByIds, findPersonById, listPeople, updatePerson } from '../repositories/personRepository.js';
import {
  createPersonFaceExample,
  findActivePersonFaceExampleByPersonAndDetection,
  findPersonFaceExampleById,
  listActivePersonFaceExamplesByDetectionId,
  listActivePersonFaceExamplesByPersonId,
  markPersonFaceExampleRemoved
} from '../repositories/personFaceExampleRepository.js';
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

async function syncDetectedFaceAssignment(input: {
  detection: FaceDetection;
  personId: string | null;
  assignmentSource: 'auto-match' | 'manual-confirm' | 'manual-reject' | 'manual-merge-adjustment';
  assignmentStatus: 'suggested' | 'confirmed' | 'rejected' | 'ignored';
  matchConfidence?: number | null;
}): Promise<void> {
  if (!input.personId) {
    return;
  }

  await assignDetectedFaceToPerson({
    detectedFaceId: input.detection.id,
    mediaAssetId: input.detection.mediaAssetId,
    personId: input.personId,
    assignmentSource: input.assignmentSource,
    assignmentStatus: input.assignmentStatus,
    matchConfidence: input.matchConfidence ?? null
  });
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
  const detectionRunId = randomUUID();

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
      detectionProvider: detectedFace.detectionProvider ?? null,
      detectionModelVersion: detectedFace.detectionModelVersion ?? null,
      landmarks: detectedFace.landmarks ?? [],
      ageRangeLow: detectedFace.ageRangeLow ?? null,
      ageRangeHigh: detectedFace.ageRangeHigh ?? null,
      estimatedAgeMidpoint: detectedFace.estimatedAgeMidpoint ?? null,
      sharpness: detectedFace.sharpness ?? null,
      brightness: detectedFace.brightness ?? null,
      pose: detectedFace.pose ?? null,
      sourceImageVariant: detectedFace.sourceImageVariant ?? 'original',
      detectionRunId,
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
  await replaceFaceDetectionAssignmentsForAsset({
    mediaAssetId: asset.id,
    assignments: detections.flatMap((detection) => {
      if (
        (detection.matchStatus !== 'suggested' && detection.matchStatus !== 'autoMatched') ||
        typeof detection.autoMatchCandidatePersonId !== 'string'
      ) {
        return [];
      }

      return [
        {
          detectedFaceId: detection.id,
          mediaAssetId: detection.mediaAssetId,
          personId: detection.autoMatchCandidatePersonId,
          assignmentSource: 'auto-match' as const,
          assignmentStatus: 'suggested' as const,
          matchConfidence: detection.autoMatchCandidateConfidence ?? null
        }
      ];
    })
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
  assetIds?: string[];
  personId?: string;
  limit?: number;
  sort?: PeopleReviewQueueSort;
}): Promise<ListPeopleReviewQueueResponse> {
  const assetIds =
    input?.assetIds && input.assetIds.length > 0
      ? [...new Set(input.assetIds.map((assetId) => assetId.trim()).filter(Boolean))]
      : [];
  const detections = await listFaceDetections({
    ...(input?.assetId ? { mediaAssetId: input.assetId } : assetIds.length > 0 ? { mediaAssetIds: assetIds } : {}),
    ...(input?.personId ? { personId: input.personId } : {}),
    ...(input?.statuses ? { statuses: input.statuses } : {}),
    ...(input?.limit !== undefined ? { limit: input.limit } : {})
  });
  const [reviews, assets, counts] = await Promise.all([
    listFaceMatchReviewsByDetectionIds(detections.map((item) => item.id)),
    findByIds(Array.from(new Set(detections.map((item) => item.mediaAssetId)))),
    countFaceDetectionsByStatus(
      input?.assetId
        ? { mediaAssetId: input.assetId, ...(input?.personId ? { personId: input.personId } : {}) }
        : assetIds.length > 0
          ? { mediaAssetIds: assetIds, ...(input?.personId ? { personId: input.personId } : {}) }
        : input?.personId
          ? { personId: input.personId }
          : undefined
    )
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

export async function getPeopleScopedAssetSummary(input: {
  assetIds: string[];
}): Promise<{
  totalAssets: number;
  assetsWithConfirmedPeople: number;
  assetsWithoutConfirmedPeople: number;
  assetsWithReviewableFaces: number;
  totalReviewableDetections: number;
}> {
  const assetIds = [...new Set(input.assetIds.map((assetId) => assetId.trim()).filter(Boolean))];
  if (assetIds.length === 0) {
    return {
      totalAssets: 0,
      assetsWithConfirmedPeople: 0,
      assetsWithoutConfirmedPeople: 0,
      assetsWithReviewableFaces: 0,
      totalReviewableDetections: 0
    };
  }

  const [assets, summariesByAssetId] = await Promise.all([
    findByIds(assetIds),
    summarizeFaceDetectionsByAssetIds(assetIds)
  ]);

  let assetsWithConfirmedPeople = 0;
  let assetsWithoutConfirmedPeople = 0;
  let assetsWithReviewableFaces = 0;
  let totalReviewableDetections = 0;

  for (const asset of assets) {
    if ((asset.people ?? []).length > 0) {
      assetsWithConfirmedPeople += 1;
    } else {
      assetsWithoutConfirmedPeople += 1;
    }

    const summary = summariesByAssetId[asset.id];
    const reviewableDetectionsCount = summary?.reviewableDetectionsCount ?? 0;
    if (reviewableDetectionsCount > 0) {
      assetsWithReviewableFaces += 1;
      totalReviewableDetections += reviewableDetectionsCount;
    }
  }

  return {
    totalAssets: assets.length,
    assetsWithConfirmedPeople,
    assetsWithoutConfirmedPeople,
    assetsWithReviewableFaces,
    totalReviewableDetections
  };
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

  const existingExample = await findActivePersonFaceExampleByPersonAndDetection({
    personId: input.personId,
    faceDetectionId: input.detectionId
  });
  if (existingExample) {
    return {
      person,
      detection,
      example: existingExample,
      subjectKey: existingExample.subjectKey ?? '',
      ...(existingExample.engineExampleId ? { exampleId: existingExample.engineExampleId } : {})
    };
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

  const example = await createPersonFaceExample({
    personId: person.id,
    faceDetectionId: detection.id,
    mediaAssetId: detection.mediaAssetId,
    engine: engine.engineName,
    subjectKey: enrollment.subjectKey,
    engineExampleId: enrollment.exampleId ?? null
  });

  return {
    person,
    detection: updatedDetection ?? { ...detection, cropPath: crop.relativePath, previewPath: crop.relativePath },
    example,
    subjectKey: enrollment.subjectKey,
    ...(enrollment.exampleId ? { exampleId: enrollment.exampleId } : {})
  };
}

async function removeActiveExampleRecord(example: {
  id: string;
  personId: string;
  engineExampleId?: string | null;
  subjectKey?: string | null;
  status: string;
}): Promise<void> {
  if (example.status === 'removed') {
    return;
  }

  const engine = getPeopleRecognitionEngine();
  const person = await findPersonById(example.personId);

  if (
    person &&
    example.engineExampleId &&
    engine.supportsEnrollmentExampleRemoval &&
    engine.removeEnrolledFaceExample
  ) {
    await engine.removeEnrolledFaceExample({
      person,
      exampleId: example.engineExampleId,
      subjectKey: example.subjectKey ?? null
    });
  }

  const removed = await markPersonFaceExampleRemoved(example.id);
  if (!removed) {
    throw new Error(`Failed to remove example: ${example.id}`);
  }
}

async function removeExamplesForDetectionPersonMismatch(input: {
  detectionId: string;
  nextMatchedPersonId: string | null;
}): Promise<void> {
  const activeExamples = await listActivePersonFaceExamplesByDetectionId(input.detectionId);
  const staleExamples = activeExamples.filter((example) => example.personId !== input.nextMatchedPersonId);

  for (const example of staleExamples) {
    await removeActiveExampleRecord(example);
  }
}

export async function removePersonFaceExample(input: {
  personId: string;
  exampleId: string;
}): Promise<RemovePersonExampleResponse> {
  const engine = getPeopleRecognitionEngine();
  const [person, example] = await Promise.all([
    findPersonById(input.personId),
    findPersonFaceExampleById(input.exampleId)
  ]);

  if (!person) {
    throw new Error(`Person not found: ${input.personId}`);
  }

  if (!example || example.personId !== input.personId) {
    throw new Error(`Person face example not found: ${input.exampleId}`);
  }

  if (example.status === 'removed') {
    return { item: example };
  }

  if (example.engineExampleId && engine.supportsEnrollmentExampleRemoval && engine.removeEnrolledFaceExample) {
    await engine.removeEnrolledFaceExample({
      person,
      exampleId: example.engineExampleId,
      subjectKey: example.subjectKey ?? null
    });
  }

  const item = await markPersonFaceExampleRemoved(example.id);
  if (!item) {
    throw new Error(`Failed to remove example: ${example.id}`);
  }

  return { item };
}

export async function mergePersonIntoTarget(input: {
  sourcePersonId: string;
  targetPersonId: string;
}): Promise<MergePersonResponse> {
  if (input.sourcePersonId === input.targetPersonId) {
    throw new Error('Source and target person must be different.');
  }

  const [sourcePerson, targetPerson] = await Promise.all([
    findPersonById(input.sourcePersonId),
    findPersonById(input.targetPersonId)
  ]);

  if (!sourcePerson) {
    throw new Error(`Source person not found: ${input.sourcePersonId}`);
  }

  if (!targetPerson) {
    throw new Error(`Target person not found: ${input.targetPersonId}`);
  }

  const [sourceDetections, sourceExamples] = await Promise.all([
    listConfirmedFaceDetectionsByPersonId(sourcePerson.id),
    listActivePersonFaceExamplesByPersonId(sourcePerson.id)
  ]);

  const exampleByDetectionId = new Map(sourceExamples.map((example) => [example.faceDetectionId, example]));
  let movedExampleCount = 0;

  for (const example of sourceExamples) {
    const targetExisting = await findActivePersonFaceExampleByPersonAndDetection({
      personId: targetPerson.id,
      faceDetectionId: example.faceDetectionId
    });

    if (!targetExisting) {
      await enrollPersonFromDetection({
        personId: targetPerson.id,
        detectionId: example.faceDetectionId
      });
      movedExampleCount += 1;
    }

    await removeActiveExampleRecord(example);
  }

  const affectedAssetIds = new Set<string>();
  let movedConfirmedDetectionsCount = 0;

  for (const detection of sourceDetections) {
    affectedAssetIds.add(detection.mediaAssetId);
    if (exampleByDetectionId.has(detection.id)) {
      const updated = await updateFaceDetection({
        id: detection.id,
        cropPath: detection.cropPath ?? null,
        previewPath: detection.previewPath ?? null,
        matchedPersonId: targetPerson.id,
        matchConfidence: detection.matchConfidence ?? null,
        matchStatus: 'confirmed',
        autoMatchCandidatePersonId: detection.autoMatchCandidatePersonId ?? null,
        autoMatchCandidateConfidence: detection.autoMatchCandidateConfidence ?? null,
        ignoredReason: detection.ignoredReason ?? null
      });

      if (!updated) {
        throw new Error(`Failed to update face detection during merge: ${detection.id}`);
      }

      await upsertFaceMatchReview({
        faceDetectionId: detection.id,
        mediaAssetId: detection.mediaAssetId,
        suggestedPersonId: detection.autoMatchCandidatePersonId ?? null,
        suggestedConfidence: detection.autoMatchCandidateConfidence ?? null,
        finalPersonId: targetPerson.id,
        decision: determineConfirmedReviewDecision(detection, targetPerson.id),
        reviewer: 'merge',
        notes: `Merged from ${sourcePerson.displayName} into ${targetPerson.displayName}.`,
        ignoredReason: null
      });
      await syncDetectedFaceAssignment({
        detection,
        personId: targetPerson.id,
        assignmentSource: 'manual-merge-adjustment',
        assignmentStatus: 'confirmed',
        matchConfidence: detection.matchConfidence ?? null
      });
    } else {
      await reviewFaceDetection(detection.id, {
        action: 'assign',
        personId: targetPerson.id,
        reviewer: 'merge',
        notes: `Merged from ${sourcePerson.displayName} into ${targetPerson.displayName}.`
      });
    }

    movedConfirmedDetectionsCount += 1;
  }

  for (const assetId of affectedAssetIds) {
    await recomputeMediaAssetPeople(assetId);
  }

  await updatePerson({
    id: sourcePerson.id,
    isHidden: true,
    isArchived: true
  });

  const refreshedSource = await findPersonById(sourcePerson.id);
  const refreshedTarget = await findPersonById(targetPerson.id);

  if (!refreshedSource || !refreshedTarget) {
    throw new Error('Failed to reload people after merge.');
  }

  return {
    sourcePerson: refreshedSource,
    targetPerson: refreshedTarget,
    movedConfirmedDetectionsCount,
    movedExampleCount,
    affectedAssetCount: affectedAssetIds.size
  };
}

export async function splitPersonFromConfirmedFaces(input: {
  sourcePersonId: string;
  detectionIds: string[];
  targetPersonId?: string;
  newDisplayName?: string;
}): Promise<SplitPersonResponse> {
  const detectionIds = Array.from(new Set(input.detectionIds.map((id) => id.trim()).filter(Boolean)));
  if (detectionIds.length === 0) {
    throw new Error('At least one confirmed face must be selected to split.');
  }

  const sourcePerson = await findPersonById(input.sourcePersonId);
  if (!sourcePerson) {
    throw new Error(`Source person not found: ${input.sourcePersonId}`);
  }

  if (input.targetPersonId && input.newDisplayName) {
    throw new Error('Choose either an existing target person or a new display name, not both.');
  }

  let targetPerson: Person | null = null;
  let createdTargetPerson = false;

  if (typeof input.targetPersonId === 'string' && input.targetPersonId.trim().length > 0) {
    if (input.targetPersonId === input.sourcePersonId) {
      throw new Error('Source and target person must be different.');
    }
    targetPerson = await findPersonById(input.targetPersonId.trim());
    if (!targetPerson) {
      throw new Error(`Target person not found: ${input.targetPersonId}`);
    }
  } else if (typeof input.newDisplayName === 'string' && input.newDisplayName.trim().length > 0) {
    targetPerson = await createPerson({ displayName: input.newDisplayName.trim() });
    createdTargetPerson = true;
  } else {
    throw new Error('Choose an existing target person or provide a new person name.');
  }

  const detections = await Promise.all(detectionIds.map((id) => findFaceDetectionById(id)));
  const selectedDetections = detections.filter((item): item is FaceDetection => Boolean(item));

  if (selectedDetections.length !== detectionIds.length) {
    throw new Error('One or more selected face detections were not found.');
  }

  const invalidDetection = selectedDetections.find(
    (detection) => detection.matchStatus !== 'confirmed' || detection.matchedPersonId !== sourcePerson.id
  );
  if (invalidDetection) {
    throw new Error('Selected faces must all be confirmed detections currently assigned to the source person.');
  }

  const sourceExamples = await listActivePersonFaceExamplesByPersonId(sourcePerson.id);
  const sourceExamplesByDetectionId = new Map(sourceExamples.map((example) => [example.faceDetectionId, example]));
  const affectedAssetIds = new Set<string>();
  let movedExampleCount = 0;

  for (const detection of selectedDetections) {
    affectedAssetIds.add(detection.mediaAssetId);
    const sourceExample = sourceExamplesByDetectionId.get(detection.id) ?? null;

    if (sourceExample) {
      const targetExisting = await findActivePersonFaceExampleByPersonAndDetection({
        personId: targetPerson.id,
        faceDetectionId: detection.id
      });

      if (!targetExisting) {
        await enrollPersonFromDetection({
          personId: targetPerson.id,
          detectionId: detection.id
        });
        movedExampleCount += 1;
      }

      await removeActiveExampleRecord(sourceExample);
    }

    await reviewFaceDetection(detection.id, {
      action: 'assign',
      personId: targetPerson.id,
      reviewer: 'split',
      notes: `Split from ${sourcePerson.displayName} to ${targetPerson.displayName}.`
    });
  }

  const refreshedSource = await findPersonById(sourcePerson.id);
  const refreshedTarget = await findPersonById(targetPerson.id);
  if (!refreshedSource || !refreshedTarget) {
    throw new Error('Failed to reload people after split.');
  }

  return {
    sourcePerson: refreshedSource,
    targetPerson: refreshedTarget,
    movedConfirmedDetectionsCount: selectedDetections.length,
    movedExampleCount,
    affectedAssetCount: affectedAssetIds.size,
    createdTargetPerson
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

  const assignmentSource =
    request.reviewer === 'merge' || request.reviewer === 'split'
      ? 'manual-merge-adjustment'
      : request.action === 'reject' || request.action === 'ignore'
        ? 'manual-reject'
        : 'manual-confirm';
  const assignmentPersonId =
    finalPerson?.id ??
    detection.autoMatchCandidatePersonId ??
    detection.matchedPersonId ??
    null;
  const assignmentStatus =
    nextStatus === 'confirmed'
      ? 'confirmed'
      : nextStatus === 'ignored'
        ? 'ignored'
        : nextStatus === 'rejected'
          ? 'rejected'
          : 'suggested';
  await syncDetectedFaceAssignment({
    detection: updatedDetection,
    personId: assignmentPersonId,
    assignmentSource,
    assignmentStatus,
    matchConfidence:
      nextStatus === 'confirmed'
        ? updatedDetection.matchConfidence ?? detection.autoMatchCandidateConfidence ?? null
        : detection.autoMatchCandidateConfidence ?? detection.matchConfidence ?? null
  });

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

  await removeExamplesForDetectionPersonMismatch({
    detectionId: detection.id,
    nextMatchedPersonId: nextStatus === 'confirmed' ? finalPerson?.id ?? null : null
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
