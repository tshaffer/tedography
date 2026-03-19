import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  BulkReviewDuplicateCandidatePairsRequest,
  BulkUpdateDuplicateGroupsRequest,
  DuplicateCandidateClassification,
  DuplicateCandidateOutcomeFilter,
  DuplicateCandidateReviewDecision,
  DuplicateGroupResolutionStatus,
  DuplicateGroupSortMode,
  DuplicateCandidateStatus,
  UpdateDuplicateGroupResolutionRequest,
  UpdateDuplicateCandidatePairReviewRequest
} from '@tedography/shared';
import {
  bulkReviewDuplicateCandidatePairs,
  getDuplicateCandidatePairForReview,
  getDuplicateCandidatePairQueueSummary,
  listDuplicateCandidatePairsForReview,
  reviewDuplicateCandidatePair
} from '../services/duplicateCandidatePairService.js';
import {
  bulkConfirmDerivedDuplicateGroupProposals,
  getDerivedDuplicateGroup,
  listDerivedDuplicateGroups,
  updateDerivedDuplicateGroupResolution
} from '../services/duplicateGroupService.js';
import { log } from '../logger.js';

const validStatuses = new Set<DuplicateCandidateStatus>(['unreviewed', 'ignored', 'reviewed']);
const validClassifications = new Set<DuplicateCandidateClassification>([
  'very_likely_duplicate',
  'possible_duplicate',
  'similar_image'
]);
const validDecisions = new Set<DuplicateCandidateReviewDecision>([
  'confirmed_duplicate',
  'not_duplicate',
  'ignored'
]);
const validOutcomeFilters = new Set<DuplicateCandidateOutcomeFilter>([
  'confirmed_duplicate',
  'not_duplicate',
  'ignored',
  'none'
]);
const validGroupResolutionStatuses = new Set<DuplicateGroupResolutionStatus>(['proposed', 'confirmed']);
const validGroupSortModes = new Set<DuplicateGroupSortMode>([
  'unresolved_first',
  'size_asc',
  'size_desc'
]);

function parseOptionalStatus(value: unknown): DuplicateCandidateStatus | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validStatuses.has(value as DuplicateCandidateStatus)
    ? (value as DuplicateCandidateStatus)
    : null;
}

function parseOptionalClassification(
  value: unknown
): DuplicateCandidateClassification | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return validClassifications.has(value as DuplicateCandidateClassification)
    ? (value as DuplicateCandidateClassification)
    : null;
}

function parseOptionalOutcome(value: unknown): DuplicateCandidateOutcomeFilter | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validOutcomeFilters.has(value as DuplicateCandidateOutcomeFilter)
    ? (value as DuplicateCandidateOutcomeFilter)
    : null;
}

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

function parseOptionalInteger(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseOptionalNumber(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalGroupResolutionStatus(
  value: unknown
): DuplicateGroupResolutionStatus | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'all') {
    return undefined;
  }

  return validGroupResolutionStatuses.has(value as DuplicateGroupResolutionStatus)
    ? (value as DuplicateGroupResolutionStatus)
    : null;
}

function parseOptionalGroupSortMode(value: unknown): DuplicateGroupSortMode | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  return validGroupSortModes.has(value as DuplicateGroupSortMode)
    ? (value as DuplicateGroupSortMode)
    : null;
}

export const duplicateCandidatePairRoutes: Router = Router();

