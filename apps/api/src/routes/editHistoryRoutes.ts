import { Router, type Router as RouterType } from 'express';
import { log } from '../logger.js';
import { getHistoryEntries } from '../repositories/editHistoryRepository.js';

export const editHistoryRoutes: RouterType = Router();

editHistoryRoutes.get('/', async (_req, res) => {
  try {
    const entries = await getHistoryEntries();
    res.json(entries);
  } catch (error) {
    log.error('Failed to get edit history', error);
    res.status(500).json({ error: 'Failed to get edit history' });
  }
});
