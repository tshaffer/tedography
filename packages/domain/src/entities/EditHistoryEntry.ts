export interface EditHistoryEntry {
  id: string;
  sourceAssetId: string;
  sourceFilename: string;
  note: string;
  editedFilename: string;
  editedAssetId: string | null;
  // How this edit was produced. Optional since entries created before this field existed won't have it.
  editMethod?: 'ai' | 'manual';
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  processedAt: string;
  // Set when this entry has been archived. Null means active (visible in main history).
  archiveId?: string | null;
}
