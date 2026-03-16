import { MediaType } from '../enums/MediaType.js';

export interface StorageRootDto {
  id: string;
  label: string;
  isAvailable: boolean;
}

export interface GetStorageRootsResponse {
  storageRoots: StorageRootDto[];
}

export interface BrowseDirectoryRequest {
  rootId: string;
  relativePath?: string;
}

export interface BrowseDirectoryEntryDto {
  name: string;
  relativePath: string;
  modifiedAt?: string;
}

export interface BrowseFileEntryDto {
  name: string;
  relativePath: string;
  extension: string | null;
  sizeBytes: number;
  modifiedAt: string;
  isSupportedMedia: boolean;
  mediaType: MediaType | 'Unknown';
}

export interface BrowseDirectoryResponse {
  root: {
    id: string;
    label: string;
  };
  currentRelativePath: string;
  parentRelativePath: string | null;
  directories: BrowseDirectoryEntryDto[];
  files: BrowseFileEntryDto[];
}

export interface ImportApiErrorResponse {
  error: string;
}

export interface ScanImportRequest {
  rootId: string;
  relativePath: string;
}

export type ScanFileStatus =
  | 'Importable'
  | 'AlreadyImportedByPath'
  | 'DuplicateByContentHash'
  | 'Unsupported'
  | 'Missing';

export interface ScanSummaryDto {
  totalFilesystemEntriesSeen: number;
  totalFilesSeen: number;
  supportedMediaFileCount: number;
  unsupportedFileCount: number;
  alreadyImportedPathCount: number;
  duplicateContentCount: number;
  importableCount: number;
}

export interface ScannedCandidateFileDto {
  relativePath: string;
  filename: string;
  extension: string | null;
  sizeBytes: number;
  modifiedAt: string;
  mediaType: MediaType | 'Unknown';
  isSupportedMedia: boolean;
  alreadyImportedByPath: boolean;
  duplicateByContentHash: boolean;
  existingAssetIdByPath?: string;
  existingAssetIdByContentHash?: string;
  status: ScanFileStatus;
  captureDateTime?: string | null;
  width?: number | null;
  height?: number | null;
  locationLabel?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  contentHash?: string | null;
  requiresDerivedDisplayFile?: boolean;
}

export interface ScanImportResponse {
  root: {
    id: string;
    label: string;
  };
  scanTargetRelativePath: string;
  summary: ScanSummaryDto;
  files: ScannedCandidateFileDto[];
}

export interface RegisterImportFileRequest {
  relativePath: string;
}

export interface RegisterImportRequest {
  rootId: string;
  files: RegisterImportFileRequest[];
}

export type RegisterImportFileStatus =
  | 'Imported'
  | 'AlreadyImportedByPath'
  | 'DuplicateByContentHash'
  | 'Unsupported'
  | 'Missing'
  | 'Error';

export interface RegisteredAssetDto {
  id: string;
  filename: string;
  relativePath: string;
}

export interface RegisterImportFileResultDto {
  relativePath: string;
  status: RegisterImportFileStatus;
  asset?: RegisteredAssetDto;
  message?: string;
}

export interface RegisterImportResponse {
  importedCount: number;
  skippedAlreadyImportedByPathCount: number;
  skippedDuplicateContentCount: number;
  unsupportedCount: number;
  missingCount: number;
  errorCount: number;
  results: RegisterImportFileResultDto[];
}

export interface RefreshFolderRequest {
  rootId: string;
  relativePath: string;
}

export type VerifyProblemCategory =
  | 'MissingOriginalFile'
  | 'MissingDisplayFile'
  | 'MissingThumbnailFile'
  | 'InvalidOriginalReference'
  | 'InvalidDisplayReference'
  | 'InvalidThumbnailReference'
  | 'MissingStorageRoot'
  | 'FileSizeMismatch'
  | 'Other';

export interface VerifyKnownAssetsInFolderResultDto {
  assetId: string;
  filename: string;
  relativePath: string;
  status: 'Healthy' | 'ProblemsFound';
  problemCategories: VerifyProblemCategory[];
  message?: string;
}

export interface VerifyKnownAssetsInFolderSummaryDto {
  totalKnownAssetsChecked: number;
  healthyAssets: number;
  assetsWithProblems: number;
  missingThumbnailCount: number;
  missingDisplayCount: number;
  sourceMissingCount: number;
  invalidReferenceCount: number;
  missingStorageRootCount: number;
  fileSizeMismatchCount: number;
  otherProblemCount: number;
}

export interface VerifyKnownAssetsInFolderResponse {
  operation: 'VerifyKnownAssetsInFolder';
  root: {
    id: string;
    label: string;
  };
  scanTargetRelativePath: string;
  summary: VerifyKnownAssetsInFolderSummaryDto;
  results: VerifyKnownAssetsInFolderResultDto[];
}

export type RefreshOperationType =
  | 'ReimportKnownAssetsInFolder'
  | 'RebuildDerivedFilesInFolder'
  | 'ReimportAsset'
  | 'RebuildDerivedFiles';

export type RefreshResultStatus =
  | 'Reimported'
  | 'RebuiltDerivedFiles'
  | 'SourceMissing'
  | 'Skipped'
  | 'Error';

export interface RefreshResultDto {
  assetId?: string;
  filename: string;
  relativePath: string;
  status: RefreshResultStatus;
  message?: string;
}

export interface RefreshSummaryDto {
  totalCandidates: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
  sourceMissingCount: number;
  reimportedCount: number;
  rebuiltCount: number;
}

export interface RefreshOperationResponse {
  operation: RefreshOperationType;
  root?: {
    id: string;
    label: string;
  };
  scanTargetRelativePath?: string;
  summary: RefreshSummaryDto;
  results: RefreshResultDto[];
}
