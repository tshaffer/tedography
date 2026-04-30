import type { PhotoState } from '../enums/PhotoState.js';
import type { SearchCaptureDateAvailabilityMode } from '../types/SearchSpec.js';

export interface SmartAlbumFilterSpec {
  keywordId?: string | null;
  photoState?: PhotoState | null;
  yearGroupId?: string | null;
  peopleIds?: string[] | null;
  peopleMatchMode?: 'Any' | 'All' | null;
  excludedPeopleIds?: string[] | null;
  hasNoPeople?: boolean | null;
  captureDateFrom?: string | null;
  captureDateTo?: string | null;
  captureDateAvailability?: SearchCaptureDateAvailabilityMode | null;
}

export interface SmartAlbum {
  id: string;
  label: string;
  filterSpec: SmartAlbumFilterSpec;
  createdAt: string;
  updatedAt: string;
}
