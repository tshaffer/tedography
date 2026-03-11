import { MediaType } from '../enums/MediaType.js';
import { PhotoState } from '../enums/PhotoState.js';

export interface MediaAsset {
  id: string;
  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime: string;
  storageRootId?: string;
  archivePath?: string;
  fileSizeBytes?: number;
  contentHash?: string;
  importedAt?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}
