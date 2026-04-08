import type { MediaAsset } from '@tedography/domain';

export interface UnknownCaptureReviewMatch {
  sidecarPath: string;
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  verifiedDimensions: boolean;
  hasStructuredPhotoTakenTime: boolean;
  hasExactUnknownCapturePhotoTakenTime: boolean;
  photoTakenTime?: unknown;
}

export interface UnknownCaptureReviewAsset {
  asset: Pick<
    MediaAsset,
    'id' | 'filename' | 'mediaType' | 'photoState' | 'captureDateTime' | 'width' | 'height' | 'originalArchivePath'
  >;
  basenameMatchedSidecarCount: number;
  verifiedMatchCount: number;
  possibleUnconfirmedDuplicate: boolean;
  confirmedSuppressedDuplicate: boolean;
}

export interface UnknownCaptureReviewGroup {
  key: string;
  verifiedMatchCount: number;
  sharedVerifiedMatches: UnknownCaptureReviewMatch[];
  assets: UnknownCaptureReviewAsset[];
  relatedTedographyAssets: UnknownCaptureReviewAsset[];
}

export interface ListUnknownCaptureReviewGroupsResponse {
  runsRoot: string;
  assetCount: number;
  groupCount: number;
  groups: UnknownCaptureReviewGroup[];
}
