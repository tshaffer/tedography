export interface EditHistoryEntry {
  id: string;
  sourceAssetId: string;
  sourceFilename: string;
  note: string;
  editedFilename: string;
  editedAssetId: string | null;
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  processedAt: string;
}
