import type { Keyword, KeywordTreeNode, MediaAsset } from '@tedography/domain';

export interface CreateKeywordRequest {
  label: string;
  parentKeywordId?: string | null;
}

export interface CreateKeywordResponse {
  item: Keyword;
}

export interface ListKeywordsResponse {
  items: Keyword[];
}

export interface ListKeywordTreeResponse {
  items: KeywordTreeNode[];
}

export interface UpdateKeywordParentRequest {
  parentKeywordId?: string | null;
}

export interface UpdateKeywordParentResponse {
  item: Keyword;
}

export interface UpdateKeywordLabelRequest {
  label: string;
}

export interface UpdateKeywordLabelResponse {
  item: Keyword;
}

export interface ListAssetKeywordsResponse {
  assetId: string;
  items: Keyword[];
}

export interface UpdateAssetKeywordsRequest {
  assetIds: string[];
  keywordIds: string[];
}

export interface UpdateAssetKeywordsResponse {
  assetIds: string[];
  keywordIds: string[];
}

export interface DeleteKeywordResponse {
  deletedIds: string[];
}

export interface ListKeywordAssetsResponse {
  keyword: Keyword;
  items: Array<
    Pick<
      MediaAsset,
      | 'id'
      | 'filename'
      | 'mediaType'
      | 'photoState'
      | 'captureDateTime'
      | 'importedAt'
      | 'albumIds'
      | 'keywordIds'
    >
  >;
}
