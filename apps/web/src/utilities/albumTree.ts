import type { AlbumTreeNode } from '@tedography/domain';

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
