import { PhotoState } from '../enums/PhotoState.js';

export type SearchCaptureDateAvailabilityMode =
  | 'datedOnly'
  | 'datedOrUndated'
  | 'undatedOnly';

export interface SearchSpec {
  photoStates?: PhotoState[];
  albumIds?: string[];
  groupIds?: string[];
  peopleIds?: string[];
  peopleMatchMode?: 'any' | 'all';
  hasNoPeople?: boolean;
  hasReviewableFaces?: boolean;
  captureDateFrom?: string;
  captureDateTo?: string;
  captureDateAvailability?: SearchCaptureDateAvailabilityMode;
  published?: boolean;
}
