import fs from 'node:fs/promises';
import { Router } from 'express';
import type { FaceDetectionMatchStatus, ImportApiErrorResponse } from '@tedography/domain';
import type {
  CreatePersonRequest,
  EnrollPersonFromDetectionRequest,
  PeopleReviewQueueSort,
  ProcessPeopleAssetRequest,
  ReviewFaceDetectionRequest
} from '@tedography/shared';
import { createPerson, listPeople } from '../repositories/personRepository.js';
import { findRecentPhotoAssets } from '../repositories/assetRepository.js';
import { resolveDerivedAbsolutePath } from '../import/derivedStorage.js';
import { findFaceDetectionById } from '../repositories/faceDetectionRepository.js';
import { summarizeFaceDetectionsByAssetIds } from '../repositories/faceDetectionRepository.js';
import {
  enrollPersonFromDetection,
  getPeoplePipelineSummary,
  listAssetFaceDetections,
  listPeopleReviewQueue,
  processPeoplePipelineForAsset,
  reviewFaceDetection
} from '../people/peoplePipelineService.js';
import { log } from '../logger.js';

export const peoplePipelineRoutes: Router = Router();

const validDetectionStatuses: FaceDetectionMatchStatus[] = [
  'unmatched',
  'suggested',
  'autoMatched',
  'confirmed',
  'rejected',
  'ignored'
];

