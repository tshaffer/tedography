import { PhotoState } from '../enums/PhotoState';

export interface SearchSpec {
  photoStates?: PhotoState[];
  albumIds?: string[];
  peopleIds?: string[];
  captureDateFrom?: string;
  captureDateTo?: string;
  published?: boolean;
}
