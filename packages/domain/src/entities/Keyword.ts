export interface Keyword {
  id: string;
  label: string;
  normalizedLabel: string;
  parentKeywordId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordTreeNode {
  id: string;
  label: string;
  normalizedLabel: string;
  parentKeywordId: string | null;
  children: KeywordTreeNode[];
  createdAt: string;
  updatedAt: string;
}
