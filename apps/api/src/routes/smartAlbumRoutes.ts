import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type {
  CreateSmartAlbumRequest,
  CreateSmartAlbumResponse,
  DeleteSmartAlbumResponse,
  GetSmartAlbumResponse,
  ListSmartAlbumsResponse,
  UpdateSmartAlbumRequest,
  UpdateSmartAlbumResponse
} from '@tedography/shared';
import { log } from '../logger.js';
import {
  createSmartAlbum,
  deleteSmartAlbum,
  getSmartAlbumById,
  listSmartAlbums,
  SmartAlbumNotFoundError,
  SmartAlbumValidationError,
  updateSmartAlbum
} from '../repositories/smartAlbumRepository.js';

export const smartAlbumRoutes: Router = Router();

function parseOptionalLabel(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

function isFilterSpecObject(value: unknown): value is NonNullable<CreateSmartAlbumRequest['filterSpec']> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

smartAlbumRoutes.post('/', async (req, res) => {
  const body = req.body as Partial<CreateSmartAlbumRequest> | undefined;
  const label = parseOptionalLabel(body?.label);
  if (!label) {
    res.status(400).json({ error: 'label is required' } satisfies ImportApiErrorResponse);
    return;
  }

  if (!isFilterSpecObject(body?.filterSpec)) {
    res.status(400).json({ error: 'filterSpec is required' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    res.status(201).json({
      item: await createSmartAlbum(label, body.filterSpec)
    } satisfies CreateSmartAlbumResponse);
  } catch (error) {
    if (error instanceof SmartAlbumValidationError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to create smart album', error);
    res.status(500).json({ error: 'Failed to create smart album' } satisfies ImportApiErrorResponse);
  }
});

smartAlbumRoutes.get('/', async (_req, res) => {
  try {
    res.json({ items: await listSmartAlbums() } satisfies ListSmartAlbumsResponse);
  } catch (error) {
    log.error('Failed to list smart albums', error);
    res.status(500).json({ error: 'Failed to list smart albums' } satisfies ImportApiErrorResponse);
  }
});

smartAlbumRoutes.get('/:id', async (req, res) => {
  try {
    const item = await getSmartAlbumById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Smart Album not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json({ item } satisfies GetSmartAlbumResponse);
  } catch (error) {
    log.error('Failed to load smart album', error);
    res.status(500).json({ error: 'Failed to load smart album' } satisfies ImportApiErrorResponse);
  }
});

smartAlbumRoutes.patch('/:id', async (req, res) => {
  const body = req.body as Partial<UpdateSmartAlbumRequest> | undefined;
  const parsedLabel = parseOptionalLabel(body?.label);
  const label = parsedLabel ?? undefined;

  if (body?.label !== undefined && !parsedLabel) {
    res.status(400).json({ error: 'label must not be empty' } satisfies ImportApiErrorResponse);
    return;
  }

  if (body?.filterSpec !== undefined && !isFilterSpecObject(body.filterSpec)) {
    res.status(400).json({ error: 'filterSpec must be an object' } satisfies ImportApiErrorResponse);
    return;
  }

  if (label === undefined && body?.filterSpec === undefined) {
    res.status(400).json({ error: 'Provide label and/or filterSpec to update' } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    const updateRequest = {
      ...(label !== undefined ? { label } : {}),
      ...(body?.filterSpec !== undefined ? { filterSpec: body.filterSpec } : {})
    };
    res.json({
      item: await updateSmartAlbum(req.params.id, updateRequest)
    } satisfies UpdateSmartAlbumResponse);
  } catch (error) {
    if (error instanceof SmartAlbumNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof SmartAlbumValidationError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to update smart album', error);
    res.status(500).json({ error: 'Failed to update smart album' } satisfies ImportApiErrorResponse);
  }
});

smartAlbumRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteSmartAlbum(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Smart Album not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json({ id: req.params.id } satisfies DeleteSmartAlbumResponse);
  } catch (error) {
    log.error('Failed to delete smart album', error);
    res.status(500).json({ error: 'Failed to delete smart album' } satisfies ImportApiErrorResponse);
  }
});
