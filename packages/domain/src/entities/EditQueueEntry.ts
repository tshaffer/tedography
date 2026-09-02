import type { EditType } from '../enums/EditType.js';

export interface EditQueueEntry {
  id: string;
  assetId: string;
  note: string;
  editType: EditType;
  createdAt: string;
  // Set to the imported edited asset's id once Import Edited Files succeeds for this entry.
  editedAssetId?: string | null;
}