duplicateCandidatePairRoutes.get('/', async (req, res) => {
  const status = parseOptionalStatus(req.query.status);
  const classification = parseOptionalClassification(req.query.classification);
  const outcome = parseOptionalOutcome(req.query.outcome);
  const assetId = parseOptionalString(req.query.assetId);
  const limit = parseOptionalInteger(req.query.limit);
  const offset = parseOptionalInteger(req.query.offset);
  const minScore = parseOptionalNumber(req.query.minScore);

  if (status === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'status must be all, unreviewed, ignored, or reviewed' };
    res.status(400).json(errorResponse);
    return;
  }

  if (classification === null) {
    const errorResponse: ImportApiErrorResponse = {
      error: 'classification must be very_likely_duplicate, possible_duplicate, or similar_image'
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (assetId === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId must be a string' };
    res.status(400).json(errorResponse);
    return;
  }

  if (outcome === null) {
    const errorResponse: ImportApiErrorResponse = {
      error: 'outcome must be all, none, confirmed_duplicate, not_duplicate, or ignored'
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (limit === null || offset === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'limit and offset must be integers' };
    res.status(400).json(errorResponse);
    return;
  }

  if (minScore === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'minScore must be a number' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await listDuplicateCandidatePairsForReview({
      ...(status ? { status } : {}),
      ...(classification ? { classification } : {}),
      ...(outcome ? { outcome } : {}),
      ...(assetId ? { assetId } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
      ...(minScore !== undefined ? { minScore } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to list duplicate candidate pairs', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to load duplicate candidate pairs' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.get('/summary', async (req, res) => {
  const assetId = parseOptionalString(req.query.assetId);
  const minScore = parseOptionalNumber(req.query.minScore);

  if (assetId === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId must be a string' };
    res.status(400).json(errorResponse);
    return;
  }

  if (minScore === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'minScore must be a number' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await getDuplicateCandidatePairQueueSummary({
      ...(assetId ? { assetId } : {}),
      ...(minScore !== undefined ? { minScore } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate candidate pair summary', error);
    const errorResponse: ImportApiErrorResponse = {
      error: 'Failed to load duplicate candidate pair summary'
    };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.get('/groups', async (req, res) => {
  const assetId = parseOptionalString(req.query.assetId);
  const resolutionStatus = parseOptionalGroupResolutionStatus(req.query.resolutionStatus);
  const exactAssetCount = parseOptionalInteger(req.query.exactAssetCount);
  const minAssetCount = parseOptionalInteger(req.query.minAssetCount);
  const readyToConfirmOnly = parseOptionalBoolean(req.query.readyToConfirmOnly);
  const sort = parseOptionalGroupSortMode(req.query.sort);

  if (assetId === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'assetId must be a string' };
    res.status(400).json(errorResponse);
    return;
  }

  if (resolutionStatus === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'resolutionStatus must be all, proposed, or confirmed' };
    res.status(400).json(errorResponse);
    return;
  }

  if (exactAssetCount === null || minAssetCount === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'exactAssetCount and minAssetCount must be integers' };
    res.status(400).json(errorResponse);
    return;
  }

  if (readyToConfirmOnly === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'readyToConfirmOnly must be true or false' };
    res.status(400).json(errorResponse);
    return;
  }

  if (sort === null) {
    const errorResponse: ImportApiErrorResponse = { error: 'sort must be unresolved_first, size_asc, or size_desc' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await listDerivedDuplicateGroups({
      ...(assetId ? { assetId } : {}),
      ...(resolutionStatus ? { resolutionStatus } : {}),
      ...(exactAssetCount !== undefined ? { exactAssetCount } : {}),
      ...(minAssetCount !== undefined ? { minAssetCount } : {}),
      ...(readyToConfirmOnly !== undefined ? { readyToConfirmOnly } : {}),
      ...(sort ? { sort } : {})
    });
    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate groups', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to load duplicate groups' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.post('/groups/bulk', async (req, res) => {
  const body = req.body as Partial<BulkUpdateDuplicateGroupsRequest> | undefined;

  if (body?.action !== 'confirm_proposals') {
    const errorResponse: ImportApiErrorResponse = { error: 'action must be confirm_proposals' };
    res.status(400).json(errorResponse);
    return;
  }

  if (!Array.isArray(body.groupKeys) || body.groupKeys.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    const errorResponse: ImportApiErrorResponse = { error: 'groupKeys must be a non-empty array of strings' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await bulkConfirmDerivedDuplicateGroupProposals(body.groupKeys);
    res.json(response);
  } catch (error) {
    log.error('Failed to bulk update duplicate groups', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to bulk update duplicate groups' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.get('/groups/:groupKey', async (req, res) => {
  try {
    const response = await getDerivedDuplicateGroup(req.params.groupKey);
    if (!response) {
      const errorResponse: ImportApiErrorResponse = { error: 'Duplicate group not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate group', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to load duplicate group' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.patch('/groups/:groupKey', async (req, res) => {
  const body = req.body as Partial<UpdateDuplicateGroupResolutionRequest> | undefined;

  if (
    body?.canonicalAssetId !== undefined &&
    (typeof body.canonicalAssetId !== 'string' || body.canonicalAssetId.trim().length === 0)
  ) {
    const errorResponse: ImportApiErrorResponse = { error: 'canonicalAssetId must be a non-empty string' };
    res.status(400).json(errorResponse);
    return;
  }

  if (
    body?.resolutionStatus !== undefined &&
    body.resolutionStatus !== 'proposed' &&
    body.resolutionStatus !== 'confirmed'
  ) {
    const errorResponse: ImportApiErrorResponse = {
      error: 'resolutionStatus must be proposed or confirmed'
    };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await updateDerivedDuplicateGroupResolution(req.params.groupKey, {
      ...(body?.canonicalAssetId ? { canonicalAssetId: body.canonicalAssetId.trim() } : {}),
      ...(body?.resolutionStatus ? { resolutionStatus: body.resolutionStatus } : {})
    });
    if (!response) {
      const errorResponse: ImportApiErrorResponse = { error: 'Duplicate group not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('is not part of duplicate group')) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };
      res.status(400).json(errorResponse);
      return;
    }

    log.error('Failed to update duplicate group resolution', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to update duplicate group resolution' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.post('/bulk-review', async (req, res) => {
  const body = req.body as Partial<BulkReviewDuplicateCandidatePairsRequest> | undefined;

  if (!Array.isArray(body?.pairKeys) || body.pairKeys.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    const errorResponse: ImportApiErrorResponse = { error: 'pairKeys must be a non-empty array of strings' };
    res.status(400).json(errorResponse);
    return;
  }

  if (!body.decision || !validDecisions.has(body.decision)) {
    const errorResponse: ImportApiErrorResponse = {
      error: 'decision must be confirmed_duplicate, not_duplicate, or ignored'
    };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await bulkReviewDuplicateCandidatePairs(body.pairKeys, body.decision);
    res.json(response);
  } catch (error) {
    log.error('Failed to bulk update duplicate candidate pairs', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to bulk update duplicate candidate pairs' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.get('/:pairKey', async (req, res) => {
  try {
    const response = await getDuplicateCandidatePairForReview(req.params.pairKey);
    if (!response) {
      const errorResponse: ImportApiErrorResponse = { error: 'Duplicate candidate pair not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load duplicate candidate pair', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to load duplicate candidate pair' };
    res.status(500).json(errorResponse);
  }
});

duplicateCandidatePairRoutes.patch('/:pairKey', async (req, res) => {
  const body = req.body as Partial<UpdateDuplicateCandidatePairReviewRequest> | undefined;
  const decision = body?.decision;

  if (typeof decision !== 'string' || !validDecisions.has(decision)) {
    const errorResponse: ImportApiErrorResponse = {
      error: 'decision must be confirmed_duplicate, not_duplicate, or ignored'
    };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await reviewDuplicateCandidatePair(req.params.pairKey, decision);
    if (!response) {
      const errorResponse: ImportApiErrorResponse = { error: 'Duplicate candidate pair not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to update duplicate candidate pair review', error);
    const errorResponse: ImportApiErrorResponse = {
      error: 'Failed to update duplicate candidate pair review'
    };
    res.status(500).json(errorResponse);
  }
});
