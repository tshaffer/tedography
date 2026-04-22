import { Router } from 'express';
import type {
  AlbumTreeChildOrderMode,
  AlbumTreeNode,
  AlbumTreeNodeType
} from '@tedography/domain';
import {
  addAssetsToAlbum,
  findByIds,
  moveAssetsToAlbum,
  removeAlbumIdFromAllAssets,
  removeAssetsFromAlbum,
  updateAlbumManualSortOrdinals,
  updateAlbumMembershipOrderingMode
} from '../repositories/assetRepository.js';
import {
  AlbumTreeSiblingLabelConflictError,
  countChildren,
  createAlbumTreeNode,
  deleteAlbumTreeNode,
  findAlbumTreeNodeById,
  listAlbumTreeNodes,
  moveAlbumTreeNode,
  reorderAlbumTreeNodeWithinSiblings,
  renameAlbumTreeNode,
  updateAlbumTreeNodeChildOrderMode
} from '../repositories/albumTreeRepository.js';

type AlbumTreeErrorResponse = {
  error: string;
};

type AlbumManualOrderRequest = {
  orderedAssetIds: string[];
};

type AlbumMembershipOrderingModeRequest = {
  assetId?: unknown;
  forceManualOrder?: unknown;
};

type AlbumTreeChildOrderModeRequest = {
  childOrderMode?: unknown;
};

type MoveAlbumTreeNodeRequest = {
  parentId?: unknown;
  targetIndex?: unknown;
};

type CreateAlbumTreeNodeRequest = {
  label?: unknown;
  nodeType?: unknown;
  parentId?: unknown;
  targetIndex?: unknown;
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

function hasUsableCaptureDateTime(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function parseReorderDirection(value: unknown): 'up' | 'down' | null {
  if (value === 'up' || value === 'down') {
    return value;
  }

  return null;
}

function parseAlbumTreeChildOrderMode(value: unknown): AlbumTreeChildOrderMode | null {
  if (value === 'Custom' || value === 'Name' || value === 'NumericThenName') {
    return value;
  }

  return null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function parseOptionalNonNegativeInteger(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return parseNonNegativeInteger(value);
}

async function loadAlbumNode(nodeId: string): Promise<AlbumTreeNode | null> {
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node || node.nodeType !== 'Album') {
    return null;
  }

  return node;
}

function getDescendantNodeIds(nodes: AlbumTreeNode[], groupId: string): Set<string> {
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  const descendantIds = new Set<string>();
  const stack = [...(childrenByParent.get(groupId) ?? [])];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    descendantIds.add(node.id);
    stack.push(...(childrenByParent.get(node.id) ?? []));
  }

  return descendantIds;
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
  const createRequest = req.body as CreateAlbumTreeNodeRequest;
  const label = parseNonEmptyLabel(createRequest.label);
  const nodeType = parseNodeType(createRequest.nodeType);
  const parentId = parseParentId(createRequest.parentId);
  const targetIndex = parseOptionalNonNegativeInteger(createRequest.targetIndex);
  if (!label || !nodeType) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'label and nodeType are required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (targetIndex === null) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'targetIndex must be a non-negative integer' };
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
    const created = await createAlbumTreeNode({
      label,
      nodeType,
      parentId,
      ...(targetIndex !== undefined ? { targetIndex } : {})
    });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof AlbumTreeSiblingLabelConflictError) {
      const errorResponse: AlbumTreeErrorResponse = { error: error.message };
      res.status(409).json(errorResponse);
      return;
    }

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
  } catch (error) {
    if (error instanceof AlbumTreeSiblingLabelConflictError) {
      const errorResponse: AlbumTreeErrorResponse = { error: error.message };
      res.status(409).json(errorResponse);
      return;
    }

    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to rename node' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.post('/:id/move', async (req, res) => {
  const moveRequest = req.body as MoveAlbumTreeNodeRequest;
  const parentId = parseParentId(moveRequest.parentId);
  const targetIndex = parseNonNegativeInteger(moveRequest.targetIndex);
  if (targetIndex === null) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'targetIndex must be a non-negative integer' };
    res.status(400).json(errorResponse);
    return;
  }

  const node = await findAlbumTreeNodeById(req.params.id);
  if (!node) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  if (parentId !== null) {
    const parentNode = await findAlbumTreeNodeById(parentId);
    if (!parentNode) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Destination node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    if (parentNode.nodeType !== 'Group') {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Only Group nodes may contain child nodes' };
      res.status(400).json(errorResponse);
      return;
    }

    if (node.nodeType === 'Group') {
      if (parentNode.id === node.id) {
        const errorResponse: AlbumTreeErrorResponse = { error: 'A group cannot be moved into itself' };
        res.status(400).json(errorResponse);
        return;
      }

      const allNodes = await listAlbumTreeNodes();
      const descendantIds = getDescendantNodeIds(allNodes, node.id);
      if (descendantIds.has(parentNode.id)) {
        const errorResponse: AlbumTreeErrorResponse = { error: 'A group cannot be moved into its descendant' };
        res.status(400).json(errorResponse);
        return;
      }
    }
  }

  try {
    const moved = await moveAlbumTreeNode(node.id, parentId, targetIndex);
    if (!moved) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(moved);
  } catch (error) {
    if (error instanceof AlbumTreeSiblingLabelConflictError) {
      const errorResponse: AlbumTreeErrorResponse = { error: error.message };
      res.status(409).json(errorResponse);
      return;
    }

    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to move node' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.post('/:id/reorder', async (req, res) => {
  const direction = parseReorderDirection((req.body as { direction?: unknown }).direction);
  if (!direction) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'direction must be "up" or "down"' };
    res.status(400).json(errorResponse);
    return;
  }

  const node = await findAlbumTreeNodeById(req.params.id);
  if (!node) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  const siblings = (await listAlbumTreeNodes())
    .filter(
      (candidate) => candidate.parentId === node.parentId && candidate.nodeType === node.nodeType
    )
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      const labelComparison = left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
      if (labelComparison !== 0) {
        return labelComparison;
      }

      return left.id.localeCompare(right.id);
    });
  const currentIndex = siblings.findIndex((candidate) => candidate.id === node.id);
  if (currentIndex < 0) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found in its sibling set' };
    res.status(404).json(errorResponse);
    return;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    const errorResponse: AlbumTreeErrorResponse = {
      error: direction === 'up' ? 'Node is already the first sibling' : 'Node is already the last sibling'
    };
    res.status(409).json(errorResponse);
    return;
  }

  try {
    const reordered = await reorderAlbumTreeNodeWithinSiblings(node.id, direction);
    if (!reordered) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(reordered);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to reorder node' };
    res.status(500).json(errorResponse);
  }
});

