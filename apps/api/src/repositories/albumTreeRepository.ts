import { type AlbumTreeNode, type AlbumTreeNodeType } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { AlbumTreeNodeModel } from '../models/albumTreeNodeModel.js';

export interface CreateAlbumTreeNodeInput {
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
}

export async function syncAlbumTreeNodeIndexes(): Promise<void> {
  await AlbumTreeNodeModel.syncIndexes();
}

export async function listAlbumTreeNodes(): Promise<AlbumTreeNode[]> {
  return AlbumTreeNodeModel.find({}, { _id: 0 })
    .sort({ parentId: 1, sortOrder: 1, label: 1 })
    .lean<AlbumTreeNode[]>();
}

export async function findAlbumTreeNodeById(id: string): Promise<AlbumTreeNode | null> {
  return AlbumTreeNodeModel.findOne({ id }, { _id: 0 }).lean<AlbumTreeNode | null>();
}

export async function countChildren(nodeId: string): Promise<number> {
  return AlbumTreeNodeModel.countDocuments({ parentId: nodeId });
}

export async function getNextSortOrderForParent(parentId: string | null): Promise<number> {
  const sibling = await AlbumTreeNodeModel.findOne({ parentId }, { _id: 0, sortOrder: 1 })
    .sort({ sortOrder: -1 })
    .lean<{ sortOrder: number } | null>();

  if (!sibling) {
    return 0;
  }

  return sibling.sortOrder + 1;
}

export async function createAlbumTreeNode(
  input: CreateAlbumTreeNodeInput
): Promise<AlbumTreeNode> {
  const now = new Date().toISOString();
  const node: AlbumTreeNode = {
    id: randomUUID(),
    label: input.label.trim(),
    nodeType: input.nodeType,
    parentId: input.parentId,
    sortOrder: await getNextSortOrderForParent(input.parentId),
    createdAt: now,
    updatedAt: now
  };

  await AlbumTreeNodeModel.create(node);
  return node;
}

export async function renameAlbumTreeNode(
  nodeId: string,
  label: string
): Promise<AlbumTreeNode | null> {
  return AlbumTreeNodeModel.findOneAndUpdate(
    { id: nodeId },
    {
      $set: {
        label: label.trim(),
        updatedAt: new Date().toISOString()
      }
    },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<AlbumTreeNode | null>();
}

export async function moveAlbumTreeNode(
  nodeId: string,
  parentId: string | null
): Promise<AlbumTreeNode | null> {
  return AlbumTreeNodeModel.findOneAndUpdate(
    { id: nodeId },
    {
      $set: {
        parentId,
        sortOrder: await getNextSortOrderForParent(parentId),
        updatedAt: new Date().toISOString()
      }
    },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<AlbumTreeNode | null>();
}

export async function deleteAlbumTreeNode(nodeId: string): Promise<boolean> {
  const result = await AlbumTreeNodeModel.deleteOne({ id: nodeId });
  return result.deletedCount > 0;
}
