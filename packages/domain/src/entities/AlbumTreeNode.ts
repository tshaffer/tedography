import type { AlbumKeywordAssignmentStatus, AlbumPeopleAssignmentStatus, AlbumReviewAssignmentStatus } from '../enums/KeywordAssignmentStatus.js';

export type AlbumTreeNodeType = 'Group' | 'Album';
export type AlbumTreeChildOrderMode = 'Custom' | 'Name' | 'NumericThenName';

export interface AlbumTreeNode {
  id: string;
  label: string;
  nodeType: AlbumTreeNodeType;
  parentId: string | null;
  sortOrder: number;
  childOrderMode?: AlbumTreeChildOrderMode | null;
  keywordAssignmentStatus?: AlbumKeywordAssignmentStatus | null;
  reviewAssignmentStatus?: AlbumReviewAssignmentStatus | null;
  peopleAssignmentStatus?: AlbumPeopleAssignmentStatus | null;
  /** User IDs granted write access to this album (used for 'per-album' permission checks) */
  writerUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}
