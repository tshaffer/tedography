import { Router } from 'express';
import type { Collection } from '@tedography/domain';
import {
  addAssetsToCollection,
  removeAssetsFromCollection,
  removeCollectionIdFromAllAssets
} from '../repositories/assetRepository.js';
import {
  createCollection,
  deleteCollection,
  findCollectionById,
  listCollections,
  renameCollection
} from '../repositories/collectionRepository.js';

type CollectionErrorResponse = {
  error: string;
};

function parseNonEmptyName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function parseAssetIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (parsed.length === 0) {
    return null;
  }

  return Array.from(new Set(parsed));
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export const collectionRoutes: Router = Router();

collectionRoutes.get('/', async (_req, res) => {
  try {
    const collections = await listCollections();
    res.json(collections);
  } catch {
    const errorResponse: CollectionErrorResponse = { error: 'Failed to load collections' };
    res.status(500).json(errorResponse);
  }
});

collectionRoutes.post('/', async (req, res) => {
  const name = parseNonEmptyName((req.body as { name?: unknown }).name);
  if (!name) {
    const errorResponse: CollectionErrorResponse = { error: 'name is required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const created = await createCollection(name);
    res.status(201).json(created);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const errorResponse: CollectionErrorResponse = { error: 'Collection name must be unique' };
      res.status(409).json(errorResponse);
      return;
    }

    const errorResponse: CollectionErrorResponse = { error: 'Failed to create collection' };
    res.status(500).json(errorResponse);
  }
});

collectionRoutes.patch('/:id', async (req, res) => {
  const name = parseNonEmptyName((req.body as { name?: unknown }).name);
  if (!name) {
    const errorResponse: CollectionErrorResponse = { error: 'name is required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const updated = await renameCollection(req.params.id, name);
    if (!updated) {
      const errorResponse: CollectionErrorResponse = { error: 'Collection not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(updated);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const errorResponse: CollectionErrorResponse = { error: 'Collection name must be unique' };
      res.status(409).json(errorResponse);
      return;
    }

    const errorResponse: CollectionErrorResponse = { error: 'Failed to rename collection' };
    res.status(500).json(errorResponse);
  }
});

collectionRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteCollection(req.params.id);
    if (!deleted) {
      const errorResponse: CollectionErrorResponse = { error: 'Collection not found' };
      res.status(404).json(errorResponse);
      return;
    }

    await removeCollectionIdFromAllAssets(req.params.id);
    res.status(204).send();
  } catch {
    const errorResponse: CollectionErrorResponse = { error: 'Failed to delete collection' };
    res.status(500).json(errorResponse);
  }
});

collectionRoutes.post('/:id/assets', async (req, res) => {
  const assetIds = parseAssetIds((req.body as { assetIds?: unknown }).assetIds);
  if (!assetIds) {
    const errorResponse: CollectionErrorResponse = { error: 'assetIds must be a non-empty string array' };
    res.status(400).json(errorResponse);
    return;
  }

  const collectionId = req.params.id.trim();
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    const errorResponse: CollectionErrorResponse = { error: 'Collection not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    await addAssetsToCollection(assetIds, collectionId);
    const response: { collection: Collection; assetIds: string[] } = {
      collection,
      assetIds
    };
    res.json(response);
  } catch {
    const errorResponse: CollectionErrorResponse = { error: 'Failed to add assets to collection' };
    res.status(500).json(errorResponse);
  }
});

collectionRoutes.delete('/:id/assets', async (req, res) => {
  const assetIds = parseAssetIds((req.body as { assetIds?: unknown }).assetIds);
  if (!assetIds) {
    const errorResponse: CollectionErrorResponse = { error: 'assetIds must be a non-empty string array' };
    res.status(400).json(errorResponse);
    return;
  }

  const collectionId = req.params.id.trim();
  const collection = await findCollectionById(collectionId);
  if (!collection) {
    const errorResponse: CollectionErrorResponse = { error: 'Collection not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    await removeAssetsFromCollection(assetIds, collectionId);
    const response: { collection: Collection; assetIds: string[] } = {
      collection,
      assetIds
    };
    res.json(response);
  } catch {
    const errorResponse: CollectionErrorResponse = { error: 'Failed to remove assets from collection' };
    res.status(500).json(errorResponse);
  }
});
