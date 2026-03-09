import { MediaType } from '../enums/MediaType';
import { PhotoState } from '../enums/PhotoState';

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
