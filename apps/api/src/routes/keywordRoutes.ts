import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  CreateKeywordRequest,
  CreateKeywordResponse,
  ListAssetKeywordsResponse,
  ListKeywordAssetsResponse,
  ListKeywordsResponse,
  ListKeywordTreeResponse,
  UpdateKeywordLabelRequest,
  UpdateKeywordLabelResponse,
  UpdateKeywordParentRequest,
  UpdateKeywordParentResponse,
  UpdateAssetKeywordsRequest,
  UpdateAssetKeywordsResponse
} from '@tedography/shared';
import { log } from '../logger.js';
import {
  addKeywordsToAssets,
  findByIds,
  listAssetsByKeyword,
  removeKeywordsFromAssets
} from '../repositories/assetRepository.js';
import {
  createKeyword,
  findKeywordsByIds,
  getKeywordById,
  KeywordHierarchyCycleError,
  KeywordLabelConflictError,
  KeywordNotFoundError,
  KeywordParentNotFoundError,
  KeywordSelfParentError,
  listKeywordsForAsset,
  listKeywords,
  listKeywordsAsTree,
  updateKeywordLabel,
  updateKeywordParent
} from '../repositories/keywordRepository.js';

export const keywordRoutes: Router = Router();

function parseNonEmptyLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

function parseIdArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? [...new Set(parsed)] : null;
}

