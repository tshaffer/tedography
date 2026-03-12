export type AlbumTreeNodeType = 'Group' | 'Album';

export interface AlbumTreeNode {
  id: string;
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
