import type { PhotoState } from '../enums/PhotoState.js';

export interface SmartAlbumFilterSpec {
  keywordId?: string | null;
  photoState?: PhotoState | null;
  yearGroupId?: string | null;
}

export interface SmartAlbum {
  id: string;
  label: string;
  filterSpec: SmartAlbumFilterSpec;
  createdAt: string;
  updatedAt: string;
}
