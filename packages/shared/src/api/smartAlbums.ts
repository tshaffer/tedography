import type { SmartAlbum, SmartAlbumFilterSpec } from '@tedography/domain';

export interface CreateSmartAlbumRequest {
  label: string;
  filterSpec: SmartAlbumFilterSpec;
}

export interface CreateSmartAlbumResponse {
  item: SmartAlbum;
}

export interface ListSmartAlbumsResponse {
  items: SmartAlbum[];
}

export interface GetSmartAlbumResponse {
  item: SmartAlbum;
}

export interface UpdateSmartAlbumRequest {
  label?: string;
  filterSpec?: SmartAlbumFilterSpec;
}

export interface UpdateSmartAlbumResponse {
  item: SmartAlbum;
}

export interface DeleteSmartAlbumResponse {
  id: string;
}
