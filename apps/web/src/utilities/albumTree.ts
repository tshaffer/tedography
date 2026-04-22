import type { AlbumTreeChildOrderMode, AlbumTreeNode } from '@tedography/domain';

export type AlbumTreeSortMode = 'Custom' | 'Name' | 'Month/Name';

export type AlbumTreeNodeWithDepth = AlbumTreeNode & {
  depth: number;
};

const albumTreeNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

const numericLabelPrefixPattern = /^\s*(\d+)/;

const monthTokenToNumber = new Map<string, number>([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['sept', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12]
]);

type ParsedAlbumTreeLabelMonth = {
  month: number | null;
  year: number | null;
};

function compareAlbumTreeNodeNames(left: AlbumTreeNode, right: AlbumTreeNode): number {
  const labelComparison = albumTreeNameCollator.compare(left.label, right.label);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.id.localeCompare(right.id);
}

function compareAlbumTreeNodeNumericThenName(left: AlbumTreeNode, right: AlbumTreeNode): number {
  const leftNumericPrefix = numericLabelPrefixPattern.exec(left.label);
  const rightNumericPrefix = numericLabelPrefixPattern.exec(right.label);
  const leftNumericValue = leftNumericPrefix ? Number(leftNumericPrefix[1]) : null;
  const rightNumericValue = rightNumericPrefix ? Number(rightNumericPrefix[1]) : null;

  if (leftNumericValue !== null && rightNumericValue !== null) {
    if (leftNumericValue !== rightNumericValue) {
      return leftNumericValue - rightNumericValue;
    }
  } else if (leftNumericValue !== null || rightNumericValue !== null) {
    return leftNumericValue !== null ? -1 : 1;
  }

  return compareAlbumTreeNodeNames(left, right);
}

function compareAlbumTreeNodeTypes(left: AlbumTreeNode, right: AlbumTreeNode): number {
  if (left.nodeType === right.nodeType) {
    return 0;
  }

  return left.nodeType === 'Group' ? -1 : 1;
}

function parseAlbumTreeLabelMonth(label: string): ParsedAlbumTreeLabelMonth {
  const tokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let month: number | null = null;
  let year: number | null = null;

  for (const token of tokens) {
    if (month === null) {
      month = monthTokenToNumber.get(token) ?? null;
    }

    if (year === null && /^(19|20)\d{2}$/.test(token)) {
      year = Number(token);
    }

    if (month !== null && year !== null) {
      break;
    }
  }

  return { month, year };
}

function compareAlbumTreeNodes(
  left: AlbumTreeNode,
  right: AlbumTreeNode,
  sortMode: AlbumTreeSortMode
): number {
  if (sortMode === 'Custom') {
    const nodeTypeComparison = compareAlbumTreeNodeTypes(left, right);
    if (nodeTypeComparison !== 0) {
      return nodeTypeComparison;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return compareAlbumTreeNodeNames(left, right);
  }

  const nodeTypeComparison = compareAlbumTreeNodeTypes(left, right);
  if (nodeTypeComparison !== 0) {
    return nodeTypeComparison;
  }

  if (sortMode === 'Month/Name') {
    const leftMonth = parseAlbumTreeLabelMonth(left.label);
    const rightMonth = parseAlbumTreeLabelMonth(right.label);

    if (
      leftMonth.month !== null &&
      rightMonth.month !== null &&
      leftMonth.year !== null &&
      rightMonth.year !== null
    ) {
      if (leftMonth.year !== rightMonth.year) {
        return leftMonth.year - rightMonth.year;
      }

      if (leftMonth.month !== rightMonth.month) {
        return leftMonth.month - rightMonth.month;
      }
    } else if (leftMonth.month !== null && rightMonth.month !== null && leftMonth.month !== rightMonth.month) {
      return leftMonth.month - rightMonth.month;
    }
  }

  return compareAlbumTreeNodeNames(left, right);
}

export function getOrderedAlbumTreeSiblingsForCustomSort(
  nodes: AlbumTreeNode[],
  node: AlbumTreeNode
): AlbumTreeNode[] {
  return nodes
    .filter(
      (candidate) => candidate.parentId === node.parentId && candidate.nodeType === node.nodeType
    )
    .sort((left, right) => compareAlbumTreeNodes(left, right, 'Custom'));
}

export function getEffectiveGroupChildOrderMode(
  node: AlbumTreeNode | null | undefined
): AlbumTreeChildOrderMode {
  if (!node || node.nodeType !== 'Group') {
    return 'Custom';
  }

  return node.childOrderMode ?? 'Custom';
}

function compareAlbumChildrenForGroupMode(
  left: AlbumTreeNode,
  right: AlbumTreeNode,
  childOrderMode: AlbumTreeChildOrderMode
): number {
  if (childOrderMode === 'Custom') {
    return compareAlbumTreeNodes(left, right, 'Custom');
  }

  if (childOrderMode === 'NumericThenName') {
    return compareAlbumTreeNodeNumericThenName(left, right);
  }

  return compareAlbumTreeNodeNames(left, right);
}

function sortAlbumTreeChildrenForParent(
  nodesById: Map<string, AlbumTreeNode>,
  parentId: string | null,
  siblings: AlbumTreeNode[],
  sortMode: AlbumTreeSortMode
): AlbumTreeNode[] {
  if (parentId === null) {
    return [...siblings].sort((left, right) => compareAlbumTreeNodes(left, right, sortMode));
  }

  const parentNode = nodesById.get(parentId) ?? null;
  if (!parentNode || parentNode.nodeType !== 'Group') {
    return [...siblings].sort((left, right) => compareAlbumTreeNodes(left, right, sortMode));
  }

  const groupChildren = siblings
    .filter((node) => node.nodeType === 'Group')
    .sort((left, right) => compareAlbumTreeNodes(left, right, sortMode));
  const albumChildren = siblings
    .filter((node) => node.nodeType === 'Album')
    .sort((left, right) =>
      compareAlbumChildrenForGroupMode(left, right, getEffectiveGroupChildOrderMode(parentNode))
    );

  return [...groupChildren, ...albumChildren];
}

export function buildAlbumTreeDisplayList(
  nodes: AlbumTreeNode[],
  expandedGroupIds: string[],
  sortMode: AlbumTreeSortMode = 'Custom'
): AlbumTreeNodeWithDepth[] {
  const expandedSet = new Set(expandedGroupIds);
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  for (const [parentId, siblings] of childrenByParent.entries()) {
    childrenByParent.set(parentId, sortAlbumTreeChildrenForParent(nodesById, parentId, siblings, sortMode));
  }

  const ordered: AlbumTreeNodeWithDepth[] = [];

  function appendChildren(parentId: string | null, depth: number): void {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      ordered.push({ ...child, depth });
      if (child.nodeType === 'Group' && expandedSet.has(child.id)) {
        appendChildren(child.id, depth + 1);
      }
    }
  }

  appendChildren(null, 0);
  return ordered;
}

export function getDescendantAlbumIdsForGroupIds(
  nodes: AlbumTreeNode[],
  groupIds: string[]
): string[] {
  if (groupIds.length === 0) {
    return [];
  }

  const groupIdSet = new Set(groupIds);
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  const descendantAlbumIds = new Set<string>();

  function visit(parentId: string): void {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      if (child.nodeType === 'Album') {
        descendantAlbumIds.add(child.id);
        continue;
      }

      visit(child.id);
    }
  }

  for (const groupId of groupIdSet) {
    visit(groupId);
  }

  return Array.from(descendantAlbumIds);
}