peoplePipelineRoutes.get('/people', async (_req, res) => {
  try {
    res.json({ items: await listPeople() });
  } catch (error) {
    log.error('Failed to list people', error);
    res.status(500).json({ error: 'Failed to list people' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.get('/review', async (req, res) => {
  const rawStatuses = typeof req.query.statuses === 'string' ? req.query.statuses : '';
  const statuses = rawStatuses
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is FaceDetectionMatchStatus => validDetectionStatuses.includes(value as FaceDetectionMatchStatus));
  const limit =
    typeof req.query.limit === 'string' && Number.isFinite(Number(req.query.limit))
      ? Math.max(1, Math.min(500, Number(req.query.limit)))
      : undefined;
  const assetId = typeof req.query.assetId === 'string' && req.query.assetId.trim().length > 0 ? req.query.assetId.trim() : undefined;
  const sort: PeopleReviewQueueSort | undefined =
    typeof req.query.sort === 'string' &&
    ['newest', 'highestConfidence', 'lowestConfidence', 'filename', 'assetId'].includes(req.query.sort)
      ? (req.query.sort as PeopleReviewQueueSort)
      : undefined;

  try {
    res.json(
      await listPeopleReviewQueue({
        statuses: statuses.length > 0 ? statuses : ['suggested', 'autoMatched', 'unmatched'],
        ...(assetId ? { assetId } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(sort ? { sort } : {})
      })
    );
  } catch (error) {
    log.error('Failed to list people review queue', error);
    res.status(500).json({ error: 'Failed to list people review queue' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.get('/summary', async (_req, res) => {
  try {
    res.json(await getPeoplePipelineSummary());
  } catch (error) {
    log.error('Failed to load people pipeline summary', error);
    res.status(500).json({ error: 'Failed to load people pipeline summary' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.get('/dev/recent-assets', async (req, res) => {
  const limit =
    typeof req.query.limit === 'string' && Number.isFinite(Number(req.query.limit))
      ? Math.max(1, Math.min(100, Number(req.query.limit)))
      : 20;

  try {
    const assets = await findRecentPhotoAssets(limit);
    const summariesByAssetId = await summarizeFaceDetectionsByAssetIds(assets.map((asset) => asset.id));
    res.json({
      items: assets.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        originalArchivePath: asset.originalArchivePath,
        captureDateTime: asset.captureDateTime ?? null,
        importedAt: asset.importedAt,
        photoState: asset.photoState,
        people: asset.people ?? [],
        detectionsCount: summariesByAssetId[asset.id]?.detectionsCount ?? 0,
        reviewableDetectionsCount: summariesByAssetId[asset.id]?.reviewableDetectionsCount ?? 0,
        confirmedDetectionsCount: summariesByAssetId[asset.id]?.confirmedDetectionsCount ?? 0
      }))
    });
  } catch (error) {
    log.error('Failed to list recent assets for people dev harness', error);
    res.status(500).json({ error: 'Failed to list recent assets for people dev harness' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.post('/people', async (req, res) => {
  const body = req.body as Partial<CreatePersonRequest> | undefined;
  if (typeof body?.displayName !== 'string' || body.displayName.trim().length === 0) {
    res.status(400).json({ error: 'displayName is required' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const item = await createPerson({
      displayName: body.displayName,
      ...(body.sortName !== undefined ? { sortName: body.sortName } : {}),
      ...(body.aliases !== undefined ? { aliases: body.aliases } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {})
    });
    res.json({ item });
  } catch (error) {
    log.error('Failed to create person', error);
    res.status(500).json({ error: 'Failed to create person' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.post('/people/:personId/enroll-from-detection', async (req, res) => {
  const body = req.body as Partial<EnrollPersonFromDetectionRequest> | undefined;
  if (typeof body?.detectionId !== 'string' || body.detectionId.trim().length === 0) {
    res.status(400).json({ error: 'detectionId is required' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    res.json(
      await enrollPersonFromDetection({
        personId: req.params.personId,
        detectionId: body.detectionId.trim()
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enroll person from detection';
    log.error('Failed to enroll person from detection', error);
    res.status(400).json({ error: message } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.get('/assets/:assetId', async (req, res) => {
  try {
    res.json(await listAssetFaceDetections(req.params.assetId));
  } catch (error) {
    log.error('Failed to load people pipeline asset state', error);
    res.status(500).json({ error: 'Failed to load people pipeline asset state' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.get('/detections/:detectionId/preview', async (req, res) => {
  try {
    const detection = await findFaceDetectionById(req.params.detectionId);
    if (!detection) {
      res.status(404).json({ error: 'Face detection not found' } satisfies ImportApiErrorResponse);
      return;
    }

    const relativePath = detection.previewPath ?? detection.cropPath ?? null;
    if (!relativePath) {
      res.status(404).json({ error: 'Face preview not available' } satisfies ImportApiErrorResponse);
      return;
    }

    const absolutePath = resolveDerivedAbsolutePath(relativePath);
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      res.status(404).json({ error: 'Face preview not available' } satisfies ImportApiErrorResponse);
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/jpeg');
    res.sendFile(absolutePath);
  } catch (error) {
    log.error('Failed to serve face preview', error);
    res.status(404).json({ error: 'Face preview not available' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.post('/assets/:assetId/process', async (req, res) => {
  const body = req.body as Partial<ProcessPeopleAssetRequest> | undefined;

  try {
    res.json(await processPeoplePipelineForAsset(req.params.assetId, { force: body?.force === true }));
  } catch (error) {
    log.error('Failed to process people pipeline asset', error);
    res.status(500).json({ error: 'Failed to process people pipeline asset' } satisfies ImportApiErrorResponse);
  }
});

peoplePipelineRoutes.post('/detections/:detectionId/review', async (req, res) => {
  const body = req.body as Partial<ReviewFaceDetectionRequest> | undefined;
  const action = body?.action;

  if (
    action !== 'confirm' &&
    action !== 'reject' &&
    action !== 'assign' &&
    action !== 'createAndAssign' &&
    action !== 'ignore'
  ) {
    res.status(400).json({ error: 'action must be confirm, reject, assign, createAndAssign, or ignore' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const request: ReviewFaceDetectionRequest = {
      action,
      ...(body?.personId !== undefined ? { personId: body.personId } : {}),
      ...(body?.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body?.reviewer !== undefined ? { reviewer: body.reviewer } : {}),
      ...(body?.notes !== undefined ? { notes: body.notes } : {}),
      ...(body?.ignoredReason !== undefined ? { ignoredReason: body.ignoredReason } : {})
    };
    const response = await reviewFaceDetection(req.params.detectionId, {
      ...request
    });
    if (!response) {
      res.status(404).json({ error: 'Face detection not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to review face detection';
    log.error('Failed to review face detection', error);
    res.status(400).json({ error: message } satisfies ImportApiErrorResponse);
  }
});
