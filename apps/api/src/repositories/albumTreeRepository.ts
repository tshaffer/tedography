import {
  type AlbumTreeChildOrderMode,
  type AlbumTreeNodeSemanticKind,
  type AlbumTreeNode,
  type AlbumTreeNodeType
} from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { AlbumTreeNodeModel } from '../models/albumTreeNodeModel.js';

export interface CreateAlbumTreeNodeInput {
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
  targetIndex?: number;
  semanticKind?: AlbumTreeNodeSemanticKind | null;
}

export type AlbumTreeNodeReorderDirection = 'up' | 'down';
const normalizedSortOrderStep = 10;

export class AlbumTreeSiblingLabelConflictError extends Error {
  constructor(label: string) {
    super(`A sibling node named "${label}" already exists.`);
    this.name = 'AlbumTreeSiblingLabelConflictError';
  }
}

function normalizeAlbumTreeLabel(label: string): string {
  return label.trim().toLocaleLowerCase();
}

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
  return insertNodeAtTypeBucketPosition(nodes, nextNode);
}

function insertNodeAtTypeBucketPosition(
  nodes: AlbumTreeNode[],
  nextNode: AlbumTreeNode,
  targetIndex?: number | null
): AlbumTreeNode[] {
  const orderedNodes = sortNodesForCustomBucketOrder(nodes);
  const groupCount = orderedNodes.filter((node) => node.nodeType === 'Group').length;
  const sameTypeCount = orderedNodes.filter((node) => node.nodeType === nextNode.nodeType).length;
  const normalizedTargetIndex =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, sameTypeCount))
      : sameTypeCount;
  const insertionIndex =
    nextNode.nodeType === 'Group' ? normalizedTargetIndex : groupCount + normalizedTargetIndex;

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

function assertNoSiblingLabelConflict(input: {
  siblings: AlbumTreeNode[];
  label: string;
  nodeType: AlbumTreeNodeType;
  excludeNodeId?: string;
}): void {
  const normalizedLabel = normalizeAlbumTreeLabel(input.label);
  const conflict = input.siblings.some(
    (sibling) =>
      sibling.id !== input.excludeNodeId &&
      sibling.nodeType === input.nodeType &&
      normalizeAlbumTreeLabel(sibling.label) === normalizedLabel
  );

  if (conflict) {
    throw new AlbumTreeSiblingLabelConflictError(input.label.trim());
  }
}

export async function syncAlbumTreeNodeIndexes(): Promise<void> {
  await AlbumTreeNodeModel.syncIndexes();
}

export async function listAlbumTreeNodes(): Promise<AlbumTreeNode[]> {
  return AlbumTreeNodeModel.find({}, { _id: 0 })
    .sort({ parentId: 1, sortOrder: 1, label: 1 })
    .lean<AlbumTreeNode[]>();
}

export async function listAlbumTreeNodesForCoverage(): Promise<
  Array<Pick<AlbumTreeNode, 'id' | 'label' | 'nodeType' | 'parentId' | 'sortOrder' | 'semanticKind'>>
> {
  return AlbumTreeNodeModel.find(
    {},
    {
      _id: 0,
      id: 1,
      label: 1,
      nodeType: 1,
      parentId: 1,
      sortOrder: 1,
      semanticKind: 1
    }
  )
    .sort({ parentId: 1, sortOrder: 1, label: 1 })
    .lean<Array<Pick<AlbumTreeNode, 'id' | 'label' | 'nodeType' | 'parentId' | 'sortOrder' | 'semanticKind'>>>();
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
  const trimmedLabel = input.label.trim();
  const newNode: AlbumTreeNode = {
    id: randomUUID(),
    label: trimmedLabel,
    nodeType: input.nodeType,
    parentId: input.parentId,
    sortOrder: 0,
    childOrderMode: null,
    semanticKind: input.semanticKind ?? null,
    createdAt: now,
    updatedAt: now
  };

  const siblings = await listSiblingNodes(input.parentId);
  assertNoSiblingLabelConflict({
    siblings,
    label: trimmedLabel,
    nodeType: input.nodeType
  });
  const previousNodesById = new Map(siblings.map((node) => [node.id, node]));
  const nextNodes = assignNormalizedSortOrders(
    insertNodeAtTypeBucketPosition(siblings, newNode, input.targetIndex)
  );
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
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node) {
    return null;
  }

  const trimmedLabel = label.trim();
  const siblings = await listSiblingNodes(node.parentId);
  assertNoSiblingLabelConflict({
    siblings,
    label: trimmedLabel,
    nodeType: node.nodeType,
    excludeNodeId: node.id
  });

  return AlbumTreeNodeModel.findOneAndUpdate(
    { id: nodeId },
    {
      $set: {
        label: trimmedLabel,
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: 'after', projection: { _id: 0 }, runValidators: true }
  ).lean<AlbumTreeNode | null>();
}

export async function updateAlbumTreeNodeChildOrderMode(
  nodeId: string,
  childOrderMode: AlbumTreeChildOrderMode
): Promise<AlbumTreeNode | null> {
  return AlbumTreeNodeModel.findOneAndUpdate(
    { id: nodeId, nodeType: 'Group' },
    {
      $set: {
        childOrderMode,
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: 'after', projection: { _id: 0 }, runValidators: true }
  ).lean<AlbumTreeNode | null>();
}

export async function moveAlbumTreeNode(
  nodeId: string,
  parentId: string | null,
  targetIndex?: number | null
): Promise<AlbumTreeNode | null> {
  const node = await findAlbumTreeNodeById(nodeId);
  if (!node) {
    return null;
  }

  const isSameParentMove = node.parentId === parentId;
  const sourceSiblings = await listSiblingNodes(node.parentId);
  const destinationSiblings = isSameParentMove ? sourceSiblings : await listSiblingNodes(parentId);

  assertNoSiblingLabelConflict({
    siblings: destinationSiblings,
    label: node.label,
    nodeType: node.nodeType,
    excludeNodeId: node.id
  });
  const now = new Date().toISOString();

  const destinationBaseNodes = destinationSiblings.filter((sibling) => sibling.id !== node.id);
  const destinationNode: AlbumTreeNode = {
    ...node,
    parentId
  };
  const normalizedDestinationNodes = assignNormalizedSortOrders(
    insertNodeAtTypeBucketPosition(destinationBaseNodes, destinationNode, targetIndex)
  );

  const previousNodesById = new Map([...sourceSiblings, ...destinationSiblings, node].map((existingNode) => [existingNode.id, existingNode]));
  const updateOperations = isSameParentMove
    ? buildUpdateOperationsForChangedNodes(previousNodesById, normalizedDestinationNodes, now)
    : [
        ...buildUpdateOperationsForChangedNodes(
          previousNodesById,
          assignNormalizedSortOrders(sortNodesForCustomBucketOrder(sourceSiblings.filter((sibling) => sibling.id !== node.id))),
          now
        ),
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
