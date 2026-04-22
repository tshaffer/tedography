import type { FaceBoundingBox } from '@tedography/domain';

export interface PersonPhotoByEstimatedAgeResponseItem {
  mediaAssetId: string;
  detectedFaceId: string;
  estimatedAgeMidpoint: number;
  ageRangeLow: number | null;
  ageRangeHigh: number | null;
  boundingBox: FaceBoundingBox;
  personId: string;
  personFaceCountInAsset?: number;
}

export interface GetPersonPhotosResponse {
  personId: string;
  sortBy: 'estimatedAge';
  sortDirection: 'asc' | 'desc';
  uniquePhotosOnly: boolean;
  items: PersonPhotoByEstimatedAgeResponseItem[];
}
