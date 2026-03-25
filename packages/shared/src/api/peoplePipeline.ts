import type {
  FaceDetection,
  FaceDetectionMatchStatus,
  FaceDetectionIgnoredReason,
  FaceMatchReview,
  MediaAsset,
  MediaAssetPerson,
  Person
} from '@tedography/domain';

export interface ListPeopleResponse {
  items: Person[];
}

export interface CreatePersonRequest {
  displayName: string;
  sortName?: string;
  aliases?: string[];
  notes?: string;
}

export interface CreatePersonResponse {
  item: Person;
}

export interface ListAssetFaceDetectionsResponse {
  assetId: string;
  detections: FaceDetection[];
  reviews: FaceMatchReview[];
  people: MediaAssetPerson[];
}

export interface PeopleReviewQueueItem {
  detection: FaceDetection;
  review: FaceMatchReview | null;
  asset: Pick<MediaAsset, 'id' | 'filename' | 'originalArchivePath' | 'captureDateTime' | 'photoState' | 'people'>;
  suggestedPerson: Person | null;
  matchedPerson: Person | null;
}

export interface ListPeopleReviewQueueResponse {
  items: PeopleReviewQueueItem[];
  counts: Record<FaceDetectionMatchStatus, number>;
}

export type PeopleReviewQueueSort =
  | 'newest'
  | 'highestConfidence'
  | 'lowestConfidence'
  | 'filename'
  | 'assetId';

export interface ListPeoplePipelineRecentAssetsResponse {
  items: Array<
    Pick<MediaAsset, 'id' | 'filename' | 'originalArchivePath' | 'captureDateTime' | 'importedAt' | 'photoState' | 'people'> & {
      detectionsCount: number;
      reviewableDetectionsCount: number;
      confirmedDetectionsCount: number;
    }
  >;
}

export interface PeoplePipelineSummaryResponse {
  config: {
    enabled: boolean;
    engine: string;
    pipelineVersion: string;
    thresholds: {
      minDetectionConfidence: number;
      minFaceAreaPercent: number;
      minCropWidthPx: number;
      minCropHeightPx: number;
      reviewThreshold: number;
      autoMatchThreshold: number;
    };
    engineConfig: {
      region?: string | null;
      collectionId?: string | null;
      maxResults?: number;
      faceMatchThreshold?: number | null;
    };
  };
  detectionCounts: Record<FaceDetectionMatchStatus, number>;
  reviewDecisionCounts: Record<FaceMatchReview['decision'], number>;
  totals: {
    peopleCount: number;
    detectionsCount: number;
    reviewsCount: number;
  };
}

export interface ProcessPeopleAssetRequest {
  force?: boolean;
}

export interface ProcessPeopleAssetResponse {
  assetId: string;
  processed: boolean;
  skippedReason?: string;
  engine: string;
  pipelineVersion: string;
  detectionsCreated: number;
  detections: FaceDetection[];
  reviews: FaceMatchReview[];
  people: MediaAssetPerson[];
}

export type ReviewFaceDetectionAction =
  | 'confirm'
  | 'reject'
  | 'assign'
  | 'createAndAssign'
  | 'ignore';

export interface ReviewFaceDetectionRequest {
  action: ReviewFaceDetectionAction;
  personId?: string;
  displayName?: string;
  reviewer?: string;
  notes?: string;
  ignoredReason?: FaceDetectionIgnoredReason;
}

export interface ReviewFaceDetectionResponse {
  detection: FaceDetection;
  review: FaceMatchReview;
  people: MediaAssetPerson[];
}

export interface EnrollPersonFromDetectionRequest {
  detectionId: string;
}

export interface EnrollPersonFromDetectionResponse {
  person: Person;
  detection: FaceDetection;
  subjectKey: string;
  exampleId?: string | null;
}
