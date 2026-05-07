export type KeywordChangeAction = 'added' | 'removed';

export interface KeywordChangeEvent {
  id: string;
  assetId: string;
  keywordId: string;
  action: KeywordChangeAction;
  changedAt: string;
}
