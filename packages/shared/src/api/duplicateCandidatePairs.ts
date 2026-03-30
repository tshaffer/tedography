import { type MediaType } from '@tedography/domain';
import { type DisplayStorageType } from '@tedography/domain';
import { type PhotoState } from '@tedography/domain';

export type DuplicateCandidateClassification =
  | 'very_likely_duplicate'
  | 'possible_duplicate'
  | 'similar_image';

export type DuplicateCandidateStatus = 'unreviewed' | 'ignored' | 'reviewed';

export type DuplicateCandidateReviewOutcome =
  | 'confirmed_duplicate'
  | 'not_duplicate'
  | 'ignored';

export type DuplicateCandidateOutcomeFilter =
  | DuplicateCandidateReviewOutcome
  | 'none';

export type DuplicateCandidateReviewDecision =
  | 'confirmed_duplicate'
  | 'not_duplicate'
  | 'ignored'
  | 'reviewed_uncertain'
  | 'confirmed_duplicate_keep_both'
  | 'confirmed_duplicate_keep_left'
  | 'confirmed_duplicate_keep_right';

export type DuplicateGroupResolutionStatus = 'proposed' | 'confirmed';
export type DuplicateGroupSortMode = 'unresolved_first' | 'size_asc' | 'size_desc';
export type DuplicateProvisionalGroupReviewStatus = 'unresolved' | 'resolved' | 'needs_rereview';
export type DuplicateProvisionalGroupMemberDecision = 'keeper' | 'duplicate' | 'not_in_group' | 'unclassified';

export interface DuplicateCandidatePairAssetSummary {
  id: string;
  filename: string;
  mediaType: MediaType;
  originalArchivePath: string | null;
  captureDateTime?: string | null;
  width?: number | null;
  height?: number | null;
  photoState?: PhotoState;
  originalFileFormat?: string;
  originalFileSizeBytes?: number;
  displayStorageType?: DisplayStorageType;
}

export interface DuplicateCandidateSignals {
  dHashDistance?: number;
  pHashDistance?: number;
  dimensionsSimilarity?: number;
  aspectRatioDelta?: number;
  sourceUpdatedTimeDeltaMs?: number;
}

export interface DuplicateCandidatePairListItem {
  pairKey: string;
  assetIdA: string;
  assetIdB: string;
  analysisVersion: string;
  generationVersion: string;
  score: number;
  classification: DuplicateCandidateClassification;
  status: DuplicateCandidateStatus;
  outcome?: DuplicateCandidateReviewOutcome | null;
  signals: DuplicateCandidateSignals;
  createdAt?: string;
  updatedAt?: string;
  assetA: DuplicateCandidatePairAssetSummary | null;
  assetB: DuplicateCandidatePairAssetSummary | null;
}

export interface ListDuplicateCandidatePairsResponse {
  items: DuplicateCandidatePairListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface GetDuplicateCandidatePairResponse {
  item: DuplicateCandidatePairListItem;
}

export interface UpdateDuplicateCandidatePairReviewRequest {
  decision: DuplicateCandidateReviewDecision;
}

export interface UpdateDuplicateCandidatePairReviewResponse {
  item: DuplicateCandidatePairListItem;
}

export interface DuplicateCandidatePairSummaryResponse {
  total: number;
  highConfidenceCount: number;
  classificationCounts: Record<DuplicateCandidateClassification, number>;
  statusCounts: Record<DuplicateCandidateStatus, number>;
  outcomeCounts: Record<DuplicateCandidateOutcomeFilter, number>;
}

export interface DuplicateGroupListItem {
  groupId: string;
  groupKey: string;
  assetIds: string[];
  assetCount: number;
  confirmedPairCount: number;
  assets: DuplicateCandidatePairAssetSummary[];
  proposedCanonicalAssetId: string;
  selectedCanonicalAssetId: string;
  manualCanonicalAssetId?: string | null;
  resolutionStatus: DuplicateGroupResolutionStatus;
  nonCanonicalAssetIds: string[];
  canonicalReasonSummary: string[];
}

export interface DuplicateGroupListSummary {
  statusCounts: Record<DuplicateGroupResolutionStatus, number>;
  exactPairGroupCount: number;
  readyToConfirmCount: number;
}

export interface ListDuplicateGroupsResponse {
  groups: DuplicateGroupListItem[];
  totalGroups: number;
  totalAssets: number;
  summary: DuplicateGroupListSummary;
}

export interface DuplicateGroupMemberHistoricalCounts {
  keeperCount: number;
  duplicateCount: number;
  notDuplicateCount: number;
}

export interface ProvisionalDuplicateGroupMember {
  asset: DuplicateCandidatePairAssetSummary;
  historicalCounts?: DuplicateGroupMemberHistoricalCounts;
  currentDecision?: DuplicateProvisionalGroupMemberDecision;
}

export interface ProvisionalDuplicateGroupListItem {
  groupKey: string;
  assetIds: string[];
  assetCount: number;
  candidatePairCount: number;
  reviewStatus: DuplicateProvisionalGroupReviewStatus;
  selectedCanonicalAssetId?: string | null;
  resolutionStatus?: DuplicateGroupResolutionStatus | null;
  members: ProvisionalDuplicateGroupMember[];
}

export interface ListProvisionalDuplicateGroupsResponse {
  groups: ProvisionalDuplicateGroupListItem[];
  totalGroups: number;
  totalAssets: number;
}

export interface GetProvisionalDuplicateGroupResponse {
  group: ProvisionalDuplicateGroupListItem;
}
