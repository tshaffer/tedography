export type AlbumTreeNodeType = 'Group' | 'Album';
export type AlbumTreeChildOrderMode = 'Custom' | 'Name' | 'NumericThenName';
export type AlbumTreeNodeSemanticKind = 'YearGroup' | 'Miscellany';

export interface AlbumTreeNode {
  id: string;
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
  sortOrder: number;
  childOrderMode?: AlbumTreeChildOrderMode | null;
  semanticKind?: AlbumTreeNodeSemanticKind | null;
  createdAt: string;
  updatedAt: string;
}
