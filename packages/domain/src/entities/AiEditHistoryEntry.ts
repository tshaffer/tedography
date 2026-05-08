export interface AiEditHistoryEntry {
  id: string;
  sourceAssetId: string;
  sourceFilename: string;
  prompt: string;
  generatedFilename: string;
  generatedAssetId: string | null;
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  processedAt: string;
}
