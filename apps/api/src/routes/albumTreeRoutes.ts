import { Router } from 'express';
import type { AlbumTreeNode, AlbumTreeNodeType } from '@tedography/domain';
import {
  addAssetsToAlbum,
  removeAlbumIdFromAllAssets,
  removeAssetsFromAlbum
} from '../repositories/assetRepository.js';
import {
  countChildren,
  createAlbumTreeNode,
  deleteAlbumTreeNode,
  findAlbumTreeNodeById,
  listAlbumTreeNodes,
  renameAlbumTreeNode
} from '../repositories/albumTreeRepository.js';

type AlbumTreeErrorResponse = {
  error: string;
};

function parseNonEmptyLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function parseNodeType(value: unknown): AlbumTreeNodeType | null {
  if (value === 'Group' || value === 'Album') {
    return value;
  }

  return null;
}

function parseParentId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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

async function loadAlbumNode(nodeId: string): Promise<AlbumTreeNode | null> {
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node || node.nodeType !== 'Album') {
    return null;
  }

  return node;
}

export const albumTreeRoutes: Router = Router();
export const albumMembershipRoutes: Router = Router();

albumTreeRoutes.get('/', async (_req, res) => {
  try {
    const nodes = await listAlbumTreeNodes();
    res.json(nodes);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to load album tree' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.post('/', async (req, res) => {
  const label = parseNonEmptyLabel((req.body as { label?: unknown }).label);
  const nodeType = parseNodeType((req.body as { nodeType?: unknown }).nodeType);
  const parentId = parseParentId((req.body as { parentId?: unknown }).parentId);
  if (!label || !nodeType) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'label and nodeType are required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (nodeType === 'Album' && parentId === null) {
    const errorResponse: AlbumTreeErrorResponse = {
      error: 'Album nodes must be created inside a Group'
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (parentId !== null) {
    const parentNode = await findAlbumTreeNodeById(parentId);
    if (!parentNode) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Parent node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    if (parentNode.nodeType !== 'Group') {
      const errorResponse: AlbumTreeErrorResponse = {
        error: 'Only Group nodes may contain child nodes'
      };
      res.status(400).json(errorResponse);
      return;
    }
  }

  try {
    const created = await createAlbumTreeNode({ label, nodeType, parentId });
    res.status(201).json(created);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to create album tree node' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.patch('/:id', async (req, res) => {
  const label = parseNonEmptyLabel((req.body as { label?: unknown }).label);
  if (!label) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'label is required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const updated = await renameAlbumTreeNode(req.params.id, label);
    if (!updated) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(updated);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to rename node' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.delete('/:id', async (req, res) => {
  const node = await findAlbumTreeNodeById(req.params.id);
  if (!node) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  if (node.nodeType === 'Group') {
    const childCount = await countChildren(node.id);
    if (childCount > 0) {
      const errorResponse: AlbumTreeErrorResponse = {
        error: 'Cannot delete non-empty group'
      };
      res.status(409).json(errorResponse);
      return;
    }
  }

  try {
    const deleted = await deleteAlbumTreeNode(node.id);
    if (!deleted) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    if (node.nodeType === 'Album') {
      await removeAlbumIdFromAllAssets(node.id);
    }

    res.status(204).send();
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to delete node' };
    res.status(500).json(errorResponse);
  }
});

albumMembershipRoutes.post('/:id/assets', async (req, res) => {
  const assetIds = parseAssetIds((req.body as { assetIds?: unknown }).assetIds);
  if (!assetIds) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'assetIds must be a non-empty string array' };
    res.status(400).json(errorResponse);
    return;
  }

  const albumNode = await loadAlbumNode(req.params.id.trim());
  if (!albumNode) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Album node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    await addAssetsToAlbum(assetIds, albumNode.id);
    res.json({ album: albumNode, assetIds });
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to add assets to album' };
    res.status(500).json(errorResponse);
  }
});

albumMembershipRoutes.delete('/:id/assets', async (req, res) => {
  const assetIds = parseAssetIds((req.body as { assetIds?: unknown }).assetIds);
  if (!assetIds) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'assetIds must be a non-empty string array' };
    res.status(400).json(errorResponse);
    return;
  }

  const albumNode = await loadAlbumNode(req.params.id.trim());
  if (!albumNode) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Album node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    await removeAssetsFromAlbum(assetIds, albumNode.id);
    res.json({ album: albumNode, assetIds });
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to remove assets from album' };
    res.status(500).json(errorResponse);
  }
});
