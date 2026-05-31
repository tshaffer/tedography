import { Router, type Router as RouterType } from 'express';
import { log } from '../logger.js';
import { getHistoryEntries } from '../repositories/editHistoryRepository.js';
import { findById } from '../repositories/assetRepository.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';

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

export const editHistoryRoutes: RouterType = Router();

editHistoryRoutes.get('/', async (_req, res) => {
  try {
    const [entries, allNodes] = await Promise.all([getHistoryEntries(), listAlbumTreeNodes()]);
    const nodesById = new Map(allNodes.map((n) => [n.id, n]));

    const withDetails = await Promise.all(
      entries.map(async (entry) => {
        // For successful imports navigate to the edited asset; otherwise navigate to the source.
        const navigateAssetId =
          entry.status === 'succeeded' && entry.editedAssetId
            ? entry.editedAssetId
            : entry.sourceAssetId;

        const asset = navigateAssetId ? await findById(navigateAssetId) : null;
        const albumIds = asset?.albumIds ?? [];
        const albumId = albumIds[0] ?? null;
        const albumPath = albumId ? buildAlbumPath(albumId, nodesById) : null;
        return { ...entry, navigateAssetId, albumId, albumPath };
      })
    );
    res.json(withDetails);
  } catch (error) {
    log.error('Failed to get edit history', error);
    res.status(500).json({ error: 'Failed to get edit history' });
  }
});
