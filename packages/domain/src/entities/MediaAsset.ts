import { MediaType } from '../enums/MediaType.js';
import { PhotoState } from '../enums/PhotoState.js';

export interface MediaAsset {
  id: string;
  contentHash: string;
  mediaType: MediaType;
  captureDateTime?: string;
  photoState: PhotoState;
  pendingGroupId?: string;
  albumIds: string[];
  peopleIds: string[];
}
