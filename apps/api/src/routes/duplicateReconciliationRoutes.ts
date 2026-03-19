import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  DuplicateReconciliationStatus,
  GenerateDuplicateReconciliationsRequest
} from '@tedography/shared';
import { log } from '../logger.js';
import {
  generateDuplicateReconciliations,
  getDuplicateReconciliationForReview,
  listDuplicateReconciliationsForReview
} from '../services/duplicateReconciliationService.js';

const validStatuses = new Set<DuplicateReconciliationStatus>(['auto_applied', 'no_changes']);

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

function parseOptionalStatus(value: unknown): DuplicateReconciliationStatus | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validStatuses.has(value as DuplicateReconciliationStatus)
    ? (value as DuplicateReconciliationStatus)
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

export const duplicateReconciliationRoutes: Router = Router();

duplicateReconciliationRoutes.get('/', async (req, res) => {
  const groupKey = parseOptionalString(req.query.groupKey);
  const assetId = parseOptionalString(req.query.assetId);
  const status = parseOptionalStatus(req.query.status);

  if (groupKey === null || assetId === null) {
    res.status(400).json({ error: 'groupKey and assetId must be strings' } satisfies ImportApiErrorResponse);
    return;
  }

  if (status === null) {
    res.status(400).json({ error: 'status must be all, auto_applied, or no_changes' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await listDuplicateReconciliationsForReview({
      ...(groupKey ? { groupKey } : {}),
      ...(assetId ? { assetId } : {}),
      ...(status ? { status } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to list duplicate reconciliations', error);
    res.status(500).json({ error: 'Failed to list duplicate reconciliations' } satisfies ImportApiErrorResponse);
  }
});

duplicateReconciliationRoutes.post('/generate', async (req, res) => {
  const body = req.body as Partial<GenerateDuplicateReconciliationsRequest> | undefined;
  const onlyMissing = parseOptionalBoolean(body?.onlyMissing === undefined ? undefined : String(body.onlyMissing));

  if (onlyMissing === null) {
    res.status(400).json({ error: 'onlyMissing must be true or false' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const response = await generateDuplicateReconciliations({
      ...(onlyMissing !== undefined ? { onlyMissing } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to generate duplicate reconciliations', error);
    res.status(500).json({ error: 'Failed to generate duplicate reconciliations' } satisfies ImportApiErrorResponse);
  }
});

duplicateReconciliationRoutes.get('/:reconciliationId', async (req, res) => {
  try {
    const response = await getDuplicateReconciliationForReview(req.params.reconciliationId);
    if (!response) {
      res.status(404).json({ error: 'Duplicate reconciliation not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate reconciliation', error);
    res.status(500).json({ error: 'Failed to load duplicate reconciliation' } satisfies ImportApiErrorResponse);
  }
});
