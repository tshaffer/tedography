export interface EditHistoryEntry {
  id: string;
  sourceAssetId: string;
  sourceFilename: string;
  prompt: string;
  editedFilename: string;
  editedAssetId: string | null;
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  processedAt: string;
}
