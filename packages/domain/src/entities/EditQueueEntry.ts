export interface EditQueueEntry {
  id: string;
  assetId: string;
  prompt: string;
  createdAt: string;
  // Set to the imported edited asset's id once Import Edited Files succeeds for this entry.
  editedAssetId?: string | null;
}
