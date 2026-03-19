import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  CreateDuplicateActionExecutionRequest,
  DuplicateActionExecutionStatus
} from '@tedography/shared';
import { log } from '../logger.js';
import {
  createDuplicateActionExecutionForPlan,
  DuplicateActionExecutionError,
  getDuplicateActionExecutionForReview,
  listDuplicateActionExecutionsForReview,
  retryDuplicateActionExecution
} from '../services/duplicateActionExecutionService.js';

const validStatuses = new Set<DuplicateActionExecutionStatus>([
  'pending',
  'running',
  'completed',
  'partially_failed',
  'failed'
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

function parseOptionalStatus(value: unknown): DuplicateActionExecutionStatus | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validStatuses.has(value as DuplicateActionExecutionStatus)
    ? (value as DuplicateActionExecutionStatus)
    : null;
}

export const duplicateActionExecutionRoutes: Router = Router();

duplicateActionExecutionRoutes.get('/', async (req, res) => {
  const planId = parseOptionalString(req.query.planId);
  const status = parseOptionalStatus(req.query.status);

  if (planId === null) {
    res.status(400).json({ error: 'planId must be a string' } satisfies ImportApiErrorResponse);
    return;
  }

  if (status === null) {
    res.status(400).json({ error: 'status must be all, pending, running, completed, partially_failed, or failed' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await listDuplicateActionExecutionsForReview({
      ...(planId ? { planId } : {}),
      ...(status ? { status } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to list duplicate action executions', error);
    res.status(500).json({ error: 'Failed to list duplicate action executions' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionExecutionRoutes.post('/', async (req, res) => {
  const body = req.body as Partial<CreateDuplicateActionExecutionRequest> | undefined;
  const planId = parseOptionalString(body?.planId);

  if (!planId) {
    res.status(400).json({ error: 'planId must be a non-empty string' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await createDuplicateActionExecutionForPlan(planId);
    res.json(response);
  } catch (error) {
    if (error instanceof DuplicateActionExecutionError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to create duplicate action execution', error);
    res.status(500).json({ error: 'Failed to create duplicate action execution' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionExecutionRoutes.get('/:executionId', async (req, res) => {
  try {
    const response = await getDuplicateActionExecutionForReview(req.params.executionId);
    if (!response) {
      res.status(404).json({ error: 'Duplicate action execution not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate action execution', error);
    res.status(500).json({ error: 'Failed to load duplicate action execution' } satisfies ImportApiErrorResponse);
  }
});

duplicateActionExecutionRoutes.post('/:executionId/retry', async (req, res) => {
  try {
    const response = await retryDuplicateActionExecution(req.params.executionId);
    if (!response) {
      res.status(404).json({ error: 'Duplicate action execution not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    if (error instanceof DuplicateActionExecutionError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to retry duplicate action execution', error);
    res.status(500).json({ error: 'Failed to retry duplicate action execution' } satisfies ImportApiErrorResponse);
  }
});
