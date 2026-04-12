import { PhotoState } from '../enums/PhotoState.js';

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
  includeNoCaptureDate?: boolean;
  published?: boolean;
}
