export type YearAlbumCoverageDiagnosticType =
  | 'only-in-miscellany'
  | 'not-in-any-non-miscellany'
  | 'in-non-miscellany';

export interface YearAlbumCoverageSummary {
  yearGroupId: string;
  yearLabel: string;
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
  diagnosticType: YearAlbumCoverageDiagnosticType;
  totalCount: number;
  items: YearAlbumCoverageAssetItem[];
}
