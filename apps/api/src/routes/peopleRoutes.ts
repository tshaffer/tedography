import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import { log } from '../logger.js';
import { getPersonPhotosByEstimatedAge } from '../people/personPhotoQueryService.js';

export const peopleRoutes: Router = Router();

peopleRoutes.get('/:personId/photos', async (req, res) => {
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy.trim() : 'estimatedAge';
  if (sortBy !== 'estimatedAge') {
    res.status(400).json({ error: 'sortBy must be "estimatedAge"' } satisfies ImportApiErrorResponse);
    return;
  }

  const sortDirection =
    typeof req.query.sortDirection === 'string' && req.query.sortDirection.trim() === 'desc'
      ? 'desc'
      : 'asc';
  const uniquePhotosOnly =
    typeof req.query.uniquePhotosOnly === 'string'
      ? req.query.uniquePhotosOnly.trim().toLowerCase() !== 'false'
      : true;

  try {
    const response = await getPersonPhotosByEstimatedAge({
      personId: req.params.personId,
      sortDirection,
      uniquePhotosOnly
    });
    if (!response) {
      res.status(404).json({ error: 'Person not found' } satisfies ImportApiErrorResponse);
      return;
    }

    res.json(response);
  } catch (error) {
    log.error('Failed to load person photos by estimated age', error);
    res.status(500).json({ error: 'Failed to load person photos' } satisfies ImportApiErrorResponse);
  }
});
