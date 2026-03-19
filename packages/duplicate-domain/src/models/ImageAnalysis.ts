export type NormalizedFingerprintStatus = 'pending' | 'ready' | 'failed';
export type AnalysisSourceType = 'original' | 'derived-jpeg';

export interface ImageAnalysisRecord {
  assetId: string;
  analysisVersion: string;
  width?: number;
  height?: number;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: AnalysisSourceType;
  analysisSourcePath?: string;
  decodeStrategy?: string;
  normalizedFingerprintStatus: NormalizedFingerprintStatus;
  errorMessage?: string;
  computedAt: Date;
  sourceUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DuplicateCandidateRecord {
  assetId: string;
  otherAssetId: string;
  analysisVersion: string;
  dHashDistance?: number;
  pHashDistance?: number;
  score?: number;
}
