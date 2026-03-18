import { type AlbumTreeNode, type AlbumTreeNodeType } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { AlbumTreeNodeModel } from '../models/albumTreeNodeModel.js';

export interface CreateAlbumTreeNodeInput {
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
}

export type AlbumTreeNodeReorderDirection = 'up' | 'down';
const normalizedSortOrderStep = 10;

function compareAlbumTreeNodeNames(left: AlbumTreeNode, right: AlbumTreeNode): number {
  const labelComparison = left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareAlbumTreeNodesByCustomBucketOrder(left: AlbumTreeNode, right: AlbumTreeNode): number {
  if (left.nodeType !== right.nodeType) {
    return left.nodeType === 'Group' ? -1 : 1;
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return compareAlbumTreeNodeNames(left, right);
}

function sortNodesForCustomBucketOrder(nodes: AlbumTreeNode[]): AlbumTreeNode[] {
  return [...nodes].sort(compareAlbumTreeNodesByCustomBucketOrder);
}

function assignNormalizedSortOrders(nodes: AlbumTreeNode[]): AlbumTreeNode[] {
  return nodes.map((node, index) => ({
    ...node,
    sortOrder: (index + 1) * normalizedSortOrderStep
  }));
}

function insertNodeAtEndOfTypeBucket(nodes: AlbumTreeNode[], nextNode: AlbumTreeNode): AlbumTreeNode[] {
  const orderedNodes = sortNodesForCustomBucketOrder(nodes);
  const insertionIndex =
    nextNode.nodeType === 'Group'
      ? orderedNodes.filter((node) => node.nodeType === 'Group').length
      : orderedNodes.length;

  return [
    ...orderedNodes.slice(0, insertionIndex),
    nextNode,
    ...orderedNodes.slice(insertionIndex)
  ];
}

function buildUpdateOperationsForChangedNodes(
  previousNodesById: Map<string, AlbumTreeNode>,
  nextNodes: AlbumTreeNode[],
  timestamp: string
): Array<{
  updateOne: {
    filter: { id: string };
    update: {
      $set: {
        parentId: string | null;
        sortOrder: number;
        updatedAt: string;
      };
    };
  };
}> {
  return nextNodes.flatMap((nextNode) => {
    const previousNode = previousNodesById.get(nextNode.id);
    if (
      !previousNode ||
      (previousNode.parentId === nextNode.parentId && previousNode.sortOrder === nextNode.sortOrder)
    ) {
      return [];
    }

    return [
      {
        updateOne: {
          filter: { id: nextNode.id },
          update: {
            $set: {
              parentId: nextNode.parentId,
              sortOrder: nextNode.sortOrder,
              updatedAt: timestamp
            }
          }
        }
      }
    ];
  });
}

async function listSiblingNodes(parentId: string | null): Promise<AlbumTreeNode[]> {
  return AlbumTreeNodeModel.find({ parentId }, { _id: 0 }).lean<AlbumTreeNode[]>();
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

export async function createAlbumTreeNode(
  input: CreateAlbumTreeNodeInput
): Promise<AlbumTreeNode> {
  const now = new Date().toISOString();
  const newNode: AlbumTreeNode = {
    id: randomUUID(),
    label: input.label.trim(),
    nodeType: input.nodeType,
    parentId: input.parentId,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };

  const siblings = await listSiblingNodes(input.parentId);
  const previousNodesById = new Map(siblings.map((node) => [node.id, node]));
  const nextNodes = assignNormalizedSortOrders(insertNodeAtEndOfTypeBucket(siblings, newNode));
  const createdNode = nextNodes.find((node) => node.id === newNode.id) ?? newNode;
  const siblingUpdateOperations = buildUpdateOperationsForChangedNodes(
    previousNodesById,
    nextNodes.filter((node) => node.id !== newNode.id),
    now
  );

  await AlbumTreeNodeModel.bulkWrite([
    {
      insertOne: {
        document: createdNode
      }
    },
    ...siblingUpdateOperations
  ]);

  return createdNode;
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
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node) {
    return null;
  }

  if (node.parentId === parentId) {
    return node;
  }

  const [sourceSiblings, destinationSiblings] = await Promise.all([
    listSiblingNodes(node.parentId),
    listSiblingNodes(parentId)
  ]);
  const now = new Date().toISOString();

  const sourceRemainingNodes = sourceSiblings.filter((sibling) => sibling.id !== node.id);
  const normalizedSourceNodes = assignNormalizedSortOrders(
    sortNodesForCustomBucketOrder(sourceRemainingNodes)
  );

  const destinationBaseNodes = destinationSiblings.filter((sibling) => sibling.id !== node.id);
  const destinationNode: AlbumTreeNode = {
    ...node,
    parentId
  };
  const normalizedDestinationNodes = assignNormalizedSortOrders(
    insertNodeAtEndOfTypeBucket(destinationBaseNodes, destinationNode)
  );

  const previousNodesById = new Map(
    [...sourceSiblings, ...destinationSiblings, node].map((existingNode) => [existingNode.id, existingNode])
  );
  const updateOperations = [
    ...buildUpdateOperationsForChangedNodes(previousNodesById, normalizedSourceNodes, now),
    ...buildUpdateOperationsForChangedNodes(previousNodesById, normalizedDestinationNodes, now)
  ];

  if (updateOperations.length > 0) {
    await AlbumTreeNodeModel.bulkWrite(updateOperations);
  }

  return findAlbumTreeNodeById(nodeId);
}

export async function reorderAlbumTreeNodeWithinSiblings(
  nodeId: string,
  direction: AlbumTreeNodeReorderDirection
): Promise<AlbumTreeNode | null> {
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node) {
    return null;
  }

  const siblings = sortNodesForCustomBucketOrder(
    (await listSiblingNodes(node.parentId)).filter((sibling) => sibling.nodeType === node.nodeType)
  );
  const currentIndex = siblings.findIndex((sibling) => sibling.id === nodeId);
  if (currentIndex < 0) {
    return null;
  }

  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  const swapNode = siblings[swapIndex];
  if (!swapNode) {
    return node;
  }

  const timestamp = new Date().toISOString();
  const reorderedSiblings = [...siblings];
  reorderedSiblings[currentIndex] = swapNode;
  reorderedSiblings[swapIndex] = node;
  const normalizedSiblings = assignNormalizedSortOrders(reorderedSiblings);
  const previousNodesById = new Map(siblings.map((sibling) => [sibling.id, sibling]));
  const updateOperations = buildUpdateOperationsForChangedNodes(
    previousNodesById,
    normalizedSiblings,
    timestamp
  );

  if (updateOperations.length > 0) {
    await AlbumTreeNodeModel.bulkWrite(updateOperations);
  }

  return findAlbumTreeNodeById(nodeId);
}

export async function deleteAlbumTreeNode(nodeId: string): Promise<boolean> {
  const result = await AlbumTreeNodeModel.deleteOne({ id: nodeId });
  return result.deletedCount > 0;
}
