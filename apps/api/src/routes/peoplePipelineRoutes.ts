import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  CreatePersonRequest,
  ProcessPeopleAssetRequest,
  ReviewFaceDetectionRequest
} from '@tedography/shared';
import { createPerson, listPeople } from '../repositories/personRepository.js';
import {
  listAssetFaceDetections,
  processPeoplePipelineForAsset,
  reviewFaceDetection
} from '../people/peoplePipelineService.js';
import { log } from '../logger.js';

export const peoplePipelineRoutes: Router = Router();

peoplePipelineRoutes.get('/people', async (_req, res) => {
  try {
    res.json({ items: await listPeople() });
  } catch (error) {
    log.error('Failed to list people', error);
    res.status(500).json({ error: 'Failed to list people' } satisfies ImportApiErrorResponse);
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

peoplePipelineRoutes.get('/assets/:assetId', async (req, res) => {
  try {
    res.json(await listAssetFaceDetections(req.params.assetId));
  } catch (error) {
    log.error('Failed to load people pipeline asset state', error);
    res.status(500).json({ error: 'Failed to load people pipeline asset state' } satisfies ImportApiErrorResponse);
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
