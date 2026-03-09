export interface ExtractedMetadata {
  mimeType?: string;
  width?: number;
  height?: number;
  captureDateTime?: string;
}

export async function extractMetadata(_filePath: string): Promise<ExtractedMetadata> {
  return {};
}
