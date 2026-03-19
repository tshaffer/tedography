import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  DuplicateActionPlanStatus,
  DuplicateActionType,
  GenerateDuplicateActionPlansRequest,
  UpdateDuplicateActionPlanRequest
} from '@tedography/shared';
import { log } from '../logger.js';
import {
  exportDuplicateActionPlans,
  generateDuplicateActionPlans,
  getDuplicateActionPlanForReview,
  listDuplicateActionPlansForReview,
  updateDuplicateActionPlanForReview
} from '../services/duplicateActionPlanService.js';

const validPlanStatuses = new Set<DuplicateActionPlanStatus>([
  'proposed',
  'needs_manual_review',
  'approved',
  'rejected'
]);
const validActionTypes = new Set<DuplicateActionType>([
  'KEEP_CANONICAL',
  'PROPOSE_ARCHIVE_SECONDARY',
  'NEEDS_MANUAL_REVIEW'
]);

function parseOptionalString(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalPlanStatus(value: unknown): DuplicateActionPlanStatus | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validPlanStatuses.has(value as DuplicateActionPlanStatus)
    ? (value as DuplicateActionPlanStatus)
    : null;
}

function parseOptionalActionType(value: unknown): DuplicateActionType | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validActionTypes.has(value as DuplicateActionType)
    ? (value as DuplicateActionType)
    : null;
}

function parseOptionalBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

export const duplicateActionPlanRoutes: Router = Router();

duplicateActionPlanRoutes.get('/', async (req, res) => {
  const planStatus = parseOptionalPlanStatus(req.query.planStatus);
  const primaryActionType = parseOptionalActionType(req.query.primaryActionType);
  const assetId = parseOptionalString(req.query.assetId);

  if (planStatus === null) {
    res.status(400).json({ error: 'planStatus must be all, proposed, needs_manual_review, approved, or rejected' } satisfies ImportApiErrorResponse);
    return;
  }

  if (primaryActionType === null) {
    res.status(400).json({ error: 'primaryActionType must be all, KEEP_CANONICAL, PROPOSE_ARCHIVE_SECONDARY, or NEEDS_MANUAL_REVIEW' } satisfies ImportApiErrorResponse);
    return;
  }

  if (assetId === null) {
    res.status(400).json({ error: 'assetId must be a string' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await listDuplicateActionPlansForReview({
      ...(planStatus ? { planStatus } : {}),
      ...(primaryActionType ? { primaryActionType } : {}),
      ...(assetId ? { assetId } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to list duplicate action plans', error);
    res.status(500).json({ error: 'Failed to list duplicate action plans' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionPlanRoutes.post('/generate', async (req, res) => {
  const body = req.body as Partial<GenerateDuplicateActionPlansRequest> | undefined;
  const onlyMissing = parseOptionalBoolean(body?.onlyMissing === undefined ? undefined : String(body.onlyMissing));

  if (onlyMissing === null) {
    res.status(400).json({ error: 'onlyMissing must be true or false' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await generateDuplicateActionPlans({
      ...(onlyMissing !== undefined ? { onlyMissing } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to generate duplicate action plans', error);
    res.status(500).json({ error: 'Failed to generate duplicate action plans' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionPlanRoutes.get('/export', async (req, res) => {
  const planStatus = parseOptionalPlanStatus(req.query.planStatus);
  const primaryActionType = parseOptionalActionType(req.query.primaryActionType);
  const assetId = parseOptionalString(req.query.assetId);

  if (planStatus === null || primaryActionType === null || assetId === null) {
    res.status(400).json({ error: 'Invalid duplicate action plan export filters' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await exportDuplicateActionPlans({
      ...(planStatus ? { planStatus } : {}),
      ...(primaryActionType ? { primaryActionType } : {}),
      ...(assetId ? { assetId } : {})
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="duplicate-action-plans.json"');
    res.json(response);
  } catch (error) {
    log.error('Failed to export duplicate action plans', error);
    res.status(500).json({ error: 'Failed to export duplicate action plans' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionPlanRoutes.get('/:planId', async (req, res) => {
  try {
    const response = await getDuplicateActionPlanForReview(req.params.planId);
    if (!response) {
      res.status(404).json({ error: 'Duplicate action plan not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate action plan', error);
    res.status(500).json({ error: 'Failed to load duplicate action plan' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionPlanRoutes.patch('/:planId', async (req, res) => {
  const body = req.body as Partial<UpdateDuplicateActionPlanRequest> | undefined;

  if (!body?.planStatus || !validPlanStatuses.has(body.planStatus)) {
    res.status(400).json({ error: 'planStatus must be proposed, needs_manual_review, approved, or rejected' } satisfies ImportApiErrorResponse);
    return;
  }

  if (body.reviewNote !== undefined && typeof body.reviewNote !== 'string') {
    res.status(400).json({ error: 'reviewNote must be a string' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await updateDuplicateActionPlanForReview(req.params.planId, {
      planStatus: body.planStatus,
      ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote } : {})
    });
    if (!response) {
      res.status(404).json({ error: 'Duplicate action plan not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Blocked plans cannot be approved')) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to update duplicate action plan', error);
    res.status(500).json({ error: 'Failed to update duplicate action plan' } satisfies ImportApiErrorResponse);
  }
});
