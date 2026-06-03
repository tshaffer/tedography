import { Router, type Router as RouterType } from 'express';
import { log } from '../logger.js';
import { requireFeature } from '../middleware/requireFeature.js';
import {
  getHistoryEntries,
  getEntriesByArchiveId,
  archiveEntries,
  deleteEntriesByArchiveId,
  updateEntryNote,
} from '../repositories/editHistoryRepository.js';
import {
  createArchive,
  getArchives,
  getArchiveById,
  renameArchive,
  incrementArchiveItemCount,
  deleteArchive,
} from '../repositories/editHistoryArchiveRepository.js';
import { findById } from '../repositories/assetRepository.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';
import type { EditHistoryEntry } from '@tedography/domain';

type AlbumNodeMap = Map<string, { label: string; parentId: string | null }>;

function buildAlbumPath(albumId: string, nodesById: AlbumNodeMap): string | null {
  const parts: string[] = [];
  let currentId: string | null = albumId;
  let depth = 0;
  while (currentId && depth < 20) {
    const node = nodesById.get(currentId);
    if (!node) break;
    parts.unshift(node.label);
    currentId = node.parentId;
    depth++;
  }
  return parts.length > 0 ? parts.join(' → ') : null;
}

async function enrichEntries(entries: EditHistoryEntry[], nodesById: AlbumNodeMap) {
  return Promise.all(
    entries.map(async (entry) => {
      const navigateAssetId =
        entry.status === 'succeeded' && entry.editedAssetId
          ? entry.editedAssetId
          : entry.sourceAssetId;
      const asset = navigateAssetId ? await findById(navigateAssetId) : null;
      const albumId = (asset?.albumIds ?? [])[0] ?? null;
      const albumPath = albumId ? buildAlbumPath(albumId, nodesById) : null;
      return { ...entry, navigateAssetId, albumId, albumPath };
    })
  );
}

export const editHistoryRoutes: RouterType = Router();

// ─── GET / — active entries ───────────────────────────────────────────────────

editHistoryRoutes.get('/', async (_req, res) => {
  try {
    const [entries, allNodes] = await Promise.all([getHistoryEntries(), listAlbumTreeNodes()]);
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));
    res.json(await enrichEntries(entries, nodesById));
  } catch (error) {
    log.error('Failed to get edit history', error);
    res.status(500).json({ error: 'Failed to get edit history' });
  }
});

// ─── PATCH /:entryId — update note on an active entry ────────────────────────

editHistoryRoutes.patch('/:entryId', async (req, res) => {
  const { entryId } = req.params as { entryId: string };
  const { note } = req.body as { note?: string };
  if (typeof note !== 'string') {
    res.status(400).json({ error: 'note must be a string' });
    return;
  }
  try {
    const updated = await updateEntryNote(entryId, note);
    if (!updated) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to update edit history note', error);
    res.status(500).json({ error: 'Failed to update edit history note' });
  }
});

// ─── GET /archives — list all archives ───────────────────────────────────────

editHistoryRoutes.get('/archives', async (_req, res) => {
  try {
    res.json(await getArchives());
  } catch (error) {
    log.error('Failed to list archives', error);
    res.status(500).json({ error: 'Failed to list archives' });
  }
});

// ─── POST /archives — create archive from selected active entries ─────────────

editHistoryRoutes.post('/archives', requireFeature('maintenance'), async (req, res) => {
  const { entryIds, name } = req.body as { entryIds?: string[]; name?: string };
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    res.status(400).json({ error: 'entryIds must be a non-empty array' });
    return;
  }
  try {
    const archive = await createArchive(name, entryIds.length);
    const moved = await archiveEntries(entryIds, archive.id);
    if (moved !== entryIds.length) {
      // Some entries were already archived — update itemCount to reflect reality.
      await incrementArchiveItemCount(archive.id, moved - entryIds.length);
    }
    res.json(archive);
  } catch (error) {
    log.error('Failed to create archive', error);
    res.status(500).json({ error: 'Failed to create archive' });
  }
});

// ─── GET /archives/:archiveId — entries in an archive ────────────────────────

editHistoryRoutes.get('/archives/:archiveId', async (req, res) => {
  const { archiveId } = req.params as { archiveId: string };
  try {
    const [archive, entries, allNodes] = await Promise.all([
      getArchiveById(archiveId),
      getEntriesByArchiveId(archiveId),
      listAlbumTreeNodes(),
    ]);
    if (!archive) {
      res.status(404).json({ error: 'Archive not found' });
      return;
    }
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));
    res.json({ archive, entries: await enrichEntries(entries, nodesById) });
  } catch (error) {
    log.error('Failed to get archive entries', error);
    res.status(500).json({ error: 'Failed to get archive entries' });
  }
});

// ─── PATCH /archives/:archiveId — rename ─────────────────────────────────────

editHistoryRoutes.patch('/archives/:archiveId', requireFeature('maintenance'), async (req, res) => {
  const { archiveId } = req.params as { archiveId: string };
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const archive = await getArchiveById(archiveId);
    if (!archive) {
      res.status(404).json({ error: 'Archive not found' });
      return;
    }
    await renameArchive(archiveId, name);
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to rename archive', error);
    res.status(500).json({ error: 'Failed to rename archive' });
  }
});

// ─── POST /archives/:archiveId/append — append active entries to archive ──────

editHistoryRoutes.post('/archives/:archiveId/append', requireFeature('maintenance'), async (req, res) => {
  const { archiveId } = req.params as { archiveId: string };
  const { entryIds } = req.body as { entryIds?: string[] };
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    res.status(400).json({ error: 'entryIds must be a non-empty array' });
    return;
  }
  try {
    const archive = await getArchiveById(archiveId);
    if (!archive) {
      res.status(404).json({ error: 'Archive not found' });
      return;
    }
    const moved = await archiveEntries(entryIds, archiveId);
    if (moved > 0) {
      await incrementArchiveItemCount(archiveId, moved);
    }
    res.json({ ok: true, appended: moved });
  } catch (error) {
    log.error('Failed to append to archive', error);
    res.status(500).json({ error: 'Failed to append to archive' });
  }
});

// ─── DELETE /archives/:archiveId — delete archive + all its entries ───────────

editHistoryRoutes.delete('/archives/:archiveId', requireFeature('maintenance'), async (req, res) => {
  const { archiveId } = req.params as { archiveId: string };
  try {
    const archive = await getArchiveById(archiveId);
    if (!archive) {
      res.status(404).json({ error: 'Archive not found' });
      return;
    }
    await deleteEntriesByArchiveId(archiveId);
    await deleteArchive(archiveId);
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to delete archive', error);
    res.status(500).json({ error: 'Failed to delete archive' });
  }
});
