import { MediaType } from '../enums/MediaType.js';
import { PhotoState } from '../enums/PhotoState.js';

export interface MediaAsset {
  id: string;
  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}
