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

export interface UnknownCaptureReviewItem {
  asset: Pick<
    MediaAsset,
    'id' | 'filename' | 'mediaType' | 'photoState' | 'captureDateTime' | 'width' | 'height' | 'originalArchivePath'
  >;
  basenameMatchedSidecarCount: number;
  verifiedMatchCount: number;
  possibleUnconfirmedDuplicate: boolean;
  matches: UnknownCaptureReviewMatch[];
}

export interface ListUnknownCaptureReviewItemsResponse {
  runsRoot: string;
  itemCount: number;
  items: UnknownCaptureReviewItem[];
}
