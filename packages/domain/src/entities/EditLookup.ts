import type { EditType } from '../enums/EditType.js';

// Which part of a photo's record the search text matched.
export type EditLookupMatchField = 'filename' | 'editedFilename' | 'folder' | 'album' | 'note';

export interface EditLookupQueueInfo {
  editType: EditType;
  note: string;
  createdAt: string;
}

export interface EditLookupHistoryItem {
  id: string;
  editedFilename: string;
  editedAssetId: string | null;
  editMethod?: 'ai' | 'manual';
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  note: string;
  processedAt: string;
  // True when the entry has been moved into an Edit History archive.
  archived: boolean;
}

// One source photo, with its Edit Queue status and every Edit History entry for it.
export interface EditLookupResult {
  assetId: string;
  filename: string;
  // False when the source photo no longer exists (e.g. it was trashed) — only history remains.
  assetExists: boolean;
  // Folder of the original file inside its storage root (null when the photo is gone).
  folder: string | null;
  albumId: string | null;
  albumPath: string | null;
  queue: EditLookupQueueInfo | null;
  history: EditLookupHistoryItem[];
  matchedOn: EditLookupMatchField[];
}

export interface EditLookupResponse {
  query: string;
  results: EditLookupResult[];
  totalMatches: number;
  truncated: boolean;
}
