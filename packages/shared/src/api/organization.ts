export type YearAlbumCoverageDiagnosticType =
  | 'only-in-miscellany'
  | 'not-in-any-non-miscellany'
  | 'in-non-miscellany';

export type YearAlbumCoverageRecognitionMode = 'explicit' | 'inferred-label';
export type YearAlbumCoverageMiscellanyDetectionMode = 'explicit' | 'inferred-label' | 'none';

export interface YearAlbumCoverageMetadata {
  yearGroupRecognitionMode: YearAlbumCoverageRecognitionMode;
  hasMiscellanyAlbum: boolean;
  miscellanyDetectionMode: YearAlbumCoverageMiscellanyDetectionMode;
  multipleMiscellanyCandidatesDetected: boolean;
  selectedMiscellanyAlbumId?: string;
  ignoredMiscellanyCandidateAlbumIds?: string[];
}

export interface YearAlbumCoverageSummary {
  yearGroupId: string;
  yearLabel: string;
  metadata: YearAlbumCoverageMetadata;
  totalAssetsInYear: number;
  assetsInMiscellany: number;
  assetsOnlyInMiscellany: number;
  assetsNotInAnyNonMiscellanyAlbum: number;
  assetsInOneOrMoreNonMiscellanyAlbums: number;
}

export interface YearAlbumCoverageMembershipItem {
  albumId: string;
  albumLabel: string;
  isMiscellany: boolean;
}

export interface YearAlbumCoverageAssetItem {
  mediaAssetId: string;
  filename?: string;
  captureDateTime?: string | null;
  membershipsInYear: YearAlbumCoverageMembershipItem[];
  nonMiscellanyAlbumCountInYear: number;
  isInMiscellany: boolean;
  isOnlyInMiscellany: boolean;
  isInAnyNonMiscellanyAlbum: boolean;
}

export interface YearAlbumCoverageResult {
  yearGroupId: string;
  yearLabel: string;
  metadata: YearAlbumCoverageMetadata;
  diagnosticType: YearAlbumCoverageDiagnosticType;
  totalCount: number;
  items: YearAlbumCoverageAssetItem[];
}