albumTreeRoutes.post('/:id/child-order-mode', async (req, res) => {
  const childOrderMode = parseAlbumTreeChildOrderMode(
    (req.body as AlbumTreeChildOrderModeRequest).childOrderMode
  );
  if (!childOrderMode) {
    const errorResponse: AlbumTreeErrorResponse = {
      error: 'childOrderMode must be "Custom", "Name", or "NumericThenName"'
    };
    res.status(400).json(errorResponse);
    return;
  }

  const node = await findAlbumTreeNodeById(req.params.id);
  if (!node || node.nodeType !== 'Group') {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Group node not found' };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    const updated = await updateAlbumTreeNodeChildOrderMode(node.id, childOrderMode);
    if (!updated) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Group node not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(updated);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to update group child order mode' };
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

albumMembershipRoutes.post('/:id/move-assets', async (req, res) => {
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
    const updatedAssets = await moveAssetsToAlbum(assetIds, albumNode.id);
    res.json(updatedAssets);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to move assets to album' };
    res.status(500).json(errorResponse);
  }
});

albumMembershipRoutes.post('/:id/manual-order', async (req, res) => {
  const albumNode = await loadAlbumNode(req.params.id);
  if (!albumNode) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Album not found' };
    res.status(404).json(errorResponse);
    return;
  }

  const orderedAssetIds = parseAssetIds((req.body as AlbumManualOrderRequest).orderedAssetIds);
  if (!orderedAssetIds) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'orderedAssetIds is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const assets = await findByIds(orderedAssetIds);
  if (assets.length !== orderedAssetIds.length) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'One or more assets were not found' };
    res.status(404).json(errorResponse);
    return;
  }

  const invalidAsset = assets.find(
    (asset) =>
      !(asset.albumIds ?? []).includes(albumNode.id) ||
      !(
        (asset.albumMemberships?.find((membership) => membership.albumId === albumNode.id)?.forceManualOrder ===
          true) ||
        !hasUsableCaptureDateTime(asset.captureDateTime)
      )
  );
  if (invalidAsset) {
    const errorResponse: AlbumTreeErrorResponse = {
      error: `Asset "${invalidAsset.filename}" cannot be manually ordered in "${albumNode.label}"`
    };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const updatedAssets = await updateAlbumManualSortOrdinals(albumNode.id, orderedAssetIds);
    res.json(updatedAssets);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Failed to update album manual order' };
    res.status(500).json(errorResponse);
  }
});

albumMembershipRoutes.post('/:id/ordering-mode', async (req, res) => {
  const albumNode = await loadAlbumNode(req.params.id);
  if (!albumNode) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Album not found' };
    res.status(404).json(errorResponse);
    return;
  }

  const assetIdValue = (req.body as AlbumMembershipOrderingModeRequest).assetId;
  const forceManualOrderValue = (req.body as AlbumMembershipOrderingModeRequest).forceManualOrder;
  const assetId = typeof assetIdValue === 'string' ? assetIdValue.trim() : '';
  if (!assetId) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'assetId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (typeof forceManualOrderValue !== 'boolean') {
    const errorResponse: AlbumTreeErrorResponse = { error: 'forceManualOrder is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const asset = await findByIds([assetId]);
  const matchedAsset = asset[0] ?? null;
  if (!matchedAsset) {
    const errorResponse: AlbumTreeErrorResponse = { error: 'Asset not found' };
    res.status(404).json(errorResponse);
    return;
  }

  if (!(matchedAsset.albumIds ?? []).includes(albumNode.id)) {
    const errorResponse: AlbumTreeErrorResponse = {
      error: `Asset "${matchedAsset.filename}" does not belong to "${albumNode.label}"`
    };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const updatedAsset = await updateAlbumMembershipOrderingMode(
      albumNode.id,
      assetId,
      forceManualOrderValue
    );

    if (!updatedAsset) {
      const errorResponse: AlbumTreeErrorResponse = { error: 'Asset not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.json(updatedAsset);
  } catch {
    const errorResponse: AlbumTreeErrorResponse = {
      error: 'Failed to update album ordering mode'
    };
    res.status(500).json(errorResponse);
  }
});