keywordRoutes.post('/', async (req, res) => {
  const body = req.body as Partial<CreateKeywordRequest> | undefined;
  const label = parseNonEmptyLabel(body?.label);
  if (!label) {
    res.status(400).json({ error: 'label is required' } satisfies ImportApiErrorResponse);
    return;
  }

  if (
    body &&
    body.parentKeywordId !== undefined &&
    body.parentKeywordId !== null &&
    typeof body.parentKeywordId !== 'string'
  ) {
    res.status(400).json({ error: 'parentKeywordId must be a string or null' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const parentKeywordId =
      typeof body?.parentKeywordId === 'string' && body.parentKeywordId.trim().length > 0
        ? body.parentKeywordId.trim()
        : null;
    const item = await createKeyword(label, parentKeywordId);
    res.status(201).json({ item } satisfies CreateKeywordResponse);
  } catch (error) {
    if (error instanceof KeywordLabelConflictError) {
      res.status(409).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof KeywordParentNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to create keyword', error);
    res.status(500).json({ error: 'Failed to create keyword' } satisfies ImportApiErrorResponse);
  }
});

keywordRoutes.get('/', async (_req, res) => {
  try {
    res.json({ items: await listKeywords() } satisfies ListKeywordsResponse);
  } catch (error) {
    log.error('Failed to list keywords', error);
    res.status(500).json({ error: 'Failed to list keywords' } satisfies ImportApiErrorResponse);
  }
});

keywordRoutes.get('/tree', async (_req, res) => {
  try {
    res.json({ items: await listKeywordsAsTree() } satisfies ListKeywordTreeResponse);
  } catch (error) {
    log.error('Failed to list keyword tree', error);
    res.status(500).json({ error: 'Failed to list keyword tree' } satisfies ImportApiErrorResponse);
  }
});

keywordRoutes.patch('/:keywordId', async (req, res) => {
  const body = req.body as Partial<UpdateKeywordLabelRequest> | undefined;
  const label = parseNonEmptyLabel(body?.label);

  if (!label) {
    res.status(400).json({ error: 'label is required' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    res.json({
      item: await updateKeywordLabel(req.params.keywordId, label)
    } satisfies UpdateKeywordLabelResponse);
  } catch (error) {
    if (error instanceof KeywordNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof KeywordLabelConflictError) {
      res.status(409).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to update keyword label', error);
    res.status(500).json({ error: 'Failed to update keyword label' } satisfies ImportApiErrorResponse);
  }
});

keywordRoutes.patch('/:keywordId/parent', async (req, res) => {
  const body = req.body as Partial<UpdateKeywordParentRequest> | undefined;
  const parentKeywordId =
    typeof body?.parentKeywordId === 'string' && body.parentKeywordId.trim().length > 0
      ? body.parentKeywordId.trim()
      : null;

  if (body && body.parentKeywordId !== undefined && body.parentKeywordId !== null && typeof body.parentKeywordId !== 'string') {
    res.status(400).json({ error: 'parentKeywordId must be a string or null' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    res.json({
      item: await updateKeywordParent(req.params.keywordId, parentKeywordId)
    } satisfies UpdateKeywordParentResponse);
  } catch (error) {
    if (error instanceof KeywordNotFoundError || error instanceof KeywordParentNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof KeywordSelfParentError || error instanceof KeywordHierarchyCycleError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to update keyword parent', error);
    res.status(500).json({ error: 'Failed to update keyword parent' } satisfies ImportApiErrorResponse);
  }
});

keywordRoutes.get('/:keywordId/assets', async (req, res) => {
  try {
    const keyword = await getKeywordById(req.params.keywordId);
    if (!keyword) {
      res.status(404).json({ error: 'Keyword not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json({
      keyword,
      items: await listAssetsByKeyword(keyword.id)
    } satisfies ListKeywordAssetsResponse);
  } catch (error) {
    log.error('Failed to list assets by keyword', error);
    res.status(500).json({ error: 'Failed to list assets by keyword' } satisfies ImportApiErrorResponse);
  }
});

export const assetKeywordRoutes: Router = Router();

assetKeywordRoutes.get('/:assetId/keywords', async (req, res) => {
  try {
    const items = await listKeywordsForAsset(req.params.assetId);
    if (!items) {
      res.status(404).json({ error: 'Asset not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json({
      assetId: req.params.assetId,
      items
    } satisfies ListAssetKeywordsResponse);
  } catch (error) {
    log.error('Failed to list keywords for asset', error);
    res.status(500).json({ error: 'Failed to list keywords for asset' } satisfies ImportApiErrorResponse);
  }
});

assetKeywordRoutes.post('/keywords/add', async (req, res) => {
  const body = req.body as Partial<UpdateAssetKeywordsRequest> | undefined;
  const assetIds = parseIdArray(body?.assetIds);
  const keywordIds = parseIdArray(body?.keywordIds);

  if (!assetIds || !keywordIds) {
    res.status(400).json({
      error: 'assetIds and keywordIds must be non-empty string arrays'
    } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const [assets, keywords] = await Promise.all([findByIds(assetIds), findKeywordsByIds(keywordIds)]);
    if (assets.length !== assetIds.length) {
      res.status(404).json({ error: 'One or more assets were not found' } satisfies ImportApiErrorResponse);
      return;
    }

    if (keywords.length !== keywordIds.length) {
      res.status(404).json({ error: 'One or more keywords were not found' } satisfies ImportApiErrorResponse);
      return;
    }

    await addKeywordsToAssets(assetIds, keywordIds);
    res.json({ assetIds, keywordIds } satisfies UpdateAssetKeywordsResponse);
  } catch (error) {
    log.error('Failed to add keywords to assets', error);
    res.status(500).json({ error: 'Failed to add keywords to assets' } satisfies ImportApiErrorResponse);
  }
});

assetKeywordRoutes.post('/keywords/remove', async (req, res) => {
  const body = req.body as Partial<UpdateAssetKeywordsRequest> | undefined;
  const assetIds = parseIdArray(body?.assetIds);
  const keywordIds = parseIdArray(body?.keywordIds);

  if (!assetIds || !keywordIds) {
    res.status(400).json({
      error: 'assetIds and keywordIds must be non-empty string arrays'
    } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const assets = await findByIds(assetIds);
    if (assets.length !== assetIds.length) {
      res.status(404).json({ error: 'One or more assets were not found' } satisfies ImportApiErrorResponse);
      return;
    }

    await removeKeywordsFromAssets(assetIds, keywordIds);
    res.json({ assetIds, keywordIds } satisfies UpdateAssetKeywordsResponse);
  } catch (error) {
    log.error('Failed to remove keywords from assets', error);
    res.status(500).json({ error: 'Failed to remove keywords from assets' } satisfies ImportApiErrorResponse);
  }
});
