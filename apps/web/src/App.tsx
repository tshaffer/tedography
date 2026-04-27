import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import GridViewIcon from '@mui/icons-material/GridView';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeselectIcon from '@mui/icons-material/Deselect';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import TuneIcon from '@mui/icons-material/Tune';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  type AlbumTreeChildOrderMode,
  MediaType,
  type Person,
  PhotoState,
  normalizePhotoState,
  type AlbumTreeNode,
  type Keyword,
  type MediaAsset,
  type SmartAlbum,
  type SmartAlbumFilterSpec,
  type SearchCaptureDateAvailabilityMode
} from '@tedography/domain';
import {
  addAssetsToAlbum,
  createAlbumTreeNode,
  deleteAlbumTreeNode,
  listAlbumTreeNodes,
  moveAssetsToAlbum as moveAssetsToAlbumRequest,
  moveAlbumTreeNode,
  reorderAlbumTreeNode,
  removeAssetsFromAlbum,
  renameAlbumTreeNode,
  updateAlbumTreeChildOrderMode,
  updateAlbumManualOrder,
  updateAlbumOrderingMode
} from './api/albumTreeApi';
import {
  rebuildAssetDerivedFiles,
  reimportAsset,
  rotateAssetClockwise,
  rotateAssetCounterclockwise,
  rotateAsset180,
  updateAssetsCaptureDateTime
} from './api/assetApi';
import {
  addKeywordsToAssets as addKeywordsToAssetsRequest,
  createKeyword as createKeywordRequest,
  listKeywords as listKeywordsRequest,
  removeKeywordsFromAssets as removeKeywordsFromAssetsRequest
} from './api/keywordApi';
import {
  createSmartAlbum as createSmartAlbumRequest,
  listSmartAlbums as listSmartAlbumsRequest
} from './api/smartAlbumApi';
import {
  getPeoplePipelineAssetState,
  getPeopleScopedAssetSummary,
  listPeople,
  processPeopleAsset,
  type PeopleScopedAssetSummaryResponse
} from './api/peoplePipelineApi';
import { MoveAlbumTreeNodeDialog } from './components/albums/MoveAlbumTreeNodeDialog';
import { MoveAssetsToAlbumDialog } from './components/albums/MoveAssetsToAlbumDialog';
import { CreateTopLevelGroupDialog } from './components/albums/CreateTopLevelGroupDialog';
import { AssetDetailsPanel } from './components/assets/AssetDetailsPanel';
import { AssetFilmstrip } from './components/assets/AssetFilmstrip';
import { AssetKeywordsPanel } from './components/assets/AssetKeywordsPanel';
import { AssetQuickBar } from './components/assets/AssetQuickBar';
import { SetCaptureDateDialog } from './components/assets/SetCaptureDateDialog';
import {
  ImportAssetsDialog,
  type ImportAssetsDialogInitialAlbumDestination
} from './components/import/ImportAssetsDialog';
import { MaintenanceDialog } from './components/maintenance/MaintenanceDialog';
import { AssetPeopleReviewDialog } from './components/people/AssetPeopleReviewDialog';
import { ScopedPeopleMaintenanceDialog } from './components/people/ScopedPeopleMaintenanceDialog';
import { sortVisibleAssetsForTimeline } from './utilities/groupAssetsByDate';
import {
  collectKeywordDescendantIds,
  formatKeywordPathLabel,
  sortKeywordsByPath
} from './utilities/keywords';
import { prefetchImage } from './utilities/imagePrefetch';
import {
  buildTimelineNavigationYears,
  groupAssetsByCaptureMonth,
  type TimelineMonthGroup,
  type TimelineNavigationYear
} from './utilities/libraryTimeline';
import {
  type AlbumTreeNodeWithDepth,
  type AlbumTreeSortMode,
  buildAlbumTreeDisplayList,
  getDescendantAlbumIdsForGroupIds,
  getEffectiveGroupChildOrderMode,
  getOrderedAlbumTreeSiblingsForCustomSort
} from './utilities/albumTree';
import { getDisplayMediaUrl, getThumbnailMediaUrl } from './utilities/mediaUrls';
import {
  formatAlbumOrderingModeLabel,
  getAlbumOrderingModeInAlbum,
  isForcedManualOrderInAlbum,
  isManualOrderEligibleInAlbum,
  sortAssetsForSmartAlbumOrder,
  usesCaptureTimeOrderInAlbum
} from './utilities/smartAlbumOrder';
import type { ListAssetFaceDetectionsResponse } from '@tedography/shared';

const photoStateFilterOptions: PhotoState[] = [
  PhotoState.New,
  PhotoState.Pending,
  PhotoState.Keep,
  PhotoState.Discard
];

const mediaTypeFilterOptions: MediaType[] = [MediaType.Photo, MediaType.Video];
const advanceAfterRatingStorageKey = 'tedography.advanceAfterRating';
const checkedAlbumIdsStorageKey = 'tedography.checkedAlbumIds';
const expandedAlbumTreeGroupIdsStorageKey = 'tedography.expandedAlbumTreeGroupIds';
const primaryAreaStorageKey = 'tedography.primaryArea';
const libraryBrowseModeStorageKey = 'tedography.libraryBrowseMode';
const reviewBrowseModeStorageKey = 'tedography.reviewBrowseMode';
const timelineNavExpandedYearKeysStorageKey = 'tedography.timelineNavExpandedYears';
const albumResultsPresentationStorageKey = 'tedography.albumResultsPresentation';
const albumTreeSortModeStorageKey = 'tedography.albumTreeSortMode';
const searchPhotoStatesStorageKey = 'tedography.search.photoStates';
const searchAlbumIdsStorageKey = 'tedography.search.albumIds';
const searchGroupIdsStorageKey = 'tedography.search.groupIds';
const searchFilenamePatternStorageKey = 'tedography.search.filenamePattern';
const searchCaptureDateFromStorageKey = 'tedography.search.captureDateFrom';
const searchCaptureDateToStorageKey = 'tedography.search.captureDateTo';
const searchCaptureDateAvailabilityStorageKey = 'tedography.search.captureDateAvailability';
const searchIncludeNoCaptureDateStorageKey = 'tedography.search.includeNoCaptureDate';
const searchPeopleIdsStorageKey = 'tedography.search.peopleIds';
const searchPeopleMatchModeStorageKey = 'tedography.search.peopleMatchMode';
const searchHasNoPeopleStorageKey = 'tedography.search.hasNoPeople';
const searchHasReviewableFacesStorageKey = 'tedography.search.hasReviewableFaces';
const searchKeywordIdStorageKey = 'tedography.search.keywordId';
const recentKeywordIdsStorageKey = 'tedography.keywords.recent';

function normalizeKeywordLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function readRecentKeywordIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(recentKeywordIdsStorageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function isYearGroupNode(node: AlbumTreeNode): boolean {
  return node.nodeType === 'Group' && /^\d{4}$/.test(node.label.trim());
}

function normalizeSmartAlbumSaveLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

function normalizeSmartAlbumFilterSpecForComparison(
  filterSpec: SmartAlbumFilterSpec
): SmartAlbumFilterSpec {
  return {
    keywordId:
      typeof filterSpec.keywordId === 'string' && filterSpec.keywordId.trim().length > 0
        ? filterSpec.keywordId.trim()
        : null,
    photoState: filterSpec.photoState ?? null,
    yearGroupId:
      typeof filterSpec.yearGroupId === 'string' && filterSpec.yearGroupId.trim().length > 0
        ? filterSpec.yearGroupId.trim()
        : null
  };
}

function smartAlbumFilterSpecsEqual(
  left: SmartAlbumFilterSpec,
  right: SmartAlbumFilterSpec
): boolean {
  const normalizedLeft = normalizeSmartAlbumFilterSpecForComparison(left);
  const normalizedRight = normalizeSmartAlbumFilterSpecForComparison(right);

  return (
    normalizedLeft.keywordId === normalizedRight.keywordId &&
    normalizedLeft.photoState === normalizedRight.photoState &&
    normalizedLeft.yearGroupId === normalizedRight.yearGroupId
  );
}
const timelineZoomLevelStorageKey = 'tedography.timelineZoomLevel';
const detailsPanelsVisibleStorageKey = 'tedography.detailsPanelsVisible';
const leftPanelVisibleStorageKey = 'tedography.leftPanelVisible';
const reviewVisiblePhotoStatesStorageKey = 'tedography.reviewVisiblePhotoStates';
const libraryVisiblePhotoStatesStorageKey = 'tedography.libraryVisiblePhotoStates';
const showFilmstripStorageKey = 'tedography.showFilmstrip';
const showThumbnailPhotoStateBadgesStorageKey = 'tedography.showThumbnailPhotoStateBadges';
const assetsBootstrapStorageKey = 'tedography.bootstrap.assets';
const albumTreeBootstrapStorageKey = 'tedography.bootstrap.albumTreeNodes';
const scopedPeopleReviewAssetIdsStorageKey = 'tedography.people.review.scopeAssetIds';

type TedographyPrimaryArea = 'Review' | 'Library' | 'Albums' | 'Search' | 'Maintenance';
type LibraryBrowseMode = 'Flat' | 'Timeline' | 'Albums';
type ReviewBrowseMode = 'Flat' | 'Timeline' | 'Albums';
type AlbumResultsPresentation = 'Merged' | 'GroupedByAlbum';
type ViewerMode = 'Grid' | 'Loupe';
type SurveyLayoutMode = 'landscape' | 'portrait';
type SearchPeopleMatchMode = 'Any' | 'All';

type SearchFilters = {
  photoStates: PhotoState[];
  albumIds: string[];
  groupIds: string[];
  filenamePattern: string;
  captureDateFrom: string;
  captureDateTo: string;
  captureDateAvailability: SearchCaptureDateAvailabilityMode;
  peopleIds: string[];
  peopleMatchMode: SearchPeopleMatchMode;
  hasNoPeople: boolean;
  hasReviewableFaces: boolean;
  keywordId: string | null;
};

type AssetsBootstrapScope =
  | { kind: 'all' }
  | { kind: 'albums'; albumIds: string[] };

type AlbumAssetCountStatus = 'known-complete' | 'not-in-current-scope' | 'loading-indeterminate';

type AssetsScopeLoadStatus = 'indeterminate' | 'loading' | 'complete';

type CachedBootstrapAssets = {
  items: MediaAsset[];
  scope: AssetsBootstrapScope;
};

type AppBootstrapCache = {
  assets: CachedBootstrapAssets | null;
  albumTreeNodes: AlbumTreeNode[] | null;
};

type AssetPageResponse = {
  items: MediaAsset[];
  offset: number;
  limit: number;
  hasMore: boolean;
};

type ScopedPeopleReviewAssetIdsState = {
  assetIds: string[];
  scopeType: string;
  scopeLabel: string;
  scopeSourceLabel: string;
};

const appBootstrapCache: AppBootstrapCache = {
  assets: null,
  albumTreeNodes: null
};

const initialAssetsPageSize = 1000;
const backgroundAssetsPageSize = 4000;

function buildAssetsPageRequestPath(scope: AssetsBootstrapScope, offset: number, limit: number): string {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit)
  });

  if (scope.kind === 'albums' && scope.albumIds.length > 0) {
    params.set('albumIds', scope.albumIds.join(','));
  }

  return `/api/assets?${params.toString()}`;
}

function formatScopedDateLabel(from: string, to: string): string {
  const fromLabel = from.trim();
  const toLabel = to.trim();
  if (fromLabel && toLabel) {
    return `${fromLabel} → ${toLabel}`;
  }

  if (fromLabel) {
    return `${fromLabel} onward`;
  }

  if (toLabel) {
    return `through ${toLabel}`;
  }

  return 'Current date-filtered results';
}

function summarizeScopeLabels(labels: string[], fallbackLabel: string): string {
  if (labels.length === 0) {
    return fallbackLabel;
  }

  const firstLabel = labels[0];
  if (!firstLabel) {
    return fallbackLabel;
  }

  if (labels.length === 1) {
    return firstLabel;
  }

  const secondLabel = labels[1];
  if (!secondLabel) {
    return firstLabel;
  }

  if (labels.length === 2) {
    return `${firstLabel} + ${secondLabel}`;
  }

  return `${firstLabel} + ${secondLabel} + ${labels.length - 2} more`;
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  if (moved === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

function logBootstrapTiming(label: string, startedAt: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const elapsedMs = performance.now() - startedAt;
  console.info(`[tedography bootstrap] ${label}: ${elapsedMs.toFixed(1)}ms`);
}

function readSessionStorageJson<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeSessionStorageJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota/storage issues and fall back to in-memory cache only.
  }
}

function normalizeAssetsBootstrapScope(scope: AssetsBootstrapScope): AssetsBootstrapScope {
  if (scope.kind !== 'albums') {
    return { kind: 'all' };
  }

  return {
    kind: 'albums',
    albumIds: [...new Set(scope.albumIds.map((albumId) => albumId.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right)
    )
  };
}

function getAssetsBootstrapScopeKey(scope: AssetsBootstrapScope): string {
  return scope.kind === 'albums' ? `albums:${scope.albumIds.join(',')}` : 'all';
}

function readCachedBootstrapAssets(): CachedBootstrapAssets | null {
  const cached = readSessionStorageJson<CachedBootstrapAssets | MediaAsset[]>(assetsBootstrapStorageKey);
  if (Array.isArray(cached)) {
    return {
      items: cached,
      scope: { kind: 'all' }
    };
  }

  if (
    cached &&
    Array.isArray(cached.items) &&
    cached.scope &&
    typeof cached.scope === 'object' &&
    (cached.scope.kind === 'all' ||
      (cached.scope.kind === 'albums' && Array.isArray(cached.scope.albumIds)))
  ) {
    return {
      items: cached.items,
      scope: normalizeAssetsBootstrapScope(cached.scope)
    };
  }

  return null;
}

function readCachedBootstrapAlbumTreeNodes(): AlbumTreeNode[] | null {
  return readSessionStorageJson<AlbumTreeNode[]>(albumTreeBootstrapStorageKey);
}

type AlbumTreeContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
};

const albumTreeContextMenuViewportPaddingPx = 8;

const timelineStickyTopPx = 10;
const timelineActiveMonthOffsetPx = timelineStickyTopPx + 16;
const timelineZoomLevels = [
  { label: 'XS', minWidth: 160 },
  { label: 'S', minWidth: 200 },
  { label: 'M', minWidth: 240 },
  { label: 'L', minWidth: 300 },
  { label: 'XL', minWidth: 360 }
] as const;

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '0 auto',
  maxWidth: 'none',
  padding: '10px 12px 14px',
  boxSizing: 'border-box',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: '#f3f4f6'
};

const topBarsStackStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  flex: '0 0 auto'
};

const topBarStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '8px',
  padding: '8px',
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  backgroundColor: '#fbfbfb',
  position: 'relative',
  zIndex: 20,
  minWidth: 0,
  overflowX: 'clip',
  overflowY: 'hidden'
};

const secondaryBarStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  rowGap: '6px',
  padding: '6px 8px',
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  backgroundColor: '#f7f8fa',
  position: 'relative',
  zIndex: 15,
  minWidth: 0
};

const topBarSectionStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '4px'
};

const contextMenuStyle: CSSProperties = {
  position: 'fixed',
  minWidth: '180px',
  padding: '6px',
  borderRadius: '10px',
  border: '1px solid #d6d6d6',
  backgroundColor: '#fff',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
  zIndex: 1400,
  display: 'grid',
  gap: '4px'
};

const contextMenuItemStyle: CSSProperties = {
  width: '100%',
  border: '1px solid transparent',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: '13px',
  cursor: 'pointer'
};

const disabledContextMenuItemStyle: CSSProperties = {
  ...contextMenuItemStyle,
  color: '#999',
  cursor: 'not-allowed'
};

const contextMenuSubmenuTriggerStyle: CSSProperties = {
  ...contextMenuItemStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px'
};

const contextMenuSubmenuContainerStyle: CSSProperties = {
  position: 'relative'
};

const contextMenuSubmenuStyle: CSSProperties = {
  ...contextMenuStyle,
  position: 'absolute',
  left: '100%',
  top: '0',
  minWidth: '200px',
  zIndex: 1401
};

const primaryAreaControlsStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '6px'
};

const toolbarGroupStyle: CSSProperties = {
  ...topBarSectionStyle,
  paddingRight: '8px',
  marginRight: '0',
  borderRight: '1px solid #e3e6ea'
};

const toolbarTrailingGroupStyle: CSSProperties = {
  ...topBarSectionStyle,
  marginLeft: 'auto'
};

const secondaryBarGroupStyle: CSSProperties = {
  ...topBarSectionStyle,
  paddingRight: '8px',
  marginRight: '0',
  borderRight: '1px solid #e3e6ea'
};

const toolbarActionSubgroupStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '6px'
};

const toolbarActionDividerStyle: CSSProperties = {
  width: '1px',
  alignSelf: 'stretch',
  backgroundColor: '#d9dde4',
  margin: '0 6px'
};

const shellLayoutStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: '280px minmax(0, 1fr) 320px',
  alignItems: 'stretch',
  height: '100%',
  minHeight: 0
};

const shellLayoutNoLeftStyle: CSSProperties = {
  ...shellLayoutStyle,
  gridTemplateColumns: 'minmax(0, 1fr) 320px'
};

const shellLayoutNoRightStyle: CSSProperties = {
  ...shellLayoutStyle,
  gridTemplateColumns: '280px minmax(0, 1fr)'
};

const shellLayoutMainOnlyStyle: CSSProperties = {
  ...shellLayoutStyle,
  gridTemplateColumns: 'minmax(0, 1fr)'
};

const sidePanelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  backgroundColor: '#fafafa',
  padding: '8px',
  boxSizing: 'border-box',
  minHeight: 0,
  height: '100%',
  overflow: 'auto',
  overscrollBehavior: 'contain'
};

const leftPanelStyle: CSSProperties = {
  ...sidePanelStyle,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const sidePanelSectionStyle: CSSProperties = {
  borderBottom: '1px solid #e9e9e9',
  paddingBottom: '8px',
  marginBottom: '8px'
};

const albumPanelSectionStyle: CSSProperties = {
  ...sidePanelSectionStyle,
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  marginBottom: 0
};

const sidePanelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '6px'
};

const sidePanelTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  margin: 0
};

const mainColumnStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  paddingTop: '6px',
  paddingRight: '4px',
  boxSizing: 'border-box',
  overflow: 'auto',
  overscrollBehavior: 'contain'
};

const rightPanelStyle: CSSProperties = {
  ...sidePanelStyle,
  backgroundColor: '#fff'
};

const shellViewportStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  paddingTop: '10px'
};

const selectionChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  border: '1px solid #cdd9ed',
  backgroundColor: '#eef4ff',
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600
};

const smartAlbumChipStyle: CSSProperties = {
  ...selectionChipStyle,
  borderColor: '#cfc6ef',
  backgroundColor: '#f3f0ff',
  color: '#352169'
};

const contextSummaryStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  borderLeft: '3px solid #9aa7b8',
  backgroundColor: '#f8fafc',
  padding: '8px 10px',
  margin: '0 0 8px 0'
};

const smartAlbumContextSummaryStyle: CSSProperties = {
  ...contextSummaryStyle,
  borderLeftColor: '#7c5cc4',
  backgroundColor: '#f7f4ff'
};

const contextSummaryTitleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  minWidth: 0
};

const contextSummaryTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937'
};

const contextSummaryBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  border: '1px solid #d5dbe5',
  backgroundColor: '#fff',
  color: '#4b5563',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const smartAlbumContextSummaryBadgeStyle: CSSProperties = {
  ...contextSummaryBadgeStyle,
  borderColor: '#cfc6ef',
  color: '#4f3792'
};

const contextSummaryMetaStyle: CSSProperties = {
  margin: 0,
  color: '#5f6b78',
  fontSize: '12px'
};

const topBarSpacerStyle: CSSProperties = {
  flex: '1 1 auto'
};

const menuAnchorStyle: CSSProperties = {
  position: 'relative'
};

const optionsMenuStyle: CSSProperties = {
  minWidth: '180px',
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  backgroundColor: '#fff',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)',
  padding: '8px',
  zIndex: 1200,
  display: 'grid',
  gap: '6px'
};

const albumTreeListStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  marginTop: '6px'
};

const albumTreeScrollableListStyle: CSSProperties = {
  ...albumTreeListStyle,
  flex: '1 1 auto',
  minHeight: 0,
  marginTop: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  paddingRight: '2px'
};

const albumTreeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0
};

const albumTreeChevronButtonStyle: CSSProperties = {
  width: '20px',
  minWidth: '20px',
  height: '20px',
  padding: 0,
  borderRadius: '6px',
  fontSize: '12px',
  lineHeight: 1,
  border: '1px solid #d6d6d6',
  backgroundColor: '#fff',
  color: '#1f2937',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const albumTreeSpacerStyle: CSSProperties = {
  width: '20px',
  minWidth: '20px',
  height: '20px'
};

const albumTreeCheckboxCellStyle: CSSProperties = {
  width: '24px',
  minWidth: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const albumTreeCheckboxStyle: CSSProperties = {
  margin: 0
};

const albumTreeShiftedCheckboxStyle: CSSProperties = {
  ...albumTreeCheckboxStyle,
  transform: 'none'
};

const filterRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px',
  marginTop: '6px'
};

const filterGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '6px'
};

const filterLabelStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '12px'
};

const filterOptionLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px'
};

const filterSubsectionStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  marginTop: '8px'
};

const searchPeopleChipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '6px'
};

const searchPeopleChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '999px',
  border: '1px solid #cdd9ed',
  backgroundColor: '#eef4ff',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600
};

const filterSubsectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  color: '#4f5965',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const toggleOptionLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px'
};

const compactSelectStyle: CSSProperties = {
  height: '30px',
  borderRadius: '8px',
  border: '1px solid #c8c8c8',
  backgroundColor: '#fff',
  padding: '0 8px',
  fontSize: '12px'
};

const photoStateSummaryListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '6px',
  marginTop: '6px'
};

const photoStateSummaryRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontSize: '13px',
  minWidth: 0,
  border: '1px solid #e3e6ea',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '6px 8px'
};

const photoStateCountBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '28px',
  borderRadius: '999px',
  padding: '2px 8px',
  fontSize: '11px',
  border: '1px solid #d7d7d7',
  backgroundColor: '#fafafa',
  color: '#555'
};

const albumPanelHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  marginBottom: '6px'
};

const albumPanelUtilityRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'nowrap'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '2px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
};

const groupSectionStyle: CSSProperties = {
  marginBottom: '18px'
};

const groupHeaderStyle: CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '16px'
};

const timelineGroupHeaderStyle: CSSProperties = {
  ...groupHeaderStyle,
  backgroundColor: '#fafafa',
  padding: '8px 0',
  position: 'sticky',
  top: timelineStickyTopPx,
  zIndex: 2
};

const groupMetaStyle: CSSProperties = {
  color: '#666',
  fontSize: '12px',
  marginLeft: '6px'
};

const timelineLayoutStyle: CSSProperties = {
  display: 'block'
};

const timelineYearHeaderStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '8px',
  marginBottom: '4px'
};

const timelineMonthButtonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'block',
  fontSize: '12px',
  margin: '4px 0 4px 24px',
  padding: '4px 8px',
  textAlign: 'left',
  width: 'calc(100% - 24px)'
};

const activeTimelineMonthButtonStyle: CSSProperties = {
  ...timelineMonthButtonStyle,
  backgroundColor: '#e8f1ff',
  borderColor: '#1f6feb',
  fontWeight: 600
};

const cardStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  overflow: 'hidden',
  backgroundColor: '#fff',
  cursor: 'pointer',
  position: 'relative',
  transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease'
};

const selectedCardStyle: CSSProperties = {
  border: '2px solid #1f6feb',
  boxShadow: '0 10px 24px rgba(31, 111, 235, 0.16)'
};

const activeCardStyle: CSSProperties = {
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.18)'
};

const thumbnailFrameStyle: CSSProperties = {
  aspectRatio: '4 / 3',
  backgroundColor: '#1f1f1f',
  display: 'flex',
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  position: 'relative'
};

const thumbnailImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center'
};

const thumbnailFallbackStyle: CSSProperties = {
  color: '#c7c7c7',
  fontSize: '12px'
};

const cardPhotoStateBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: '8px',
  left: '8px',
  zIndex: 2,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 7px',
  borderRadius: '999px',
  color: '#fff',
  fontSize: '10px',
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: '0.02em',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.22)',
  pointerEvents: 'none'
};

const cardSelectedBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  zIndex: 2,
  width: '22px',
  height: '22px',
  borderRadius: '999px',
  backgroundColor: '#1f6feb',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 700,
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  pointerEvents: 'none'
};

const cardActiveRingStyle: CSSProperties = {
  position: 'absolute',
  inset: '4px',
  borderRadius: '6px',
  boxShadow: 'inset 0 0 0 2px rgba(255, 255, 255, 0.92)',
  pointerEvents: 'none',
  zIndex: 1
};

const cardHoverLabelStyle: CSSProperties = {
  position: 'absolute',
  left: '6px',
  right: '6px',
  bottom: '6px',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  color: '#fff',
  borderRadius: '6px',
  padding: '4px 6px',
  fontSize: '11px',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  opacity: 0,
  transition: 'opacity 120ms ease',
  pointerEvents: 'none'
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '8px'
};

const loupeViewerStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '6px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 1
};

const loupeImageWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  backgroundColor: '#1f1f1f',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  marginBottom: '8px',
  padding: '4px'
};

const loupeImageScrollerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  overscrollBehavior: 'contain'
};

const loupeImageStageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const loupeImageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  display: 'block'
};

const loupeMainColumnStyle: CSSProperties = {
  ...mainColumnStyle,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const searchMainColumnStyle: CSSProperties = {
  ...mainColumnStyle,
  paddingTop: 0
};

const stickyAssetChromeStyle: CSSProperties = {
  flex: '0 0 auto',
  backgroundColor: '#f3f4f6',
  position: 'sticky',
  top: 0,
  zIndex: 4,
  paddingBottom: '2px'
};

const stickySearchAssetChromeStyle: CSSProperties = {
  ...stickyAssetChromeStyle,
  marginTop: '-10px',
  paddingTop: '10px'
};

const stickySearchSummaryBlockStyle: CSSProperties = {
  backgroundColor: '#f3f4f6',
  paddingBottom: '6px',
  marginBottom: '2px'
};

const compactPaneMetaTextStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '11px',
  margin: '0 0 4px 0'
};

const actionButtonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '4px 8px'
};

const controlStateStyles = `
html, body, #root {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background-color: #f3f4f6;
}

.tdg-app button {
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease,
    transform 80ms ease;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
}

.tdg-app button:hover:not(:disabled) {
  background-color: #ffffff;
  border-color: #9cb0cf;
}

.tdg-app button:active:not(:disabled) {
  background-color: #e9eef5;
  border-color: #8395b0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
  transform: translateY(1px);
}

.tdg-app button:disabled {
  background-color: #f5f5f5;
  border-color: #dddddd;
  color: #a8a8a8;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 1;
}

.tdg-app button[data-selected='true'] {
  background-color: #e8f1ff;
  border-color: #1f6feb;
  color: #0b4fb3;
  box-shadow: inset 0 0 0 1px rgba(31, 111, 235, 0.14);
}

.tdg-app button[data-selected='true']:hover:not(:disabled) {
  background-color: #deebff;
  border-color: #155dcb;
}

.tdg-app button[data-selected='true']:active:not(:disabled) {
  background-color: #d4e4ff;
  border-color: #155dcb;
}
`;

const detailPanelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '10px',
  backgroundColor: '#fafafa'
};

const detailImageStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  borderRadius: '8px',
  border: '1px solid #dedede',
  display: 'block',
  marginBottom: '10px'
};

const immersiveButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  marginTop: '4px'
};

const compareButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  fontSize: '12px',
  padding: '5px 8px'
};

const primarySearchButtonStyle: CSSProperties = {
  ...compareButtonStyle,
  backgroundColor: '#1f5fbf',
  borderColor: '#174a95',
  color: '#fff',
  fontWeight: 600
};

const toolbarButtonStyle: CSSProperties = {
  ...compareButtonStyle,
  padding: '4px 8px',
  fontSize: '12px',
  lineHeight: 1.1
};

const toolbarLinkButtonStyle: CSSProperties = {
  ...toolbarButtonStyle,
  textDecoration: 'none',
  color: '#0f172a'
};

const toolbarIconButtonStyle: CSSProperties = {
  ...toolbarButtonStyle,
  width: '32px',
  height: '32px',
  padding: '0',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const toolbarIconContentStyle: CSSProperties = {
  fontSize: '18px'
};

const toolbarTitleStyle: CSSProperties = {
  fontSize: '20px',
  marginRight: '2px',
  whiteSpace: 'nowrap'
};

const compactSecondaryButtonStyle: CSSProperties = {
  ...compareButtonStyle,
  padding: '4px 7px',
  whiteSpace: 'nowrap',
  flex: '0 0 auto'
};

const compactDisabledSecondaryButtonStyle: CSSProperties = {
  ...compactSecondaryButtonStyle
};

const disabledToolbarActionButtonStyle: CSSProperties = {
  ...compareButtonStyle
};

const albumTreeLabelButtonStyle: CSSProperties = {
  ...compareButtonStyle,
  flex: '1 1 auto',
  minWidth: 0,
  justifyContent: 'flex-start',
  overflow: 'hidden',
  paddingLeft: '6px',
  paddingRight: '6px'
};

const albumTreeLabelContentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
  width: '100%'
};

const albumTreeLabelTextStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const albumTreeCountStatusBadgeBaseStyle: CSSProperties = {
  flex: '0 0 auto',
  borderRadius: '999px',
  padding: '1px 6px',
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1.4,
  border: '1px solid transparent'
};

function getAlbumAssetCountStatusLabel(status: AlbumAssetCountStatus): string {
  if (status === 'known-complete') {
    return '=';
  }

  if (status === 'not-in-current-scope') {
    return '◌';
  }

  return '~';
}

function getAlbumAssetCountStatusTitle(status: AlbumAssetCountStatus, albumLabel: string): string {
  if (status === 'known-complete') {
    return `Count for "${albumLabel}" is complete for the current loaded asset scope.`;
  }

  if (status === 'not-in-current-scope') {
    return `Count for "${albumLabel}" is outside the current asset scope and should not be treated as complete right now.`;
  }

  return `Count for "${albumLabel}" is still indeterminate because assets for the current scope are still loading or have not been fully confirmed yet.`;
}

function getAlbumAssetCountStatusBadgeStyle(status: AlbumAssetCountStatus): CSSProperties {
  if (status === 'known-complete') {
    return {
      ...albumTreeCountStatusBadgeBaseStyle,
      backgroundColor: '#e7f6ec',
      color: '#166534',
      borderColor: '#b7dfc3'
    };
  }

  if (status === 'not-in-current-scope') {
    return {
      ...albumTreeCountStatusBadgeBaseStyle,
      backgroundColor: '#f3f4f6',
      color: '#4b5563',
      borderColor: '#d1d5db'
    };
  }

  return {
    ...albumTreeCountStatusBadgeBaseStyle,
    backgroundColor: '#fff4db',
    color: '#92400e',
    borderColor: '#f5d38c'
  };
}

const emptyStateStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '24px',
  backgroundColor: '#fafafa',
  textAlign: 'center'
};

const emptyStateHeadingStyle: CSSProperties = {
  fontSize: '24px',
  margin: '0 0 8px 0'
};

const emptyStateTextStyle: CSSProperties = {
  color: '#4d4d4d',
  margin: '0 0 16px 0'
};


const immersiveOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: '#000',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  zIndex: 1000
};

const immersiveTopBarStyle: CSSProperties = {
  width: '100%',
  color: '#f5f5f5',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '10px',
  paddingBottom: '6px'
};

const immersiveInfoStyle: CSSProperties = {
  display: 'grid',
  gap: '2px'
};

const immersiveControlsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const immersiveControlButtonStyle: CSSProperties = {
  backgroundColor: '#1f1f1f',
  border: '1px solid #515151',
  color: '#f3f3f3',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '6px 10px'
};

const immersiveImageWrapStyle: CSSProperties = {
  flex: 1,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 0,
  overflow: 'hidden',
  padding: 0,
  backgroundColor: '#000'
};

const immersiveImageStyle: CSSProperties = {
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  display: 'block'
};

const immersiveBottomHintStyle: CSSProperties = {
  color: '#a9a9a9',
  fontSize: '12px',
  marginTop: '8px'
};

const slideshowOverlayStyle: CSSProperties = {
  ...immersiveOverlayStyle,
  backgroundColor: '#000'
};

const slideshowTopBarStyle: CSSProperties = {
  ...immersiveTopBarStyle,
  paddingBottom: '12px'
};

const surveyOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: '#080808',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'stretch',
  padding: '16px',
  zIndex: 1100,
  overflow: 'hidden'
};

const surveyContainerStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  height: 'calc(100vh - 32px)',
  maxHeight: 'calc(100vh - 32px)',
  display: 'flex',
  flexDirection: 'column',
  color: '#f3f3f3',
  backgroundColor: '#101010',
  border: '1px solid #232323',
  borderRadius: '14px',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
  padding: '18px',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 1,
  overflow: 'hidden'
};

const surveyHeaderStyle: CSSProperties = {
  flex: '0 0 auto',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'grid',
  gap: '6px',
  paddingBottom: '6px',
  marginBottom: '4px',
  backgroundColor: '#101010'
};

const surveyHeaderTopRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap'
};

const surveyHeaderIdentityStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  minWidth: 0
};

const surveyTitleBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '28px',
  borderRadius: '999px',
  padding: '0 10px',
  backgroundColor: '#171717',
  border: '1px solid #2a2a2a',
  color: '#f5f5f5',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase'
};

const surveyFocusedFilenameStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '360px',
  color: '#f1f1f1',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const surveyCountBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '28px',
  borderRadius: '999px',
  padding: '0 10px',
  backgroundColor: '#131313',
  border: '1px solid #2d2d2d',
  color: '#d8d8d8',
  fontSize: '12px'
};

const surveyHeaderControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const surveySegmentedControlStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px',
  borderRadius: '999px',
  backgroundColor: '#141414',
  border: '1px solid #292929'
};

const surveySegmentButtonStyle: CSSProperties = {
  border: '1px solid transparent',
  borderRadius: '999px',
  backgroundColor: 'transparent',
  color: '#b7b7b7',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
  padding: '6px 10px'
};

const surveySegmentButtonActiveStyle: CSSProperties = {
  backgroundColor: '#262626',
  borderColor: '#3a3a3a',
  color: '#f2f2f2'
};

const surveyActionStripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap'
};

const surveyActionButtonStyle: CSSProperties = {
  ...immersiveControlButtonStyle,
  backgroundColor: '#161616',
  border: '1px solid #303030',
  padding: '5px 8px',
  fontSize: '11px'
};

const surveyWorkspaceStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden'
};

const surveyGridStyle: CSSProperties = {
  display: 'grid',
  width: '100%',
  gap: '10px',
  alignContent: 'stretch',
  flex: 1,
  minHeight: 0,
  minWidth: 0
};

const surveyGridLandscapeStyle: CSSProperties = {
  height: '100%'
};

const surveyGridPortraitStyle: CSSProperties = {
  height: '100%',
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(0, 1fr)'
};

const surveyTileStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minWidth: 0,
  minHeight: 0,
  cursor: 'pointer'
};

const surveyLandscapeTileStyle: CSSProperties = {
  maxWidth: '100%'
};

const surveyPortraitTileStyle: CSSProperties = {
  minWidth: 0
};

const surveyFocusedTileStyle: CSSProperties = {
  boxShadow: '0 0 0 1px rgba(77, 163, 255, 0.65), 0 0 0 2px rgba(77, 163, 255, 0.12)'
};

const surveyPaneViewportStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '12px',
  background:
    'radial-gradient(circle at top, rgba(255, 255, 255, 0.04), transparent 42%), #050505',
  border: '1px solid #1d1d1d',
  minHeight: 0
};

const surveyPaneViewportLandscapeStyle: CSSProperties = {};

const surveyPaneViewportPortraitStyle: CSSProperties = {};

const surveyPaneStageStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

const surveyImageTransformStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  transformOrigin: 'center center'
};

const surveyImageStyle: CSSProperties = {
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: '100%',
  display: 'block',
  backgroundColor: '#050505',
  opacity: 1,
  filter: 'none'
};

const surveyPaneOverlayTopStyle: CSSProperties = {
  position: 'absolute',
  top: '8px',
  left: '8px',
  right: '8px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '6px',
  pointerEvents: 'none'
};

const surveyPaneBadgeGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexWrap: 'wrap',
  minWidth: 0
};

const surveyPaneBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  padding: '3px 7px',
  borderRadius: '999px',
  fontSize: '10px',
  lineHeight: 1.2,
  color: '#f3f3f3',
  backgroundColor: 'rgba(10, 10, 10, 0.62)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(6px)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const surveyPaneFocusedBadgeStyle: CSSProperties = {
  ...surveyPaneBadgeStyle,
  color: '#d7ecff',
  borderColor: 'rgba(77, 163, 255, 0.35)',
  backgroundColor: 'rgba(17, 29, 41, 0.74)'
};

const surveyPaneZoomControlsStyle: CSSProperties = {
  position: 'absolute',
  right: '8px',
  bottom: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px',
  borderRadius: '999px',
  backgroundColor: 'rgba(10, 10, 10, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(6px)'
};

const surveyPaneZoomButtonStyle: CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: '1px solid #3a3a3a',
  backgroundColor: '#151515',
  color: '#f2f2f2',
  cursor: 'pointer',
  fontSize: '12px',
  padding: 0
};

const surveyPaneResetButtonStyle: CSSProperties = {
  ...surveyPaneZoomButtonStyle,
  width: 'auto',
  padding: '0 9px',
  fontSize: '11px',
  whiteSpace: 'nowrap'
};

const reviewActions: PhotoState[] = [
  PhotoState.Keep,
  PhotoState.Discard,
  PhotoState.Pending,
  PhotoState.New
];

function formatCaptureDate(dateString?: string | null): string {
  if (typeof dateString !== 'string' || dateString.trim().length === 0) {
    return 'Unknown';
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return parsed.toLocaleString();
}

function parseStringArrayFromStorage(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function parseBooleanFromStorage(value: string | null): boolean {
  return value === 'true';
}

function parseSearchPeopleMatchModeFromStorage(value: string | null): SearchPeopleMatchMode {
  return value === 'All' ? 'All' : 'Any';
}

function parseSearchCaptureDateAvailabilityModeFromStorage(
  value: string | null,
  legacyIncludeNoCaptureDateValue: string | null
): SearchCaptureDateAvailabilityMode {
  if (
    value === 'datedOnly' ||
    value === 'datedOrUndated' ||
    value === 'undatedOnly'
  ) {
    return value;
  }

  return parseBooleanFromStorage(legacyIncludeNoCaptureDateValue)
    ? 'datedOrUndated'
    : 'datedOnly';
}

function parsePrimaryAreaFromStorage(value: string | null): TedographyPrimaryArea {
  if (value === 'Review' || value === 'Library' || value === 'Search') {
    return value;
  }

  return 'Review';
}

function parseLibraryBrowseModeFromStorage(value: string | null): LibraryBrowseMode {
  if (value === 'Flat' || value === 'Timeline' || value === 'Albums') {
    return value;
  }

  return 'Timeline';
}

function parseReviewBrowseModeFromStorage(value: string | null): ReviewBrowseMode {
  if (value === 'Flat' || value === 'Timeline' || value === 'Albums') {
    return value;
  }

  return 'Albums';
}

function parseAlbumResultsPresentationFromStorage(value: string | null): AlbumResultsPresentation {
  if (value === 'Merged' || value === 'GroupedByAlbum') {
    return value;
  }

  return 'Merged';
}

function parseAlbumTreeSortModeFromStorage(value: string | null): AlbumTreeSortMode {
  if (value === 'Custom' || value === 'Name' || value === 'Month/Name') {
    return value;
  }

  return 'Custom';
}

function parseTimelineZoomLevelFromStorage(value: string | null): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < timelineZoomLevels.length) {
    return parsed;
  }

  return 2;
}

function parsePhotoStatesFromStorage(
  value: string | null,
  fallback: PhotoState[]
): PhotoState[] {
  const parsed = parseStringArrayFromStorage(value)
    .map((entry) => normalizePhotoState(entry))
    .filter((entry): entry is PhotoState => entry !== null)
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .filter((entry) => photoStateFilterOptions.includes(entry));

  return parsed.length > 0 ? parsed : fallback;
}

function getTimelineContentSignature(groups: TimelineMonthGroup[]): string {
  return groups
    .map((group) => {
      const firstAssetId = group.assets[0]?.id ?? '';
      const lastAssetId = group.assets[group.assets.length - 1]?.id ?? '';
      return `${group.key}:${group.assets.length}:${firstAssetId}:${lastAssetId}`;
    })
    .join('|');
}

function getDefaultPhotoStatesForPrimaryArea(area: TedographyPrimaryArea): PhotoState[] | null {
  if (area === 'Library') {
    return [PhotoState.Keep];
  }

  if (area === 'Search') {
    return null;
  }

  return [PhotoState.New, PhotoState.Pending];
}

function parseLocalDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function hasUsableCaptureDateTime(asset: MediaAsset): boolean {
  if (typeof asset.captureDateTime !== 'string' || asset.captureDateTime.trim().length === 0) {
    return false;
  }

  const captureDate = new Date(asset.captureDateTime);
  return !Number.isNaN(captureDate.getTime());
}

function doesAssetMatchSearchCaptureDateRange(
  asset: MediaAsset,
  captureDateFrom: string,
  captureDateTo: string,
  captureDateAvailability: SearchCaptureDateAvailabilityMode
): boolean {
  const hasRange = Boolean(captureDateFrom || captureDateTo);
  const hasUsableCaptureDate = hasUsableCaptureDateTime(asset);

  if (captureDateAvailability === 'undatedOnly') {
    return !hasUsableCaptureDate;
  }

  if (!hasRange) {
    return true;
  }

  if (!hasUsableCaptureDate) {
    return captureDateAvailability === 'datedOrUndated';
  }

  const captureDate = new Date(asset.captureDateTime as string);

  const fromDate = parseLocalDate(captureDateFrom);
  if (fromDate && captureDate < fromDate) {
    return false;
  }

  const toDate = parseLocalDate(captureDateTo);
  if (toDate) {
    const inclusiveEnd = new Date(toDate);
    inclusiveEnd.setHours(23, 59, 59, 999);
    if (captureDate > inclusiveEnd) {
      return false;
    }
  }

  return true;
}

function doesAssetMatchSearchPeopleFilters(
  asset: MediaAsset,
  peopleIds: string[],
  peopleMatchMode: SearchPeopleMatchMode,
  hasNoPeople: boolean,
  hasReviewableFaces: boolean
): boolean {
  const confirmedPeopleIds = new Set((asset.people ?? []).map((person) => person.personId));
  const reviewableDetectionsCount = (asset as MediaAsset & { reviewableDetectionsCount?: number }).reviewableDetectionsCount ?? 0;

  if (hasNoPeople && confirmedPeopleIds.size > 0) {
    return false;
  }

  if (hasReviewableFaces && reviewableDetectionsCount <= 0) {
    return false;
  }

  if (peopleIds.length === 0) {
    return true;
  }

  if (peopleMatchMode === 'All') {
    return peopleIds.every((personId) => confirmedPeopleIds.has(personId));
  }

  return peopleIds.some((personId) => confirmedPeopleIds.has(personId));
}

function buildFilenameSearchRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new RegExp(trimmed, 'i');
  } catch {
    return /^$/;
  }
}

function doesAssetMatchSearchFilename(asset: MediaAsset, pattern: string): boolean {
  const regex = buildFilenameSearchRegex(pattern);
  if (!regex) {
    return true;
  }

  return regex.test(asset.filename);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  return target.isContentEditable;
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

function photoStatesEqual(left: PhotoState[], right: PhotoState[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return photoStateFilterOptions.every(
    (state) => left.includes(state) === right.includes(state)
  );
}

function getDefaultSearchFilters(): SearchFilters {
  return {
    photoStates: [],
    albumIds: [],
    groupIds: [],
    filenamePattern: '',
    captureDateFrom: '',
    captureDateTo: '',
    captureDateAvailability: 'datedOnly',
    peopleIds: [],
    peopleMatchMode: 'Any',
    hasNoPeople: false,
    hasReviewableFaces: false,
    keywordId: null
  };
}

function searchFiltersEqual(left: SearchFilters | null, right: SearchFilters | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return (
    photoStatesEqual(left.photoStates, right.photoStates) &&
    arraysEqual(left.albumIds, right.albumIds) &&
    arraysEqual(left.groupIds, right.groupIds) &&
    left.filenamePattern === right.filenamePattern &&
    left.captureDateFrom === right.captureDateFrom &&
    left.captureDateTo === right.captureDateTo &&
    left.captureDateAvailability === right.captureDateAvailability &&
    arraysEqual(left.peopleIds, right.peopleIds) &&
    left.peopleMatchMode === right.peopleMatchMode &&
    left.hasNoPeople === right.hasNoPeople &&
    left.hasReviewableFaces === right.hasReviewableFaces &&
    left.keywordId === right.keywordId
  );
}

function hasSearchFilters(filters: SearchFilters): boolean {
  return (
    filters.photoStates.length > 0 ||
    filters.albumIds.length > 0 ||
    filters.groupIds.length > 0 ||
    filters.filenamePattern.trim().length > 0 ||
    filters.captureDateFrom.length > 0 ||
    filters.captureDateTo.length > 0 ||
    filters.captureDateAvailability !== 'datedOnly' ||
    filters.peopleIds.length > 0 ||
    filters.hasNoPeople ||
    filters.hasReviewableFaces ||
    filters.keywordId !== null
  );
}

function getAdjacentReplacementAssetId(list: MediaAsset[], currentAssetId: string): string | null {
  const currentIndex = list.findIndex((asset) => asset.id === currentAssetId);
  if (currentIndex < 0) {
    return null;
  }

  const nextAsset = list[currentIndex + 1];
  if (nextAsset) {
    return nextAsset.id;
  }

  const previousAsset = list[currentIndex - 1];
  if (previousAsset) {
    return previousAsset.id;
  }

  return null;
}

function getOverlapLength(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

type GridCardLayout = {
  assetId: string;
  node: HTMLElement;
  rect: DOMRect;
  centerX: number;
  centerY: number;
};

function getGridRowTolerance(height: number): number {
  return Math.max(height * 0.6, 24);
}

type AlbumAssetSection = {
  albumId: string;
  albumLabel: string;
  assets: MediaAsset[];
};

function getAncestorGroupIdsForAlbumIds(
  albumIds: string[],
  albumNodesById: Map<string, AlbumTreeNode>
): string[] {
  const ancestorGroupIds = new Set<string>();

  for (const albumId of albumIds) {
    let currentNode = albumNodesById.get(albumId) ?? null;
    let parentId = currentNode?.parentId ?? null;

    while (parentId) {
      currentNode = albumNodesById.get(parentId) ?? null;
      if (!currentNode) {
        break;
      }

      if (currentNode.nodeType === 'Group') {
        ancestorGroupIds.add(currentNode.id);
      }

      parentId = currentNode.parentId;
    }
  }

  return Array.from(ancestorGroupIds);
}

function getAncestorGroupIdsForParentId(
  parentId: string | null,
  albumNodesById: Map<string, AlbumTreeNode>
): string[] {
  const ancestorGroupIds = new Set<string>();
  let currentParentId = parentId;

  while (currentParentId) {
    const currentNode = albumNodesById.get(currentParentId);
    if (!currentNode) {
      break;
    }

    if (currentNode.nodeType === 'Group') {
      ancestorGroupIds.add(currentNode.id);
    }

    currentParentId = currentNode.parentId;
  }

  return Array.from(ancestorGroupIds);
}

function resolveAlbumTreeCreationParentId(selectedNode: AlbumTreeNode | null): string | null {
  if (!selectedNode) {
    return null;
  }

  if (selectedNode.nodeType === 'Group') {
    return selectedNode.id;
  }

  return selectedNode.parentId ?? null;
}

function getPhotoStateBadgeLabel(photoState: PhotoState): string {
  if (photoState === PhotoState.Keep) {
    return 'Keep';
  }

  if (photoState === PhotoState.Pending) {
    return 'Pending';
  }

  if (photoState === PhotoState.Discard) {
    return 'Discard';
  }

  return 'New';
}

function getPhotoStateBadgeColor(photoState: PhotoState): string {
  if (photoState === PhotoState.Keep) {
    return '#1f8f4d';
  }

  if (photoState === PhotoState.Pending) {
    return '#b58813';
  }

  if (photoState === PhotoState.Discard) {
    return '#b4232f';
  }

  return '#5b6573';
}

function getAssetDisplayImageUrl(asset: MediaAsset): string | null {
  if (typeof asset.id === 'string' && asset.id.trim().length > 0) {
    return getDisplayMediaUrl(asset.id, asset.originalContentHash);
  }

  return null;
}

function getAssetThumbnailImageUrl(asset: MediaAsset): string | null {
  if (typeof asset.id === 'string' && asset.id.trim().length > 0) {
    return getThumbnailMediaUrl(asset.id, asset.originalContentHash);
  }

  return getAssetDisplayImageUrl(asset);
}

type AssetCardProps = {
  asset: MediaAsset;
  isSelected: boolean;
  isActive: boolean;
  isUpdating: boolean;
  showPhotoStateBadge: boolean;
  onCardClick: (event: ReactMouseEvent<HTMLElement>, assetId: string) => void;
  onCardDoubleClick: (assetId: string) => void;
};

function AssetCard({
  asset,
  isSelected,
  isActive,
  isUpdating,
  showPhotoStateBadge,
  onCardClick,
  onCardDoubleClick
}: AssetCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pendingClickTimeoutRef = useRef<number | null>(null);
  const thumbnailImageUrl = getAssetThumbnailImageUrl(asset);
  const displayImageUrl = getAssetDisplayImageUrl(asset);
  const imageUrl = imageFailed ? displayImageUrl : thumbnailImageUrl;
  const photoStateBadgeColor = getPhotoStateBadgeColor(asset.photoState);
  const photoStateLabel = getPhotoStateBadgeLabel(asset.photoState);

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailImageUrl, displayImageUrl]);

  useEffect(() => {
    return () => {
      if (pendingClickTimeoutRef.current !== null) {
        window.clearTimeout(pendingClickTimeoutRef.current);
      }
    };
  }, []);

  function handleClick(event: ReactMouseEvent<HTMLElement>): void {
    if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      if (pendingClickTimeoutRef.current !== null) {
        window.clearTimeout(pendingClickTimeoutRef.current);
        pendingClickTimeoutRef.current = null;
      }
      onCardClick(event, asset.id);
      return;
    }

    if (event.detail > 1) {
      return;
    }

    if (pendingClickTimeoutRef.current !== null) {
      window.clearTimeout(pendingClickTimeoutRef.current);
    }

    pendingClickTimeoutRef.current = window.setTimeout(() => {
      pendingClickTimeoutRef.current = null;
      onCardClick(event, asset.id);
    }, 220);
  }

  function handleDoubleClick(): void {
    if (pendingClickTimeoutRef.current !== null) {
      window.clearTimeout(pendingClickTimeoutRef.current);
      pendingClickTimeoutRef.current = null;
    }

    onCardDoubleClick(asset.id);
  }

  return (
    <article
      data-grid-card="true"
      data-asset-id={asset.id}
      data-active={isActive ? 'true' : undefined}
      style={
        isActive
          ? {
              ...cardStyle,
              ...(isSelected ? selectedCardStyle : {}),
              ...activeCardStyle
            }
          : isSelected
            ? { ...cardStyle, ...selectedCardStyle }
            : cardStyle
      }
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={asset.filename}
    >
      <div style={thumbnailFrameStyle}>
        {showPhotoStateBadge ? (
          <span style={{ ...cardPhotoStateBadgeStyle, backgroundColor: photoStateBadgeColor }}>
            {photoStateLabel}
          </span>
        ) : null}
        {isSelected ? <span style={cardSelectedBadgeStyle}>✓</span> : null}
        {isActive ? <span style={cardActiveRingStyle} /> : null}
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={asset.filename}
            style={thumbnailImageStyle}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span style={thumbnailFallbackStyle}>No preview</span>
        )}
        <span
          style={{
            ...cardHoverLabelStyle,
            opacity: isHovered ? 1 : 0,
            border: isUpdating ? '1px solid #d68e00' : undefined
          }}
        >
          {asset.filename}
        </span>
      </div>
    </article>
  );
}

type AssetDetailPanelProps = {
  asset: MediaAsset | null;
};

function AssetDetailPanel({ asset }: AssetDetailPanelProps) {
  if (!asset) {
    return <p style={detailPanelStyle}>No asset selected.</p>;
  }

  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <section style={detailPanelStyle}>
      {imageUrl ? (
        <img src={imageUrl} alt={asset.filename} style={detailImageStyle} />
      ) : null}
      <p>
        <strong>Filename:</strong> {asset.filename}
      </p>
      <p>
        <strong>Photo state:</strong> {asset.photoState}
      </p>
      <p>
        <strong>Captured:</strong> {formatCaptureDate(asset.captureDateTime)}
      </p>
      <p>
        <strong>Dimensions:</strong>{' '}
        {asset.width && asset.height ? `${asset.width} x ${asset.height}` : 'Unknown'}
      </p>
    </section>
  );
}

type LoupeViewerProps = {
  asset: MediaAsset;
  onOpenImmersive: (assetId: string) => void;
};

function LoupeViewer({
  asset,
  onOpenImmersive
}: LoupeViewerProps) {
  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <section style={loupeViewerStyle}>
      <div style={loupeImageWrapStyle}>
        <div style={loupeImageScrollerStyle}>
          <div style={loupeImageStageStyle} onDoubleClick={() => onOpenImmersive(asset.id)}>
            {imageUrl ? <img src={imageUrl} alt={asset.filename} style={loupeImageStyle} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

type ImmersiveViewerProps = {
  asset: MediaAsset;
  index: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onActiveImageLoad: (assetId: string) => void;
};

function ImmersiveViewer({
  asset,
  onClose,
  onActiveImageLoad
}: ImmersiveViewerProps) {
  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <div style={immersiveOverlayStyle} onClick={onClose}>
      <section
        style={{ width: '100%', height: '100%', display: 'flex', minHeight: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={immersiveImageWrapStyle}>
          {imageUrl ? (
            <img
              key={asset.id}
              src={imageUrl}
              alt={asset.filename}
              style={immersiveImageStyle}
              onLoad={() => onActiveImageLoad(asset.id)}
            />
          ) : (
            <div style={immersiveImageStyle} />
          )}
        </div>
      </section>
    </div>
  );
}

type SlideshowViewerProps = {
  asset: MediaAsset;
  index: number;
  total: number;
  isPlaying: boolean;
  onExit: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onTogglePlayPause: () => void;
  onActiveImageLoad: (assetId: string) => void;
};

function SlideshowViewer({
  asset,
  index,
  total,
  isPlaying,
  onExit,
  onNext,
  onPrevious,
  onTogglePlayPause,
  onActiveImageLoad
}: SlideshowViewerProps) {
  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <div style={slideshowOverlayStyle}>
      <section style={{ width: '100%', height: '100%' }}>
        <div style={slideshowTopBarStyle}>
          <div style={immersiveInfoStyle}>
            <strong>{asset.filename}</strong>
            <span>
              {index + 1} / {total}
            </span>
            <span>{formatCaptureDate(asset.captureDateTime)}</span>
          </div>
          <div style={immersiveControlsStyle}>
            <button type="button" style={immersiveControlButtonStyle} onClick={onTogglePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onPrevious}>
              Previous
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onNext}>
              Next
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
        <div style={immersiveImageWrapStyle}>
          {imageUrl ? (
            <img
              key={asset.id}
              src={imageUrl}
              alt={asset.filename}
              style={immersiveImageStyle}
              onLoad={() => onActiveImageLoad(asset.id)}
            />
          ) : (
            <div style={immersiveImageStyle} />
          )}
        </div>
        <p style={immersiveBottomHintStyle}>
          Keyboard: Space play/pause, Left/Right navigate, Escape exit slideshow.
        </p>
      </section>
    </div>
  );
}

type SurveyModeProps = {
  assets: MediaAsset[];
  focusedAsset: MediaAsset;
  focusedIndex: number;
  isUpdating: boolean;
  onClose: () => void;
  onFocusAsset: (assetId: string) => void;
  onOpenImmersiveAsset: (assetId: string) => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function SurveyZoomableTile({
  asset,
  layoutMode,
  onFocus,
  onOpenImmersive
}: {
  asset: MediaAsset;
  layoutMode: SurveyLayoutMode;
  onFocus: () => void;
  onOpenImmersive: () => void;
}) {
  const imageUrl = getAssetDisplayImageUrl(asset);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    asset.width && asset.height ? { width: asset.width, height: asset.height } : null
  );
  const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  function clampOffset(nextScale: number, nextOffset: { x: number; y: number }) {
    if (nextScale <= 1) {
      return { x: 0, y: 0 };
    }

    const viewport = viewportRef.current;
    const naturalWidth = imageDimensions?.width ?? asset.width ?? 0;
    const naturalHeight = imageDimensions?.height ?? asset.height ?? 0;

    if (!viewport || naturalWidth <= 0 || naturalHeight <= 0) {
      return nextOffset;
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return nextOffset;
    }

    const containScale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
    const fittedWidth = naturalWidth * containScale;
    const fittedHeight = naturalHeight * containScale;
    const scaledWidth = fittedWidth * nextScale;
    const scaledHeight = fittedHeight * nextScale;
    const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2);

    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextOffset.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextOffset.y))
    };
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    const nextScale = Math.max(1, Math.min(4, Number((scale + (event.deltaY < 0 ? 0.25 : -0.25)).toFixed(2))));
    setScale((previous) => {
      if (previous === nextScale) {
        return previous;
      }

      setOffset((currentOffset) => clampOffset(nextScale, currentOffset));
      return nextScale;
    });
  }

  function handleSetScale(nextScale: number): void {
    const clampedScale = Math.max(1, Math.min(4, Number(nextScale.toFixed(2))));
    setScale((previous) => {
      if (previous === clampedScale) {
        return previous;
      }

      setOffset((currentOffset) => clampOffset(clampedScale, currentOffset));
      return clampedScale;
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    onFocus();
    if (scale <= 1) {
      return;
    }

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragStartRef.current || scale <= 1) {
      return;
    }

    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    const nextOffset = {
      x: dragStartRef.current.originX + deltaX,
      y: dragStartRef.current.originY + deltaY
    };

    setOffset(clampOffset(scale, nextOffset));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
    setIsDragging(false);
  }

  function resetZoom(): void {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }

  return (
    <div
      ref={viewportRef}
      style={{
        ...surveyPaneViewportStyle,
        ...(layoutMode === 'portrait' ? surveyPaneViewportPortraitStyle : surveyPaneViewportLandscapeStyle),
        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onOpenImmersive}
    >
      <div style={surveyPaneStageStyle}>
        <div
          style={{
            ...surveyImageTransformStyle,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.filename}
              style={{
                ...surveyImageStyle,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              draggable={false}
              onLoad={(event) =>
                setImageDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight
                })
              }
            />
          ) : (
            <div style={{ ...surveyImageStyle, width: '100%', height: '100%' }} />
          )}
        </div>
      </div>
      <div
        style={surveyPaneZoomControlsStyle}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          style={surveyPaneZoomButtonStyle}
          onClick={() => handleSetScale(scale + 0.25)}
          aria-label={`Zoom in ${asset.filename}`}
        >
          +
        </button>
        <button
          type="button"
          style={surveyPaneZoomButtonStyle}
          onClick={() => handleSetScale(scale - 0.25)}
          aria-label={`Zoom out ${asset.filename}`}
        >
          -
        </button>
        <button
          type="button"
          style={surveyPaneResetButtonStyle}
          onClick={resetZoom}
          disabled={scale === 1 && offset.x === 0 && offset.y === 0}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function SurveyMode({
  assets,
  focusedAsset,
  focusedIndex,
  isUpdating,
  onClose,
  onFocusAsset,
  onOpenImmersiveAsset,
  onSetPhotoState
}: SurveyModeProps) {
  const [layoutMode, setLayoutMode] = useState<SurveyLayoutMode>('landscape');
  const surveyGridLayoutStyle =
    layoutMode === 'landscape'
      ? {
          ...surveyGridLandscapeStyle,
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: `repeat(${assets.length}, minmax(0, 1fr))`
        }
      : {
          ...surveyGridPortraitStyle,
          gridTemplateColumns: `repeat(${assets.length}, minmax(0, 1fr))`,
          gridTemplateRows: 'minmax(0, 1fr)'
        };

  return (
    <div style={surveyOverlayStyle} onClick={onClose}>
      <section style={surveyContainerStyle} onClick={(event) => event.stopPropagation()}>
        <div style={surveyHeaderStyle}>
          <div style={surveyHeaderTopRowStyle}>
            <div style={surveyHeaderIdentityStyle}>
              <span style={surveyTitleBadgeStyle}>Survey</span>
              <span style={surveyFocusedFilenameStyle} title={focusedAsset.filename}>
                {focusedAsset.filename}
              </span>
              <span style={surveyCountBadgeStyle}>
                {focusedIndex + 1} / {assets.length}
              </span>
            </div>
            <div style={surveyHeaderControlsStyle}>
              <div style={surveySegmentedControlStyle} aria-label="Survey layout mode">
                <button
                  type="button"
                  style={{
                    ...surveySegmentButtonStyle,
                    ...(layoutMode === 'landscape' ? surveySegmentButtonActiveStyle : {})
                  }}
                  onClick={() => setLayoutMode('landscape')}
                >
                  Landscape Compare
                </button>
                <button
                  type="button"
                  style={{
                    ...surveySegmentButtonStyle,
                    ...(layoutMode === 'portrait' ? surveySegmentButtonActiveStyle : {})
                  }}
                  onClick={() => setLayoutMode('portrait')}
                >
                  Portrait Compare
                </button>
              </div>
              <button type="button" style={surveyActionButtonStyle} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
          <div style={surveyActionStripStyle}>
            {reviewActions.map((state) => (
              <button
                key={state}
                type="button"
                style={surveyActionButtonStyle}
                onClick={() => onSetPhotoState(focusedAsset.id, state)}
                disabled={isUpdating || focusedAsset.photoState === state}
                title={`Set focused image to ${state}`}
              >
                {state}
              </button>
            ))}
          </div>
        </div>

        <div style={surveyWorkspaceStyle}>
          <div
            style={{
              ...surveyGridStyle,
              ...surveyGridLayoutStyle
            }}
          >
          {assets.map((asset) => {
            const photoStateColor = getPhotoStateBadgeColor(asset.photoState);
            const isFocused = asset.id === focusedAsset.id;

            return (
              <article
                key={asset.id}
                style={{
                  ...surveyTileStyle,
                  ...(layoutMode === 'landscape' ? surveyLandscapeTileStyle : surveyPortraitTileStyle),
                  ...(isFocused ? surveyFocusedTileStyle : {})
                }}
                onClick={() => onFocusAsset(asset.id)}
                title={`${asset.filename} | ${asset.photoState} | ${formatCaptureDate(asset.captureDateTime)}`}
              >
                <SurveyZoomableTile
                  asset={asset}
                  layoutMode={layoutMode}
                  onFocus={() => onFocusAsset(asset.id)}
                  onOpenImmersive={() => onOpenImmersiveAsset(asset.id)}
                />
                <div style={surveyPaneOverlayTopStyle}>
                  <div style={surveyPaneBadgeGroupStyle}>
                    <span style={surveyPaneBadgeStyle} title={asset.filename}>
                      {asset.filename}
                    </span>
                    {isFocused ? <span style={surveyPaneFocusedBadgeStyle}>Focused</span> : null}
                  </div>
                  <div style={surveyPaneBadgeGroupStyle}>
                    <span
                      style={{
                        ...surveyPaneBadgeStyle,
                        backgroundColor: photoStateColor,
                        borderColor: photoStateColor,
                        color: '#fff'
                      }}
                    >
                      {getPhotoStateBadgeLabel(asset.photoState)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>(() => {
    const cached = appBootstrapCache.assets ?? readCachedBootstrapAssets();
    if (cached) {
      appBootstrapCache.assets = cached;
      return cached.items;
    }

    return [];
  });
  const [albumTreeNodes, setAlbumTreeNodes] = useState<AlbumTreeNode[]>(() => {
    const cached = appBootstrapCache.albumTreeNodes ?? readCachedBootstrapAlbumTreeNodes();
    if (cached) {
      appBootstrapCache.albumTreeNodes = cached;
      return cached;
    }

    return [];
  });
  const [assetsLoading, setAssetsLoading] = useState(() => !(appBootstrapCache.assets ?? readCachedBootstrapAssets()));
  const [assetsScopeLoadStatus, setAssetsScopeLoadStatus] = useState<AssetsScopeLoadStatus>(() =>
    appBootstrapCache.assets ?? readCachedBootstrapAssets() ? 'indeterminate' : 'loading'
  );
  const [loadedAssetsScope, setLoadedAssetsScope] = useState<AssetsBootstrapScope>(() => {
    const cached = appBootstrapCache.assets ?? readCachedBootstrapAssets();
    if (cached) {
      appBootstrapCache.assets = cached;
      return cached.scope;
    }

    return { kind: 'all' };
  });
  const [albumTreeLoading, setAlbumTreeLoading] = useState(
    () => !(appBootstrapCache.albumTreeNodes ?? readCachedBootstrapAlbumTreeNodes())
  );
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [albumTreeError, setAlbumTreeError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDialogInitialAlbumDestination, setImportDialogInitialAlbumDestination] =
    useState<ImportAssetsDialogInitialAlbumDestination | null>(null);
  const [moveDialogNodeId, setMoveDialogNodeId] = useState<string | null>(null);
  const [createTopLevelGroupDialogOpen, setCreateTopLevelGroupDialogOpen] = useState(false);
  const [moveAssetsDialogOpen, setMoveAssetsDialogOpen] = useState(false);
  const [setCaptureDateDialogOpen, setSetCaptureDateDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [assetPeopleReviewDialogOpen, setAssetPeopleReviewDialogOpen] = useState(false);
  const [albumTreeContextMenu, setAlbumTreeContextMenu] = useState<AlbumTreeContextMenuState | null>(null);
  const [albumTreeOrderSubmenuOpen, setAlbumTreeOrderSubmenuOpen] = useState(false);
  const albumTreeContextMenuRef = useRef<HTMLDivElement | null>(null);
  const albumTreeListRef = useRef<HTMLDivElement | null>(null);
  const albumTreeNodeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const checkedAlbumRevealIndexRef = useRef(-1);
  const pendingCheckedAlbumRevealIdRef = useRef<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [albumMembershipNotice, setAlbumMembershipNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const [peopleRecognitionNotice, setPeopleRecognitionNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
    reviewAssetId?: string;
  } | null>(null);
  const [scopedPeopleDialogOpen, setScopedPeopleDialogOpen] = useState(false);
  const [scopedPeopleSummary, setScopedPeopleSummary] = useState<PeopleScopedAssetSummaryResponse | null>(null);
  const [scopedPeopleSummaryLoading, setScopedPeopleSummaryLoading] = useState(false);
  const [scopedPeopleBusyAction, setScopedPeopleBusyAction] = useState<null | 'process' | 'reprocess'>(null);
  const [scopedPeopleError, setScopedPeopleError] = useState<string | null>(null);
  const [scopedPeopleNotice, setScopedPeopleNotice] = useState<string | null>(null);
  const [assetMaintenanceBusy, setAssetMaintenanceBusy] = useState<null | 'reimport' | 'rebuild'>(null);
  const [assetMaintenanceMessage, setAssetMaintenanceMessage] = useState<string | null>(null);
  const [assetMaintenanceError, setAssetMaintenanceError] = useState(false);
  const [updatingAssetIds, setUpdatingAssetIds] = useState<Record<string, boolean>>({});
  const [peopleRecognitionBusy, setPeopleRecognitionBusy] = useState(false);
  const [mediaTypeFilters, setMediaTypeFilters] = useState<MediaType[]>([]);
  const [reviewVisiblePhotoStates, setReviewVisiblePhotoStates] = useState<PhotoState[]>(() => {
    if (typeof window === 'undefined') {
      return [PhotoState.New, PhotoState.Pending];
    }

    return parsePhotoStatesFromStorage(
      window.localStorage.getItem(reviewVisiblePhotoStatesStorageKey),
      [PhotoState.New, PhotoState.Pending]
    );
  });
  const [libraryVisiblePhotoStates, setLibraryVisiblePhotoStates] = useState<PhotoState[]>(() => {
    if (typeof window === 'undefined') {
      return [PhotoState.Keep];
    }

    return parsePhotoStatesFromStorage(
      window.localStorage.getItem(libraryVisiblePhotoStatesStorageKey),
      [PhotoState.Keep]
    );
  });
  const [searchPhotoStates, setSearchPhotoStates] = useState<PhotoState[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parsePhotoStatesFromStorage(window.localStorage.getItem(searchPhotoStatesStorageKey), []);
  });
  const [searchAlbumIds, setSearchAlbumIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parseStringArrayFromStorage(window.localStorage.getItem(searchAlbumIdsStorageKey));
  });
  const [searchGroupIds, setSearchGroupIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parseStringArrayFromStorage(window.localStorage.getItem(searchGroupIdsStorageKey));
  });
  const [searchFilenamePattern, setSearchFilenamePattern] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(searchFilenamePatternStorageKey) ?? '';
  });
  const [searchCaptureDateFrom, setSearchCaptureDateFrom] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(searchCaptureDateFromStorageKey) ?? '';
  });
  const [searchCaptureDateTo, setSearchCaptureDateTo] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(searchCaptureDateToStorageKey) ?? '';
  });
  const [searchCaptureDateAvailability, setSearchCaptureDateAvailability] =
    useState<SearchCaptureDateAvailabilityMode>(() => {
    if (typeof window === 'undefined') {
      return 'datedOnly';
    }

    return parseSearchCaptureDateAvailabilityModeFromStorage(
      window.localStorage.getItem(searchCaptureDateAvailabilityStorageKey),
      window.localStorage.getItem(searchIncludeNoCaptureDateStorageKey)
    );
  });
  const [searchPeopleIds, setSearchPeopleIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return parseStringArrayFromStorage(window.localStorage.getItem(searchPeopleIdsStorageKey));
  });
  const [searchPeopleMatchMode, setSearchPeopleMatchMode] = useState<SearchPeopleMatchMode>(() => {
    if (typeof window === 'undefined') {
      return 'Any';
    }

    return parseSearchPeopleMatchModeFromStorage(window.localStorage.getItem(searchPeopleMatchModeStorageKey));
  });
  const [searchHasNoPeople, setSearchHasNoPeople] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return parseBooleanFromStorage(window.localStorage.getItem(searchHasNoPeopleStorageKey));
  });
  const [searchHasReviewableFaces, setSearchHasReviewableFaces] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return parseBooleanFromStorage(window.localStorage.getItem(searchHasReviewableFacesStorageKey));
  });
  const [searchKeywordId, setSearchKeywordId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = window.localStorage.getItem(searchKeywordIdStorageKey);
    return typeof stored === 'string' && stored.trim().length > 0 ? stored : null;
  });
  const [appliedSearchFilters, setAppliedSearchFilters] = useState<SearchFilters | null>(null);
  const [searchKeywordQuery, setSearchKeywordQuery] = useState('');
  const [searchPeopleQuery, setSearchPeopleQuery] = useState('');
  const [searchPeopleOptions, setSearchPeopleOptions] = useState<Person[]>([]);
  const [searchPeopleLoading, setSearchPeopleLoading] = useState(false);
  const [searchPeopleError, setSearchPeopleError] = useState<string | null>(null);
  const searchPeopleAttemptedRef = useRef(false);
  useEffect(() => {
    if (!location.search) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestedArea = params.get('area');
    const requestedPeopleIds = (params.get('people') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedPeopleMode = params.get('peopleMode');
    const requestedHasNoPeople = params.get('hasNoPeople');
    const requestedHasReviewableFaces = params.get('hasReviewableFaces');
    const requestedPeopleQuery = params.get('peopleQuery');

    let applied = false;

    if (
      requestedArea === 'Search' ||
      requestedPeopleIds.length > 0 ||
      requestedHasNoPeople === 'true' ||
      requestedHasReviewableFaces === 'true'
    ) {
      setPrimaryArea('Search');
      applied = true;
    } else if (requestedArea === 'Library' || requestedArea === 'Review') {
      setPrimaryArea(requestedArea);
      applied = true;
    }

    if (requestedPeopleIds.length > 0) {
      setSearchPeopleIds(requestedPeopleIds);
      setSearchHasNoPeople(false);
      applied = true;
    }

    if (requestedPeopleMode === 'Any' || requestedPeopleMode === 'All') {
      setSearchPeopleMatchMode(requestedPeopleMode);
      applied = true;
    }

    if (requestedHasNoPeople === 'true' || requestedHasNoPeople === 'false') {
      const nextHasNoPeople = requestedHasNoPeople === 'true';
      setSearchHasNoPeople(nextHasNoPeople);
      if (nextHasNoPeople) {
        setSearchPeopleIds([]);
      }
      applied = true;
    }

    if (requestedHasReviewableFaces === 'true' || requestedHasReviewableFaces === 'false') {
      setSearchHasReviewableFaces(requestedHasReviewableFaces === 'true');
      applied = true;
    }

    if (requestedPeopleQuery !== null) {
      setSearchPeopleQuery(requestedPeopleQuery);
      applied = true;
    }

    if (!applied) {
      return;
    }

    void navigate(
      {
        pathname: location.pathname,
        search: ''
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<MediaAsset | null>(null);
  const [selectedAssetPeopleStatus, setSelectedAssetPeopleStatus] = useState<ListAssetFaceDetectionsResponse | null>(null);
  const [selectedAssetPeopleStatusLoading, setSelectedAssetPeopleStatusLoading] = useState(false);
  const [selectedAssetPeopleStatusError, setSelectedAssetPeopleStatusError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [keywordUpdateBusy, setKeywordUpdateBusy] = useState(false);
  const [recentKeywordIds, setRecentKeywordIds] = useState<string[]>(() => readRecentKeywordIds());
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbum[]>([]);
  const [smartAlbumsLoading, setSmartAlbumsLoading] = useState(false);
  const [smartAlbumsError, setSmartAlbumsError] = useState<string | null>(null);
  const [activeSmartAlbumId, setActiveSmartAlbumId] = useState<string | null>(null);
  const [smartAlbumSaveLabel, setSmartAlbumSaveLabel] = useState('');
  const [smartAlbumSaveBusy, setSmartAlbumSaveBusy] = useState(false);
  const [smartAlbumSaveError, setSmartAlbumSaveError] = useState<string | null>(null);
  const [smartAlbumSaveNotice, setSmartAlbumSaveNotice] = useState<string | null>(null);
  const assetsLoadGenerationRef = useRef(0);
  const [selectionAnchorAssetId, setSelectionAnchorAssetId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>('Grid');
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [slideshowIntervalMs] = useState(5000);
  const [advanceAfterRating, setAdvanceAfterRating] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(advanceAfterRatingStorageKey) === 'true';
  });
  const [detailsPanelsVisible, setDetailsPanelsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(detailsPanelsVisibleStorageKey);
    return stored === null ? true : stored === 'true';
  });
  const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(leftPanelVisibleStorageKey);
    return stored === null ? true : stored === 'true';
  });
  const [showFilmstrip, setShowFilmstrip] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(showFilmstripStorageKey);
    return stored === null ? true : stored === 'true';
  });
  const [showThumbnailPhotoStateBadges, setShowThumbnailPhotoStateBadges] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(showThumbnailPhotoStateBadgesStorageKey);
    return stored === null ? true : stored === 'true';
  });
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [thumbnailSizeMenuOpen, setThumbnailSizeMenuOpen] = useState(false);
  const [toolbarOverflowOpen, setToolbarOverflowOpen] = useState(false);
  const [primaryArea, setPrimaryArea] = useState<TedographyPrimaryArea>(() => {
    if (typeof window === 'undefined') {
      return 'Review';
    }

    return parsePrimaryAreaFromStorage(window.localStorage.getItem(primaryAreaStorageKey));
  });
  const [checkedAlbumIds, setCheckedAlbumIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const stored = window.localStorage.getItem(checkedAlbumIdsStorageKey);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  });
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const stored = window.localStorage.getItem(expandedAlbumTreeGroupIdsStorageKey);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  });
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [libraryBrowseMode, setLibraryBrowseMode] = useState<LibraryBrowseMode>(() => {
    if (typeof window === 'undefined') {
      return 'Timeline';
    }

    return parseLibraryBrowseModeFromStorage(
      window.localStorage.getItem(libraryBrowseModeStorageKey)
    );
  });
  const [reviewBrowseMode, setReviewBrowseMode] = useState<ReviewBrowseMode>(() => {
    if (typeof window === 'undefined') {
      return 'Albums';
    }

    return parseReviewBrowseModeFromStorage(
      window.localStorage.getItem(reviewBrowseModeStorageKey)
    );
  });
  const [albumResultsPresentation, setAlbumResultsPresentation] =
    useState<AlbumResultsPresentation>(() => {
      if (typeof window === 'undefined') {
        return 'Merged';
      }

      return parseAlbumResultsPresentationFromStorage(
        window.localStorage.getItem(albumResultsPresentationStorageKey)
      );
    });
  const [albumTreeSortMode, setAlbumTreeSortMode] = useState<AlbumTreeSortMode>(() => {
    if (typeof window === 'undefined') {
      return 'Custom';
    }

    return parseAlbumTreeSortModeFromStorage(
      window.localStorage.getItem(albumTreeSortModeStorageKey)
    );
  });
  const [timelineNavExpandedYearKeys, setTimelineNavExpandedYearKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const stored = window.localStorage.getItem(timelineNavExpandedYearKeysStorageKey);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  });
  const [timelineZoomLevel, setTimelineZoomLevel] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 2;
    }

    return parseTimelineZoomLevelFromStorage(
      window.localStorage.getItem(timelineZoomLevelStorageKey)
    );
  });
  const [activeTimelineMonthKey, setActiveTimelineMonthKey] = useState<string | null>(null);
  const mainColumnRef = useRef<HTMLElement | null>(null);
  const viewOptionsRootRef = useRef<HTMLDivElement | null>(null);
  const thumbnailSizeRootRef = useRef<HTMLDivElement | null>(null);
  const toolbarOverflowRootRef = useRef<HTMLDivElement | null>(null);
  const pendingGridRevealAssetIdRef = useRef<string | null>(null);
  const timelineSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const previousIsTimelineModeRef = useRef(false);
  const pendingTimelineRestoreRef = useRef<{ scrollY: number; contentSignature: string } | null>(null);
  const timelineScrollMemoryRef = useRef<{ scrollY: number; contentSignature: string } | null>(null);
  const pendingTimelineZoomAnchorKeyRef = useRef<string | null>(null);
  const [viewOptionsMenuPosition, setViewOptionsMenuPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0
  });
  const [thumbnailSizeMenuPosition, setThumbnailSizeMenuPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0
  });
  const [toolbarOverflowMenuPosition, setToolbarOverflowMenuPosition] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0
  });

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.status === 'string') {
          setHealthStatus(data.status);
          return;
        }
        setHealthStatus(data.ok ? 'ok' : 'error');
      })
      .catch(() => setHealthStatus('error'));
  }, []);

  useEffect(() => {
    if (!viewOptionsOpen) {
      return;
    }

    function updateViewOptionsMenuPosition(): void {
      const rect = viewOptionsRootRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setViewOptionsMenuPosition({
        top: rect.bottom + 6,
        right: Math.max(window.innerWidth - rect.right, 8)
      });
    }

    updateViewOptionsMenuPosition();

    function handleWindowPointerDown(event: MouseEvent): void {
      if (!(event.target instanceof Node)) {
        setViewOptionsOpen(false);
        return;
      }

      const optionsRoot = document.getElementById('tdg-view-options-root');
      if (optionsRoot?.contains(event.target)) {
        return;
      }

      setViewOptionsOpen(false);
    }

    window.addEventListener('resize', updateViewOptionsMenuPosition);
    window.addEventListener('scroll', updateViewOptionsMenuPosition, true);
    window.addEventListener('mousedown', handleWindowPointerDown);
    return () => {
      window.removeEventListener('resize', updateViewOptionsMenuPosition);
      window.removeEventListener('scroll', updateViewOptionsMenuPosition, true);
      window.removeEventListener('mousedown', handleWindowPointerDown);
    };
  }, [viewOptionsOpen]);

  useEffect(() => {
    if (!thumbnailSizeMenuOpen) {
      return;
    }

    function updateThumbnailSizeMenuPosition(): void {
      const rect = thumbnailSizeRootRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setThumbnailSizeMenuPosition({
        top: rect.bottom + 6,
        right: Math.max(window.innerWidth - rect.right, 8)
      });
    }

    updateThumbnailSizeMenuPosition();

    function handleWindowPointerDown(event: MouseEvent): void {
      if (!(event.target instanceof Node)) {
        setThumbnailSizeMenuOpen(false);
        return;
      }

      const menuRoot = document.getElementById('tdg-thumbnail-size-root');
      if (menuRoot?.contains(event.target)) {
        return;
      }

      setThumbnailSizeMenuOpen(false);
    }

    window.addEventListener('resize', updateThumbnailSizeMenuPosition);
    window.addEventListener('scroll', updateThumbnailSizeMenuPosition, true);
    window.addEventListener('mousedown', handleWindowPointerDown);
    return () => {
      window.removeEventListener('resize', updateThumbnailSizeMenuPosition);
      window.removeEventListener('scroll', updateThumbnailSizeMenuPosition, true);
      window.removeEventListener('mousedown', handleWindowPointerDown);
    };
  }, [thumbnailSizeMenuOpen]);

  useEffect(() => {
    if (!toolbarOverflowOpen) {
      return;
    }

    function updateToolbarOverflowMenuPosition(): void {
      const rect = toolbarOverflowRootRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setToolbarOverflowMenuPosition({
        top: rect.bottom + 6,
        right: Math.max(window.innerWidth - rect.right, 8)
      });
    }

    updateToolbarOverflowMenuPosition();

    function handleWindowPointerDown(event: MouseEvent): void {
      if (!(event.target instanceof Node)) {
        setToolbarOverflowOpen(false);
        return;
      }

      const menuRoot = document.getElementById('tdg-toolbar-overflow-root');
      if (menuRoot?.contains(event.target)) {
        return;
      }

      setToolbarOverflowOpen(false);
    }

    window.addEventListener('resize', updateToolbarOverflowMenuPosition);
    window.addEventListener('scroll', updateToolbarOverflowMenuPosition, true);
    window.addEventListener('mousedown', handleWindowPointerDown);
    return () => {
      window.removeEventListener('resize', updateToolbarOverflowMenuPosition);
      window.removeEventListener('scroll', updateToolbarOverflowMenuPosition, true);
      window.removeEventListener('mousedown', handleWindowPointerDown);
    };
  }, [toolbarOverflowOpen]);

  useEffect(() => {
    window.localStorage.setItem(advanceAfterRatingStorageKey, advanceAfterRating ? 'true' : 'false');
  }, [advanceAfterRating]);

  useEffect(() => {
    window.localStorage.setItem(
      reviewVisiblePhotoStatesStorageKey,
      JSON.stringify(reviewVisiblePhotoStates)
    );
  }, [reviewVisiblePhotoStates]);

  useEffect(() => {
    window.localStorage.setItem(
      libraryVisiblePhotoStatesStorageKey,
      JSON.stringify(libraryVisiblePhotoStates)
    );
  }, [libraryVisiblePhotoStates]);

  useEffect(() => {
    window.localStorage.setItem(detailsPanelsVisibleStorageKey, detailsPanelsVisible ? 'true' : 'false');
  }, [detailsPanelsVisible]);

  useEffect(() => {
    window.localStorage.setItem(leftPanelVisibleStorageKey, leftPanelVisible ? 'true' : 'false');
  }, [leftPanelVisible]);

  useEffect(() => {
    window.localStorage.setItem(showFilmstripStorageKey, showFilmstrip ? 'true' : 'false');
  }, [showFilmstrip]);

  useEffect(() => {
    window.localStorage.setItem(
      showThumbnailPhotoStateBadgesStorageKey,
      showThumbnailPhotoStateBadges ? 'true' : 'false'
    );
  }, [showThumbnailPhotoStateBadges]);

  useEffect(() => {
    window.localStorage.setItem(primaryAreaStorageKey, primaryArea);
  }, [primaryArea]);

  useEffect(() => {
    window.localStorage.setItem(reviewBrowseModeStorageKey, reviewBrowseMode);
  }, [reviewBrowseMode]);

  useEffect(() => {
    window.localStorage.setItem(libraryBrowseModeStorageKey, libraryBrowseMode);
  }, [libraryBrowseMode]);

  useEffect(() => {
    window.localStorage.setItem(albumResultsPresentationStorageKey, albumResultsPresentation);
  }, [albumResultsPresentation]);

  useEffect(() => {
    window.localStorage.setItem(albumTreeSortModeStorageKey, albumTreeSortMode);
  }, [albumTreeSortMode]);

  useEffect(() => {
    window.localStorage.setItem(
      timelineNavExpandedYearKeysStorageKey,
      JSON.stringify(timelineNavExpandedYearKeys)
    );
  }, [timelineNavExpandedYearKeys]);

  useEffect(() => {
    window.localStorage.setItem(timelineZoomLevelStorageKey, String(timelineZoomLevel));
  }, [timelineZoomLevel]);

  useEffect(() => {
    window.localStorage.setItem(checkedAlbumIdsStorageKey, JSON.stringify(checkedAlbumIds));
  }, [checkedAlbumIds]);

  useEffect(() => {
    window.localStorage.setItem(expandedAlbumTreeGroupIdsStorageKey, JSON.stringify(expandedGroupIds));
  }, [expandedGroupIds]);

  useEffect(() => {
    window.localStorage.setItem(searchPhotoStatesStorageKey, JSON.stringify(searchPhotoStates));
  }, [searchPhotoStates]);

  useEffect(() => {
    window.localStorage.setItem(searchAlbumIdsStorageKey, JSON.stringify(searchAlbumIds));
  }, [searchAlbumIds]);

  useEffect(() => {
    window.localStorage.setItem(searchGroupIdsStorageKey, JSON.stringify(searchGroupIds));
  }, [searchGroupIds]);

  useEffect(() => {
    window.localStorage.setItem(searchFilenamePatternStorageKey, searchFilenamePattern);
  }, [searchFilenamePattern]);

  useEffect(() => {
    window.localStorage.setItem(searchCaptureDateFromStorageKey, searchCaptureDateFrom);
  }, [searchCaptureDateFrom]);

  useEffect(() => {
    window.localStorage.setItem(searchCaptureDateToStorageKey, searchCaptureDateTo);
  }, [searchCaptureDateTo]);

  useEffect(() => {
    window.localStorage.setItem(
      searchCaptureDateAvailabilityStorageKey,
      searchCaptureDateAvailability
    );
  }, [searchCaptureDateAvailability]);

  useEffect(() => {
    window.localStorage.setItem(searchPeopleIdsStorageKey, JSON.stringify(searchPeopleIds));
  }, [searchPeopleIds]);

  useEffect(() => {
    window.localStorage.setItem(searchPeopleMatchModeStorageKey, searchPeopleMatchMode);
  }, [searchPeopleMatchMode]);

  useEffect(() => {
    window.localStorage.setItem(searchHasNoPeopleStorageKey, String(searchHasNoPeople));
  }, [searchHasNoPeople]);

  useEffect(() => {
    window.localStorage.setItem(searchHasReviewableFacesStorageKey, String(searchHasReviewableFaces));
  }, [searchHasReviewableFaces]);

  useEffect(() => {
    if (searchKeywordId) {
      window.localStorage.setItem(searchKeywordIdStorageKey, searchKeywordId);
      return;
    }

    window.localStorage.removeItem(searchKeywordIdStorageKey);
  }, [searchKeywordId]);

  useEffect(() => {
    if (assets.length > 0) {
      writeSessionStorageJson(assetsBootstrapStorageKey, {
        items: assets,
        scope: appBootstrapCache.assets?.scope ?? { kind: 'all' }
      } satisfies CachedBootstrapAssets);
    }
  }, [assets]);

  useEffect(() => {
    if (albumTreeNodes.length > 0) {
      writeSessionStorageJson(albumTreeBootstrapStorageKey, albumTreeNodes);
    }
  }, [albumTreeNodes]);

  const preferredStartupAssetsScope = useMemo<AssetsBootstrapScope>(() => {
    if (primaryArea !== 'Library' || libraryBrowseMode !== 'Albums' || checkedAlbumIds.length === 0) {
      return { kind: 'all' };
    }

    return normalizeAssetsBootstrapScope({
      kind: 'albums',
      albumIds: checkedAlbumIds
    });
  }, [checkedAlbumIds, libraryBrowseMode, primaryArea]);

  async function loadAssets(options?: {
    showLoading?: boolean;
    scope?: AssetsBootstrapScope;
    preserveCachedFirstPage?: boolean;
  }): Promise<void> {
    const startedAt = typeof window !== 'undefined' ? performance.now() : 0;
    const generation = assetsLoadGenerationRef.current + 1;
    assetsLoadGenerationRef.current = generation;
    const scope = normalizeAssetsBootstrapScope(options?.scope ?? preferredStartupAssetsScope);
    const scopeKey = getAssetsBootstrapScopeKey(scope);
    const cachedAssets = appBootstrapCache.assets;
    const cachedAssetsForScope =
      cachedAssets && getAssetsBootstrapScopeKey(cachedAssets.scope) === scopeKey ? cachedAssets.items : null;
    if (options?.showLoading ?? true) {
      setAssetsLoading(true);
    }

    setLoadedAssetsScope(scope);
    setAssetsScopeLoadStatus('loading');
    setAssetsError(null);

    try {
      const response = await fetch(buildAssetsPageRequestPath(scope, 0, initialAssetsPageSize));
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      logBootstrapTiming('assets fetch response', startedAt);

      const data = (await response.json()) as AssetPageResponse;
      logBootstrapTiming(`assets json parsed (${data.items.length} assets in first page)`, startedAt);
      if (generation !== assetsLoadGenerationRef.current) {
        return;
      }

      const shouldPreserveCachedAssets =
        options?.preserveCachedFirstPage !== false &&
        Array.isArray(cachedAssetsForScope) &&
        cachedAssetsForScope.length > data.items.length;
      const initialAssets = shouldPreserveCachedAssets ? cachedAssetsForScope : data.items;

      setAssets(initialAssets);
      appBootstrapCache.assets = {
        items: initialAssets,
        scope
      };
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          logBootstrapTiming('assets scheduled into React state', startedAt);
        });
      }

      if (data.hasMore) {
        void (async () => {
          let combined = initialAssets;
          let nextOffset = shouldPreserveCachedAssets
            ? initialAssets.length
            : data.offset + data.items.length;
          let hasMore = data.hasMore;

          while (hasMore && generation === assetsLoadGenerationRef.current) {
            const pageResponse = await fetch(buildAssetsPageRequestPath(scope, nextOffset, backgroundAssetsPageSize));
            if (!pageResponse.ok) {
              throw new Error(`Request failed with status ${pageResponse.status}`);
            }

            const page = (await pageResponse.json()) as AssetPageResponse;
            if (generation !== assetsLoadGenerationRef.current) {
              return;
            }

            combined = [...combined, ...page.items];
            nextOffset = page.offset + page.items.length;
            hasMore = page.hasMore;

            setAssets(combined);
            appBootstrapCache.assets = {
              items: combined,
              scope
            };
          }

          if (generation === assetsLoadGenerationRef.current) {
            setAssetsScopeLoadStatus('complete');
          }
        })().catch((error: unknown) => {
          if (generation !== assetsLoadGenerationRef.current) {
            return;
          }

          setAssetsScopeLoadStatus('indeterminate');
          if (error instanceof Error) {
            setAssetsError(error.message);
          } else {
            setAssetsError('Unknown error');
          }
        });
      } else {
        setAssetsScopeLoadStatus('complete');
      }
    } catch (error: unknown) {
      setAssetsScopeLoadStatus('indeterminate');
      if (error instanceof Error) {
        setAssetsError(error.message);
        return;
      }
      setAssetsError('Unknown error');
    } finally {
      setAssetsLoading(false);
    }
  }

  async function loadAssetDetails(assetId: string): Promise<MediaAsset> {
    const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as MediaAsset;
  }

  async function loadSelectedAssetPeopleStatus(assetId: string): Promise<void> {
    setSelectedAssetPeopleStatusLoading(true);
    setSelectedAssetPeopleStatusError(null);

    try {
      const state = await getPeoplePipelineAssetState(assetId);
      setSelectedAssetPeopleStatus(state);
      setAssets((previous) =>
        previous.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                people: state.people,
                detectionsCount: state.detections.length,
                reviewableDetectionsCount: state.detections.filter(
                  (detection) =>
                    detection.matchStatus === 'unmatched' ||
                    detection.matchStatus === 'suggested' ||
                    detection.matchStatus === 'autoMatched'
                ).length,
                confirmedDetectionsCount: state.detections.filter(
                  (detection) => detection.matchStatus === 'confirmed'
                ).length
              }
            : asset
        )
      );
      setSelectedAssetDetails((current) =>
        current?.id === assetId
          ? {
              ...current,
              people: state.people,
              detectionsCount: state.detections.length,
              reviewableDetectionsCount: state.detections.filter(
                (detection) =>
                  detection.matchStatus === 'unmatched' ||
                  detection.matchStatus === 'suggested' ||
                  detection.matchStatus === 'autoMatched'
              ).length,
              confirmedDetectionsCount: state.detections.filter(
                (detection) => detection.matchStatus === 'confirmed'
              ).length
            }
          : current
      );
    } catch (error) {
      setSelectedAssetPeopleStatus(null);
      setSelectedAssetPeopleStatusError(
        error instanceof Error ? error.message : 'Failed to load people status'
      );
    } finally {
      setSelectedAssetPeopleStatusLoading(false);
    }
  }

  async function loadAlbumTreeNodes(options?: { showLoading?: boolean }): Promise<void> {
    if (options?.showLoading ?? true) {
      setAlbumTreeLoading(true);
    }

    setAlbumTreeError(null);

    try {
      const data = await listAlbumTreeNodes();
      setAlbumTreeNodes(data);
      appBootstrapCache.albumTreeNodes = data;
    } catch (error: unknown) {
      if (error instanceof Error) {
        setAlbumTreeError(error.message);
      } else {
        setAlbumTreeError('Unknown error');
      }
    } finally {
      setAlbumTreeLoading(false);
    }
  }

  async function loadKeywords(options?: { showLoading?: boolean }): Promise<void> {
    if (options?.showLoading ?? true) {
      setKeywordsLoading(true);
    }

    setKeywordsError(null);

    try {
      const response = await listKeywordsRequest();
      setKeywords(sortKeywordsByPath(response.items));
    } catch (error) {
      setKeywordsError(error instanceof Error ? error.message : 'Failed to load keywords');
    } finally {
      setKeywordsLoading(false);
    }
  }

  async function loadSmartAlbums(options?: { showLoading?: boolean }): Promise<void> {
    if (options?.showLoading ?? true) {
      setSmartAlbumsLoading(true);
    }

    setSmartAlbumsError(null);

    try {
      const response = await listSmartAlbumsRequest();
      setSmartAlbums(response.items);
    } catch (error) {
      setSmartAlbumsError(error instanceof Error ? error.message : 'Failed to load Smart Albums');
    } finally {
      setSmartAlbumsLoading(false);
    }
  }

  function rememberRecentKeywordIds(keywordIds: string[]): void {
    if (keywordIds.length === 0) {
      return;
    }

    setRecentKeywordIds((current) => {
      const next = [...keywordIds, ...current.filter((keywordId) => !keywordIds.includes(keywordId))].slice(0, 8);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(recentKeywordIdsStorageKey, JSON.stringify(next));
        } catch {
          // Best-effort only.
        }
      }

      return next;
    });
  }

  useEffect(() => {
    const hasCachedAssets = Array.isArray(appBootstrapCache.assets?.items);
    const hasCachedAlbumTree = Array.isArray(appBootstrapCache.albumTreeNodes);

    if (hasCachedAssets && appBootstrapCache.assets) {
      setAssets(appBootstrapCache.assets.items);
      setAssetsLoading(false);
      void loadAssets({ showLoading: false });
    } else {
      void loadAssets({ showLoading: true });
    }

    if (hasCachedAlbumTree && appBootstrapCache.albumTreeNodes) {
      setAlbumTreeNodes(appBootstrapCache.albumTreeNodes);
      setAlbumTreeLoading(false);
      void loadAlbumTreeNodes({ showLoading: false });
    } else {
      void loadAlbumTreeNodes({ showLoading: true });
    }

    void loadKeywords({ showLoading: true });
    void loadSmartAlbums({ showLoading: true });
  }, []);

  useEffect(() => {
    const currentScope = appBootstrapCache.assets?.scope ?? { kind: 'all' };
    if (currentScope.kind !== 'albums') {
      return;
    }

    const currentScopeKey = getAssetsBootstrapScopeKey(currentScope);
    const preferredScopeKey = getAssetsBootstrapScopeKey(preferredStartupAssetsScope);
    if (currentScopeKey === preferredScopeKey) {
      return;
    }

    void loadAssets({ showLoading: false, scope: preferredStartupAssetsScope });
  }, [preferredStartupAssetsScope]);

  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedAssetDetails(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const asset = await loadAssetDetails(selectedAssetId);
        if (!cancelled) {
          setSelectedAssetDetails(asset);
        }
      } catch {
        if (!cancelled) {
          setSelectedAssetDetails(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId]);

  useEffect(() => {
    if (primaryArea !== 'Library' || !selectedAssetId || selectedAssetIds.length !== 1) {
      setSelectedAssetPeopleStatus(null);
      setSelectedAssetPeopleStatusError(null);
      setSelectedAssetPeopleStatusLoading(false);
      setAssetPeopleReviewDialogOpen(false);
      return;
    }

    void loadSelectedAssetPeopleStatus(selectedAssetId);
  }, [primaryArea, selectedAssetId, selectedAssetIds.length]);

  useEffect(() => {
    if (primaryArea !== 'Search') {
      return;
    }

    if (searchPeopleOptions.length > 0 || searchPeopleLoading || searchPeopleAttemptedRef.current) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, 8000);
    setSearchPeopleLoading(true);
    setSearchPeopleError(null);
    searchPeopleAttemptedRef.current = true;

    void listPeople({ signal: abortController.signal })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setSearchPeopleOptions(response.items);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          setSearchPeopleError('Timed out loading the people list. Showing confirmed people already present in library data.');
          return;
        }

        setSearchPeopleError(error instanceof Error ? error.message : 'Failed to load people');
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setSearchPeopleLoading(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [primaryArea, searchPeopleLoading, searchPeopleOptions.length]);

  useEffect(() => {
    if (albumTreeLoading) {
      return;
    }

    const albumNodeIds = new Set(
      albumTreeNodes.filter((node) => node.nodeType === 'Album').map((node) => node.id)
    );

    const nextCheckedIds = checkedAlbumIds.filter((id) => albumNodeIds.has(id));
    if (!arraysEqual(nextCheckedIds, checkedAlbumIds)) {
      setCheckedAlbumIds(nextCheckedIds);
    }

    const nextSearchAlbumIds = searchAlbumIds.filter((id) => albumNodeIds.has(id));
    if (!arraysEqual(nextSearchAlbumIds, searchAlbumIds)) {
      setSearchAlbumIds(nextSearchAlbumIds);
    }

    const groupNodeIds = new Set(
      albumTreeNodes.filter((node) => node.nodeType === 'Group').map((node) => node.id)
    );
    const nextSearchGroupIds = searchGroupIds.filter((id) => groupNodeIds.has(id));
    if (!arraysEqual(nextSearchGroupIds, searchGroupIds)) {
      setSearchGroupIds(nextSearchGroupIds);
    }
    const nextExpandedIds = expandedGroupIds.filter((id) => groupNodeIds.has(id));
    if (!arraysEqual(nextExpandedIds, expandedGroupIds)) {
      setExpandedGroupIds(nextExpandedIds);
    }

    if (selectedTreeNodeId) {
      const exists = albumTreeNodes.some((node) => node.id === selectedTreeNodeId);
      if (!exists) {
        setSelectedTreeNodeId(null);
      }
    }
  }, [
    albumTreeLoading,
    albumTreeNodes,
    checkedAlbumIds,
    expandedGroupIds,
    searchAlbumIds,
    searchGroupIds,
    selectedTreeNodeId
  ]);

  const selectedAssetIdsForAlbumAction = useMemo(() => {
    return selectedAssetIds;
  }, [selectedAssetIds]);

  const albumNodesById = useMemo(
    () =>
      new Map<string, AlbumTreeNode>(
        albumTreeNodes.map((node) => [node.id, node])
      ),
    [albumTreeNodes]
  );
  const assetsById = useMemo(
    () =>
      new Map<string, MediaAsset>(
        assets.map((asset) => [asset.id, asset])
      ),
    [assets]
  );
  const selectedTreeNode = useMemo(
    () => (selectedTreeNodeId ? albumNodesById.get(selectedTreeNodeId) ?? null : null),
    [albumNodesById, selectedTreeNodeId]
  );
  const implicitAlbumForMembershipAction = useMemo(
    () =>
      ((primaryArea === 'Library' && libraryBrowseMode === 'Albums') ||
        (primaryArea === 'Review' && reviewBrowseMode === 'Albums')) &&
      checkedAlbumIds.length === 1
        ? (() => {
            const candidate = albumNodesById.get(checkedAlbumIds[0] ?? '');
            return candidate?.nodeType === 'Album' ? candidate : null;
          })()
        : null,
    [albumNodesById, checkedAlbumIds, libraryBrowseMode, primaryArea, reviewBrowseMode]
  );
  const focusedAlbumForMembershipAction = useMemo(
    () =>
      selectedTreeNode?.nodeType === 'Album'
        ? selectedTreeNode
        : implicitAlbumForMembershipAction,
    [implicitAlbumForMembershipAction, selectedTreeNode]
  );
  const albumTreeCreationParentId = useMemo(
    () => resolveAlbumTreeCreationParentId(selectedTreeNode),
    [selectedTreeNode]
  );
  const canCreateGroupNode = !albumTreeLoading;
  const canCreateAlbumNode = !albumTreeLoading;

  const albumNodes = useMemo(
    () => albumTreeNodes.filter((node) => node.nodeType === 'Album'),
    [albumTreeNodes]
  );

  const albumAssetCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const asset of assets) {
      if (asset.photoState === PhotoState.Discard) {
        continue;
      }

      for (const albumId of asset.albumIds ?? []) {
        counts.set(albumId, (counts.get(albumId) ?? 0) + 1);
      }
    }

    return counts;
  }, [assets]);
  const albumAssetCountStatuses = useMemo(() => {
    const statuses = new Map<string, AlbumAssetCountStatus>();

    for (const album of albumNodes) {
      if (
        loadedAssetsScope.kind === 'albums' &&
        !loadedAssetsScope.albumIds.includes(album.id)
      ) {
        statuses.set(album.id, 'not-in-current-scope');
        continue;
      }

      statuses.set(
        album.id,
        assetsScopeLoadStatus === 'complete' ? 'known-complete' : 'loading-indeterminate'
      );
    }

    return statuses;
  }, [albumNodes, assetsScopeLoadStatus, loadedAssetsScope]);

  const areaDefaultPhotoStates = useMemo(
    () => getDefaultPhotoStatesForPrimaryArea(primaryArea),
    [primaryArea]
  );

  const currentAreaPhotoStates = useMemo(() => {
    if (primaryArea === 'Review') {
      return reviewVisiblePhotoStates;
    }

    if (primaryArea === 'Library') {
      return libraryVisiblePhotoStates;
    }

    return areaDefaultPhotoStates ?? photoStateFilterOptions;
  }, [
    areaDefaultPhotoStates,
    libraryVisiblePhotoStates,
    primaryArea,
    reviewVisiblePhotoStates
  ]);

  const areaPhotoStateVisibleAssets = useMemo(
    () =>
      primaryArea === 'Search'
        ? assets
        : assets.filter((asset) => currentAreaPhotoStates.includes(asset.photoState)),
    [assets, currentAreaPhotoStates, primaryArea]
  );
  const pendingSearchFilters = useMemo<SearchFilters>(
    () => ({
      photoStates: searchPhotoStates,
      albumIds: searchAlbumIds,
      groupIds: searchGroupIds,
      filenamePattern: searchFilenamePattern,
      captureDateFrom: searchCaptureDateFrom,
      captureDateTo: searchCaptureDateTo,
      captureDateAvailability: searchCaptureDateAvailability,
      peopleIds: searchPeopleIds,
      peopleMatchMode: searchPeopleMatchMode,
      hasNoPeople: searchHasNoPeople,
      hasReviewableFaces: searchHasReviewableFaces,
      keywordId: searchKeywordId
    }),
    [
      searchAlbumIds,
      searchCaptureDateAvailability,
      searchCaptureDateFrom,
      searchCaptureDateTo,
      searchFilenamePattern,
      searchGroupIds,
      searchHasNoPeople,
      searchHasReviewableFaces,
      searchKeywordId,
      searchPeopleIds,
      searchPeopleMatchMode,
      searchPhotoStates
    ]
  );
  const activeSearchKeywordIds = useMemo(() => {
    if (!appliedSearchFilters?.keywordId) {
      return null;
    }

    return collectKeywordDescendantIds(keywords, appliedSearchFilters.keywordId);
  }, [appliedSearchFilters?.keywordId, keywords]);

  const searchResults = useMemo(() => {
    if (primaryArea !== 'Search' || appliedSearchFilters === null) {
      return [];
    }

    const searchAlbumIdsSet = new Set(appliedSearchFilters.albumIds);
    const searchGroupAlbumIdsSet = new Set(
      getDescendantAlbumIdsForGroupIds(albumTreeNodes, appliedSearchFilters.groupIds)
    );

    const filtered = areaPhotoStateVisibleAssets.filter((asset) => {
      const matchesPhotoState =
        appliedSearchFilters.photoStates.length === 0 ||
        appliedSearchFilters.photoStates.includes(asset.photoState);
      const matchesAlbum =
        appliedSearchFilters.albumIds.length === 0 ||
        (asset.albumIds ?? []).some((albumId) => searchAlbumIdsSet.has(albumId));
      const matchesGroup =
        appliedSearchFilters.groupIds.length === 0 ||
        (asset.albumIds ?? []).some((albumId) => searchGroupAlbumIdsSet.has(albumId));
      const matchesFilename = doesAssetMatchSearchFilename(asset, appliedSearchFilters.filenamePattern);
      const matchesCaptureDateRange = doesAssetMatchSearchCaptureDateRange(
        asset,
        appliedSearchFilters.captureDateFrom,
        appliedSearchFilters.captureDateTo,
        appliedSearchFilters.captureDateAvailability
      );
      const matchesPeople = doesAssetMatchSearchPeopleFilters(
        asset,
        appliedSearchFilters.peopleIds,
        appliedSearchFilters.peopleMatchMode,
        appliedSearchFilters.hasNoPeople,
        appliedSearchFilters.hasReviewableFaces
      );
      const matchesKeyword =
        activeSearchKeywordIds === null ||
        (asset.keywordIds ?? []).some((keywordId) => activeSearchKeywordIds.has(keywordId));

      return (
        matchesPhotoState &&
        matchesAlbum &&
        matchesGroup &&
        matchesFilename &&
        matchesCaptureDateRange &&
        matchesPeople &&
        matchesKeyword
      );
    });

    return sortVisibleAssetsForTimeline(filtered);
  }, [
    appliedSearchFilters,
    albumTreeNodes,
    areaPhotoStateVisibleAssets,
    primaryArea,
    activeSearchKeywordIds,
  ]);

  const assetsAfterAdditionalFilters = useMemo(() => {
    return areaPhotoStateVisibleAssets;
  }, [areaPhotoStateVisibleAssets]);

  const checkedAlbumIdsSet = useMemo(() => new Set(checkedAlbumIds), [checkedAlbumIds]);

  const hasAssetsInCheckedAlbumsInAreaScope = useMemo(() => {
    if (checkedAlbumIds.length === 0) {
      return false;
    }

    return areaPhotoStateVisibleAssets.some((asset) =>
      (asset.albumIds ?? []).some((albumId) => checkedAlbumIdsSet.has(albumId))
    );
  }, [checkedAlbumIds.length, checkedAlbumIdsSet, areaPhotoStateVisibleAssets]);

  const checkedAlbumsAssetsById = useMemo(() => {
    if (
      !(
        (primaryArea === 'Library' && libraryBrowseMode === 'Albums') ||
        (primaryArea === 'Review' && reviewBrowseMode === 'Albums')
      ) ||
      checkedAlbumIds.length === 0
    ) {
      return new Map<string, MediaAsset[]>();
    }

    const byAlbum = new Map<string, MediaAsset[]>();

    for (const albumId of checkedAlbumIds) {
      byAlbum.set(albumId, []);
    }

    for (const asset of assetsAfterAdditionalFilters) {
      for (const albumId of asset.albumIds ?? []) {
        if (!checkedAlbumIdsSet.has(albumId)) {
          continue;
        }

        const albumAssets = byAlbum.get(albumId);
        if (albumAssets) {
          albumAssets.push(asset);
        }
      }
    }

    return byAlbum;
  }, [assetsAfterAdditionalFilters, checkedAlbumIds, checkedAlbumIdsSet, libraryBrowseMode, primaryArea, reviewBrowseMode]);

  const checkedAlbumSections = useMemo<AlbumAssetSection[]>(() => {
    if (
      !(
        (primaryArea === 'Library' && libraryBrowseMode === 'Albums') ||
        (primaryArea === 'Review' && reviewBrowseMode === 'Albums')
      ) ||
      checkedAlbumIds.length === 0
    ) {
      return [];
    }

    return checkedAlbumIds
      .map((albumId) => {
        const albumNode = albumNodesById.get(albumId);
        if (!albumNode || albumNode.nodeType !== 'Album') {
          return null;
        }

        const scopedAssets = sortAssetsForSmartAlbumOrder(
          checkedAlbumsAssetsById.get(albumId) ?? [],
          albumId
        );
        if (scopedAssets.length === 0) {
          return null;
        }

        return {
          albumId,
          albumLabel: albumNode.label,
          assets: scopedAssets
        };
      })
      .filter((section): section is AlbumAssetSection => section !== null);
  }, [albumNodesById, checkedAlbumIds, checkedAlbumsAssetsById, libraryBrowseMode, primaryArea, reviewBrowseMode]);

  const mergedAlbumAssets = useMemo(() => {
    if (checkedAlbumSections.length === 1) {
      return checkedAlbumSections[0]?.assets ?? [];
    }

    const deduped = new Map<string, MediaAsset>();
    for (const section of checkedAlbumSections) {
      for (const asset of section.assets) {
        if (!deduped.has(asset.id)) {
          deduped.set(asset.id, asset);
        }
      }
    }

    return [...deduped.values()];
  }, [checkedAlbumSections]);

  const groupedAlbumNavigationAssets = useMemo(() => {
    if (
      !(
        (primaryArea === 'Library' && libraryBrowseMode === 'Albums') ||
        (primaryArea === 'Review' && reviewBrowseMode === 'Albums')
      ) ||
      checkedAlbumSections.length === 0
    ) {
      return [];
    }

    const deduped = new Map<string, MediaAsset>();
    for (const section of checkedAlbumSections) {
      for (const asset of section.assets) {
        if (!deduped.has(asset.id)) {
          deduped.set(asset.id, asset);
        }
      }
    }

    return [...deduped.values()];
  }, [checkedAlbumSections, libraryBrowseMode, primaryArea, reviewBrowseMode]);

  const sortedAssetsAfterAdditionalFilters = useMemo(
    () => sortVisibleAssetsForTimeline(assetsAfterAdditionalFilters),
    [assetsAfterAdditionalFilters]
  );

  const visibleAssets = useMemo(() => {
    if (primaryArea === 'Search') {
      return searchResults;
    }

    if (primaryArea === 'Review') {
      if (reviewBrowseMode === 'Albums' && checkedAlbumIds.length === 0) {
        return [];
      }

      if (reviewBrowseMode === 'Albums') {
        return groupedAlbumNavigationAssets;
      }

      return sortedAssetsAfterAdditionalFilters;
    }

    const isLibraryAlbumsMode = primaryArea === 'Library' && libraryBrowseMode === 'Albums';
    if (!isLibraryAlbumsMode) {
      return sortedAssetsAfterAdditionalFilters;
    }

    if (checkedAlbumIds.length === 0) {
      return [];
    }

    if (albumResultsPresentation === 'GroupedByAlbum') {
      return groupedAlbumNavigationAssets;
    }

    return mergedAlbumAssets;
  }, [
    albumResultsPresentation,
    checkedAlbumIds.length,
    groupedAlbumNavigationAssets,
    libraryBrowseMode,
    mergedAlbumAssets,
    primaryArea,
    reviewBrowseMode,
    searchResults,
    sortedAssetsAfterAdditionalFilters
  ]);

  useEffect(() => {
    if (assetsLoading || assets.length === 0) {
      return;
    }

    console.info(
      `[tedography bootstrap] post-load render with ${assets.length} assets, ${visibleAssets.length} visible assets, area=${primaryArea}`
    );
  }, [assets.length, assetsLoading, primaryArea, visibleAssets.length]);

  const timelineMonthGroups = useMemo(
    () =>
      (primaryArea === 'Library' && libraryBrowseMode === 'Timeline') ||
      (primaryArea === 'Review' && reviewBrowseMode === 'Timeline')
        ? groupAssetsByCaptureMonth(visibleAssets)
        : [],
    [libraryBrowseMode, primaryArea, reviewBrowseMode, visibleAssets]
  );

  const timelineNavigationYears = useMemo<TimelineNavigationYear[]>(
    () => buildTimelineNavigationYears(timelineMonthGroups),
    [timelineMonthGroups]
  );
  const timelineContentSignature = useMemo(
    () => getTimelineContentSignature(timelineMonthGroups),
    [timelineMonthGroups]
  );
  const activeThumbnailZoomLevel = timelineZoomLevels[timelineZoomLevel] ?? timelineZoomLevels[2];

  const browseGridStyle = useMemo<CSSProperties>(
    () => {
      return {
        ...gridStyle,
        gridTemplateColumns: `repeat(auto-fill, minmax(${activeThumbnailZoomLevel.minWidth}px, 1fr))`
      };
    },
    [activeThumbnailZoomLevel.minWidth]
  );


  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [visibleAssets, selectedAssetId]
  );
  const singleCheckedAlbumSection = useMemo(
    () => (checkedAlbumSections.length === 1 ? checkedAlbumSections[0] ?? null : null),
    [checkedAlbumSections]
  );
  const singleCheckedAlbumId = singleCheckedAlbumSection?.albumId ?? null;
  const manualOrderEligibleAssetsInCurrentAlbum = useMemo(() => {
    if (!singleCheckedAlbumId || !singleCheckedAlbumSection) {
      return [];
    }

    return singleCheckedAlbumSection.assets.filter((asset) =>
      isManualOrderEligibleInAlbum(asset, singleCheckedAlbumId)
    );
  }, [singleCheckedAlbumId, singleCheckedAlbumSection]);
  const selectedManualOrderAsset = useMemo(() => {
    if (!singleCheckedAlbumId || selectedAssetIds.length !== 1 || !selectedAsset) {
      return null;
    }

    return isManualOrderEligibleInAlbum(selectedAsset, singleCheckedAlbumId) ? selectedAsset : null;
  }, [selectedAsset, selectedAssetIds.length, singleCheckedAlbumId]);
  const selectedAssetCanForceManualOrderInCurrentAlbum = useMemo(() => {
    if (!singleCheckedAlbumId || selectedAssetIds.length !== 1 || !selectedAsset) {
      return false;
    }

    return usesCaptureTimeOrderInAlbum(selectedAsset, singleCheckedAlbumId);
  }, [selectedAsset, selectedAssetIds.length, singleCheckedAlbumId]);
  const selectedAssetIsForcedManualInCurrentAlbum = useMemo(() => {
    if (!singleCheckedAlbumId || selectedAssetIds.length !== 1 || !selectedAsset) {
      return false;
    }

    return isForcedManualOrderInAlbum(selectedAsset, singleCheckedAlbumId);
  }, [selectedAsset, selectedAssetIds.length, singleCheckedAlbumId]);
  const selectedManualOrderAssetIndex = useMemo(() => {
    if (!selectedManualOrderAsset) {
      return -1;
    }

    return manualOrderEligibleAssetsInCurrentAlbum.findIndex(
      (asset) => asset.id === selectedManualOrderAsset.id
    );
  }, [manualOrderEligibleAssetsInCurrentAlbum, selectedManualOrderAsset]);
  const selectedAssetForDetails = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }

    if (selectedAssetDetails?.id === selectedAsset.id) {
      return { ...selectedAsset, ...selectedAssetDetails };
    }

    return selectedAsset;
  }, [selectedAsset, selectedAssetDetails]);
  const selectedAssetAlbumLabels = useMemo(() => {
    if (!selectedAsset) {
      return [];
    }

    return (selectedAsset.albumIds ?? [])
      .map((albumId) => albumNodesById.get(albumId))
      .filter((node): node is AlbumTreeNode => node?.nodeType === 'Album')
      .map((node) => node.label);
  }, [albumNodesById, selectedAsset]);
  const selectedAssetAlbumOrderingModeLabel = useMemo(() => {
    if (!singleCheckedAlbumId || selectedAssetIds.length !== 1 || !selectedAsset) {
      return null;
    }

    return formatAlbumOrderingModeLabel(
      getAlbumOrderingModeInAlbum(selectedAsset, singleCheckedAlbumId)
    );
  }, [selectedAsset, selectedAssetIds.length, singleCheckedAlbumId]);
  const selectedAssetAlbumOrderingMode = useMemo(() => {
    if (!singleCheckedAlbumId || selectedAssetIds.length !== 1 || !selectedAsset) {
      return null;
    }

    return getAlbumOrderingModeInAlbum(selectedAsset, singleCheckedAlbumId);
  }, [selectedAsset, selectedAssetIds.length, singleCheckedAlbumId]);

  const compareAssets = useMemo(
    () => visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [visibleAssets, selectedAssetIds]
  );
  const selectedAssetsForKeywordEditing = useMemo(() => {
    if (selectedAssetIds.length === 0) {
      return [];
    }

    if (selectedAssetIds.length === 1) {
      return selectedAssetForDetails ? [selectedAssetForDetails] : [];
    }

    return selectedAssetIds
      .map((assetId) => assetsById.get(assetId) ?? null)
      .filter((asset): asset is MediaAsset => asset !== null);
  }, [assetsById, selectedAssetForDetails, selectedAssetIds]);
  const keywordsById = useMemo(
    () => new Map(keywords.map((keyword) => [keyword.id, keyword])),
    [keywords]
  );
  const recentKeywords = useMemo(
    () =>
      recentKeywordIds
        .map((keywordId) => keywordsById.get(keywordId) ?? null)
        .filter((keyword): keyword is Keyword => keyword !== null),
    [keywordsById, recentKeywordIds]
  );
  const displayedKeywordsForSelection = useMemo(() => {
    if (selectedAssetsForKeywordEditing.length === 0) {
      return [];
    }

    const keywordIdSets = selectedAssetsForKeywordEditing.map(
      (asset) => new Set(asset.keywordIds ?? [])
    );
    const commonKeywordIds = Array.from(keywordIdSets[0] ?? []);
    const filteredIds = commonKeywordIds.filter((keywordId) =>
      keywordIdSets.every((set) => set.has(keywordId))
    );

    return sortKeywordsByPath(
      filteredIds
        .map((keywordId) => keywordsById.get(keywordId) ?? null)
        .filter((keyword): keyword is Keyword => keyword !== null)
    );
  }, [keywordsById, selectedAssetsForKeywordEditing]);
  const selectedAssetsForAlbumMembershipAction = useMemo(
    () =>
      selectedAssetIdsForAlbumAction
        .map((assetId) => assetsById.get(assetId) ?? null)
        .filter((asset): asset is MediaAsset => asset !== null),
    [assetsById, selectedAssetIdsForAlbumAction]
  );
  const selectedAssetsInFocusedAlbum = useMemo(() => {
    if (!focusedAlbumForMembershipAction) {
      return [];
    }

    return selectedAssetsForAlbumMembershipAction.filter((asset) =>
      (asset.albumIds ?? []).includes(focusedAlbumForMembershipAction.id)
    );
  }, [focusedAlbumForMembershipAction, selectedAssetsForAlbumMembershipAction]);
  const selectedAssetsAlreadyOutsideFocusedAlbumCount = useMemo(() => {
    return Math.max(
      0,
      selectedAssetsForAlbumMembershipAction.length - selectedAssetsInFocusedAlbum.length
    );
  }, [selectedAssetsForAlbumMembershipAction.length, selectedAssetsInFocusedAlbum.length]);
  const searchPeopleById = useMemo(
    () => new Map(searchPeopleOptions.map((person) => [person.id, person])),
    [searchPeopleOptions]
  );
  const fallbackSearchPeople = useMemo(() => {
    const byId = new Map<string, Person>();

    for (const asset of assets) {
      for (const person of asset.people ?? []) {
        if (!byId.has(person.personId)) {
          byId.set(person.personId, {
            id: person.personId,
            displayName: person.displayName,
            sortName: null,
            aliases: [],
            notes: null,
            isHidden: false,
            isArchived: false,
            createdAt: '',
            updatedAt: ''
          });
        }
      }
    }

    return Array.from(byId.values()).sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [assets]);
  const availableSearchPeopleOptions = searchPeopleOptions.length > 0 ? searchPeopleOptions : fallbackSearchPeople;
  const smartAlbumsById = useMemo(
    () => new Map(smartAlbums.map((smartAlbum) => [smartAlbum.id, smartAlbum])),
    [smartAlbums]
  );
  const yearGroupOptions = useMemo(
    () =>
      albumTreeNodes
        .filter(isYearGroupNode)
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
        .map((node) => ({ id: node.id, label: node.label })),
    [albumTreeNodes]
  );
  const yearGroupById = useMemo(
    () => new Map(yearGroupOptions.map((group) => [group.id, group])),
    [yearGroupOptions]
  );
  const selectedSearchKeyword = useMemo(
    () => (searchKeywordId ? keywordsById.get(searchKeywordId) ?? null : null),
    [keywordsById, searchKeywordId]
  );
  const activeSmartAlbum = useMemo(
    () => (activeSmartAlbumId ? smartAlbumsById.get(activeSmartAlbumId) ?? null : null),
    [activeSmartAlbumId, smartAlbumsById]
  );
  const filteredSearchKeywordOptions = useMemo(() => {
    const query = searchKeywordQuery.trim().toLowerCase();

    if (query.length === 0) {
      return keywords;
    }

    return keywords.filter((keyword) =>
      formatKeywordPathLabel(keyword, keywordsById).toLowerCase().includes(query)
    );
  }, [keywords, keywordsById, searchKeywordQuery]);
  function getSmartAlbumFilterSpecForSearchFilters(filters: SearchFilters): SmartAlbumFilterSpec | null {
    const activeUnsupportedFilters =
      filters.albumIds.length > 0 ||
      filters.filenamePattern.trim().length > 0 ||
      filters.captureDateFrom.length > 0 ||
      filters.captureDateTo.length > 0 ||
      filters.captureDateAvailability !== 'datedOnly' ||
      filters.peopleIds.length > 0 ||
      filters.hasNoPeople ||
      filters.hasReviewableFaces ||
      filters.photoStates.length > 1 ||
      filters.groupIds.length > 1;

    if (activeUnsupportedFilters) {
      return null;
    }

    const firstSearchGroupId = filters.groupIds[0];
    const yearGroupId =
      filters.groupIds.length === 1 &&
      typeof firstSearchGroupId === 'string' &&
      yearGroupById.has(firstSearchGroupId)
        ? firstSearchGroupId
        : null;

    if (filters.groupIds.length === 1 && !yearGroupId) {
      return null;
    }

    const firstSearchPhotoState =
      filters.photoStates.length === 1 ? (filters.photoStates[0] ?? null) : null;
    const filterSpec = normalizeSmartAlbumFilterSpecForComparison({
      keywordId: filters.keywordId,
      photoState: firstSearchPhotoState,
      yearGroupId
    });

    if (!filterSpec.keywordId && !filterSpec.photoState && !filterSpec.yearGroupId) {
      return null;
    }

    return filterSpec;
  }
  const appliedSearchSmartAlbumFilterSpec = useMemo<SmartAlbumFilterSpec | null>(
    () => (appliedSearchFilters ? getSmartAlbumFilterSpecForSearchFilters(appliedSearchFilters) : null),
    [
      appliedSearchFilters,
      yearGroupById
    ]
  );
  const isActiveSmartAlbumView = useMemo(
    () =>
      primaryArea === 'Search' &&
      activeSmartAlbum !== null &&
      appliedSearchSmartAlbumFilterSpec !== null &&
      smartAlbumFilterSpecsEqual(activeSmartAlbum.filterSpec, appliedSearchSmartAlbumFilterSpec),
    [activeSmartAlbum, appliedSearchSmartAlbumFilterSpec, primaryArea]
  );
  useEffect(() => {
    if (keywordsLoading || keywordsError || !searchKeywordId) {
      return;
    }

    if (!keywordsById.has(searchKeywordId)) {
      setSearchKeywordId(null);
      setSearchKeywordQuery('');
    }
  }, [keywordsById, keywordsError, keywordsLoading, searchKeywordId]);
  useEffect(() => {
    if (activeSmartAlbumId && !smartAlbumsById.has(activeSmartAlbumId)) {
      setActiveSmartAlbumId(null);
    }
  }, [activeSmartAlbumId, smartAlbumsById]);
  const selectedSearchPeople = useMemo(
    () =>
      searchPeopleIds
        .map((personId) => (searchPeopleById.get(personId) ?? availableSearchPeopleOptions.find((person) => person.id === personId)))
        .filter((person): person is Person => Boolean(person)),
    [availableSearchPeopleOptions, searchPeopleById, searchPeopleIds]
  );
  const filteredSearchPeopleOptions = useMemo(() => {
    const query = searchPeopleQuery.trim().toLowerCase();
    const selectedIds = new Set(searchPeopleIds);
    const unselected = availableSearchPeopleOptions.filter((person) => !selectedIds.has(person.id));

    if (!query) {
      return unselected.slice(0, 18);
    }

    return unselected
      .filter((person) => person.displayName.toLowerCase().includes(query))
      .slice(0, 18);
  }, [availableSearchPeopleOptions, searchPeopleIds, searchPeopleQuery]);

  const selectedAlbumTreeGroupNode = useMemo(() => {
    if (!selectedTreeNodeId) {
      return null;
    }

    const node = albumNodesById.get(selectedTreeNodeId);
    return node?.nodeType === 'Group' ? node : null;
  }, [albumNodesById, selectedTreeNodeId]);
  const selectedAlbumTreeAlbumNode = useMemo(() => {
    if (!selectedTreeNodeId) {
      return null;
    }

    const node = albumNodesById.get(selectedTreeNodeId);
    return node?.nodeType === 'Album' ? node : null;
  }, [albumNodesById, selectedTreeNodeId]);
  const selectedTreeNodeParent = useMemo(
    () => (selectedTreeNode?.parentId ? albumNodesById.get(selectedTreeNode.parentId) ?? null : null),
    [albumNodesById, selectedTreeNode]
  );
  const selectedGroupChildOrderMode = useMemo(
    () => getEffectiveGroupChildOrderMode(selectedAlbumTreeGroupNode),
    [selectedAlbumTreeGroupNode]
  );
  const selectedAlbumTreeNodeCustomSiblings = useMemo(() => {
    if (!selectedTreeNode) {
      return [];
    }

    return getOrderedAlbumTreeSiblingsForCustomSort(albumTreeNodes, selectedTreeNode);
  }, [albumTreeNodes, selectedTreeNode]);
  const selectedAlbumTreeNodeCustomSiblingIndex = useMemo(() => {
    if (!selectedTreeNode) {
      return -1;
    }

    return selectedAlbumTreeNodeCustomSiblings.findIndex((node) => node.id === selectedTreeNode.id);
  }, [selectedAlbumTreeNodeCustomSiblings, selectedTreeNode]);
  const selectedTreeNodeSiblingOrderMode = useMemo<AlbumTreeChildOrderMode>(() => {
    if (!selectedTreeNode) {
      return 'Custom';
    }

    if (selectedTreeNodeParent?.nodeType === 'Group' && selectedTreeNode.nodeType === 'Album') {
      return getEffectiveGroupChildOrderMode(selectedTreeNodeParent);
    }

    return albumTreeSortMode === 'Custom' ? 'Custom' : 'Name';
  }, [albumTreeSortMode, selectedTreeNode, selectedTreeNodeParent]);
  const canUseCustomReorderCommands = selectedTreeNodeSiblingOrderMode === 'Custom';
  const canMoveSelectedTreeNodeUp =
    canUseCustomReorderCommands && selectedAlbumTreeNodeCustomSiblingIndex > 0;
  const canMoveSelectedTreeNodeDown =
    canUseCustomReorderCommands &&
    selectedAlbumTreeNodeCustomSiblingIndex >= 0 &&
    selectedAlbumTreeNodeCustomSiblingIndex < selectedAlbumTreeNodeCustomSiblings.length - 1;
  const moveDialogNode = useMemo(
    () => (moveDialogNodeId ? albumNodesById.get(moveDialogNodeId) ?? null : null),
    [albumNodesById, moveDialogNodeId]
  );

  const slideshowAssets = useMemo(
    () => (compareAssets.length > 0 ? compareAssets : visibleAssets),
    [compareAssets, visibleAssets]
  );

  const loupeAssets = useMemo(
    () => (compareAssets.length > 0 ? compareAssets : visibleAssets),
    [compareAssets, visibleAssets]
  );

  const immersiveAssets = useMemo(
    () => (compareAssets.length > 0 ? compareAssets : visibleAssets),
    [compareAssets, visibleAssets]
  );

  const selectedAssetIndex = useMemo(
    () => visibleAssets.findIndex((asset) => asset.id === selectedAssetId),
    [visibleAssets, selectedAssetId]
  );

  const loupeSelectedAssetIndex = useMemo(
    () => loupeAssets.findIndex((asset) => asset.id === selectedAssetId),
    [loupeAssets, selectedAssetId]
  );

  const immersiveSelectedAssetIndex = useMemo(
    () => immersiveAssets.findIndex((asset) => asset.id === selectedAssetId),
    [immersiveAssets, selectedAssetId]
  );

  const slideshowSelectedAssetIndex = useMemo(
    () => slideshowAssets.findIndex((asset) => asset.id === selectedAssetId),
    [slideshowAssets, selectedAssetId]
  );

  const surveyFocusedAsset = useMemo(
    () => compareAssets.find((asset) => asset.id === selectedAssetId) ?? compareAssets[0] ?? null,
    [compareAssets, selectedAssetId]
  );

  const surveyFocusedIndex = useMemo(() => {
    if (!surveyFocusedAsset) {
      return -1;
    }

    return compareAssets.findIndex((asset) => asset.id === surveyFocusedAsset.id);
  }, [compareAssets, surveyFocusedAsset]);

  const hasNoAssets = !assetsLoading && !assetsError && assets.length === 0;
  const hasAreaScopedAssets = areaPhotoStateVisibleAssets.length > 0;
  const hasFilteredAssets = visibleAssets.length > 0;
  const hasActiveFilters = !photoStatesEqual(
    currentAreaPhotoStates,
    areaDefaultPhotoStates ?? currentAreaPhotoStates
  );
  const hasActiveSearchFilters = hasSearchFilters(pendingSearchFilters);
  const hasAppliedSearch = appliedSearchFilters !== null;
  const isPendingSearchDefault = searchFiltersEqual(pendingSearchFilters, getDefaultSearchFilters());
  const hasPendingSearchChanges = appliedSearchFilters === null
    ? !isPendingSearchDefault
    : !searchFiltersEqual(pendingSearchFilters, appliedSearchFilters);
  const appliedSearchKeyword = useMemo(
    () => (appliedSearchFilters?.keywordId ? keywordsById.get(appliedSearchFilters.keywordId) ?? null : null),
    [appliedSearchFilters?.keywordId, keywordsById]
  );
  const canSaveCurrentSearchAsSmartAlbum =
    appliedSearchSmartAlbumFilterSpec !== null &&
    !hasPendingSearchChanges &&
    normalizeSmartAlbumSaveLabel(smartAlbumSaveLabel).length > 0 &&
    !smartAlbumSaveBusy;
  const hasUnsupportedActiveSearchFiltersForSmartAlbums =
    appliedSearchFilters !== null &&
    hasSearchFilters(appliedSearchFilters) &&
    appliedSearchSmartAlbumFilterSpec === null;
  const hasAdditionalAppliedSearchFiltersBesidesKeyword =
    appliedSearchFilters !== null &&
    (appliedSearchFilters.photoStates.length > 0 ||
      appliedSearchFilters.albumIds.length > 0 ||
      appliedSearchFilters.groupIds.length > 0 ||
      appliedSearchFilters.filenamePattern.trim().length > 0 ||
      appliedSearchFilters.captureDateFrom.length > 0 ||
      appliedSearchFilters.captureDateTo.length > 0 ||
      appliedSearchFilters.captureDateAvailability !== 'datedOnly' ||
      appliedSearchFilters.peopleIds.length > 0 ||
      appliedSearchFilters.hasNoPeople ||
      appliedSearchFilters.hasReviewableFaces);
  const hasCheckedAlbums = checkedAlbumIds.length > 0;
  const hasAssetsInCheckedAlbumsAfterFilters = checkedAlbumSections.length > 0;
  const isReviewArea = primaryArea === 'Review';
  const isLibraryArea = primaryArea === 'Library';
  const isSearchArea = primaryArea === 'Search';
  const isReviewTimelineMode = isReviewArea && reviewBrowseMode === 'Timeline';
  const isReviewAlbumsMode = isReviewArea && reviewBrowseMode === 'Albums';
  const isTimelineMode =
    (isLibraryArea && libraryBrowseMode === 'Timeline') || isReviewTimelineMode;
  const isTimelineGridMode = isTimelineMode && viewerMode === 'Grid';
  const isLibraryAlbumsMode = isLibraryArea && libraryBrowseMode === 'Albums';
  const isAlbumsMode = isLibraryAlbumsMode || isReviewAlbumsMode;
  const isFlatBrowseMode =
    (isReviewArea && reviewBrowseMode === 'Flat') || (isLibraryArea && libraryBrowseMode === 'Flat');
  const showsThumbnailSizeControl =
    viewerMode === 'Grid' && (isFlatBrowseMode || isTimelineMode || isAlbumsMode);
  const photoStateSummaryScopeAssets = useMemo(() => {
    if (primaryArea === 'Search') {
      return [];
    }

    if (!isAlbumsMode) {
      return assets;
    }

    if (checkedAlbumIds.length === 0) {
      return [];
    }

    const deduped = new Map<string, MediaAsset>();
    for (const asset of assets) {
      if ((asset.albumIds ?? []).some((albumId) => checkedAlbumIdsSet.has(albumId))) {
        deduped.set(asset.id, asset);
      }
    }

    return [...deduped.values()];
  }, [assets, checkedAlbumIds.length, checkedAlbumIdsSet, isAlbumsMode, primaryArea]);
  const photoStateSummaryCounts = useMemo(() => {
    const counts = new Map<PhotoState, number>();
    for (const state of photoStateFilterOptions) {
      counts.set(state, 0);
    }

    for (const asset of photoStateSummaryScopeAssets) {
      counts.set(asset.photoState, (counts.get(asset.photoState) ?? 0) + 1);
    }

    return counts;
  }, [photoStateSummaryScopeAssets]);
  const isGroupedAlbumsPresentation =
    isLibraryAlbumsMode && albumResultsPresentation === 'GroupedByAlbum';
  const isLoupeMode = viewerMode === 'Loupe' && (isReviewArea || isLibraryArea || isSearchArea);
  const showDetailsPanels = detailsPanelsVisible;
  const selectionCount = selectedAssetIds.length;
  const hasSelectedAssets = selectionCount > 0;
  const canToggleSelectedAssetOrderingModeInCurrentAlbum =
    isAlbumsMode &&
    singleCheckedAlbumId !== null &&
    selectedAssetIds.length === 1 &&
    selectedAsset !== null &&
    ((selectedAsset.albumIds ?? []).includes(singleCheckedAlbumId)) &&
    (selectedAssetAlbumOrderingMode === 'capture-time' || selectedAssetAlbumOrderingMode === 'manual');
  const canManuallyReorderCurrentAlbumSelection =
    isAlbumsMode &&
    singleCheckedAlbumId !== null &&
    selectedManualOrderAsset !== null &&
    manualOrderEligibleAssetsInCurrentAlbum.length > 1;
  const canMoveCurrentAlbumSelectionToTop =
    canManuallyReorderCurrentAlbumSelection && selectedManualOrderAssetIndex > 0;
  const canMoveCurrentAlbumSelectionUp =
    canManuallyReorderCurrentAlbumSelection && selectedManualOrderAssetIndex > 0;
  const canMoveCurrentAlbumSelectionDown =
    canManuallyReorderCurrentAlbumSelection &&
    selectedManualOrderAssetIndex >= 0 &&
    selectedManualOrderAssetIndex < manualOrderEligibleAssetsInCurrentAlbum.length - 1;
  const canMoveCurrentAlbumSelectionToBottom =
    canManuallyReorderCurrentAlbumSelection &&
    selectedManualOrderAssetIndex >= 0 &&
    selectedManualOrderAssetIndex < manualOrderEligibleAssetsInCurrentAlbum.length - 1;
  const checkedAlbumScopeAssetIds = useMemo(
    () => Array.from(new Set(checkedAlbumSections.flatMap((section) => section.assets.map((asset) => asset.id)))),
    [checkedAlbumSections]
  );
  const checkedAlbumScopeLabel = useMemo(
    () => summarizeScopeLabels(checkedAlbumSections.map((section) => section.albumLabel), 'Checked albums'),
    [checkedAlbumSections]
  );
  const currentScopedPeopleScope = useMemo<{
    source: 'librarySelection' | 'albumScope' | 'searchDateRange' | 'searchResults';
    scopeType: string;
    scopeLabel: string;
    scopeSourceLabel: string;
    assetIds: string[];
  } | null>(() => {
    if (isLibraryArea && selectedAssetIds.length > 0) {
      return {
        source: 'librarySelection',
        scopeType: 'Library selection',
        scopeLabel:
          selectedAssetIds.length === 1
            ? 'Run or review people work for the current Library selection.'
            : `Run or review people work for ${selectedAssetIds.length} selected Library assets.`,
        scopeSourceLabel: 'Library selection',
        assetIds: selectedAssetIds
      };
    }

    if (isLibraryArea && libraryBrowseMode === 'Albums' && checkedAlbumScopeAssetIds.length > 0) {
      return {
        source: 'albumScope',
        scopeType: 'Album',
        scopeLabel: `Album scope: ${checkedAlbumScopeLabel}`,
        scopeSourceLabel: `Album: ${checkedAlbumScopeLabel}`,
        assetIds: checkedAlbumScopeAssetIds
      };
    }

    if (
      isSearchArea &&
      appliedSearchFilters &&
      (appliedSearchFilters.captureDateFrom.trim().length > 0 ||
        appliedSearchFilters.captureDateTo.trim().length > 0) &&
      visibleAssets.length > 0
    ) {
      const dateLabel = formatScopedDateLabel(
        appliedSearchFilters.captureDateFrom,
        appliedSearchFilters.captureDateTo
      );
      return {
        source: 'searchDateRange',
        scopeType: 'Date range',
        scopeLabel: `Date range scope: ${dateLabel}`,
        scopeSourceLabel: `Date range: ${dateLabel}`,
        assetIds: visibleAssets.map((asset) => asset.id)
      };
    }

    if (isSearchArea && visibleAssets.length > 0) {
      return {
        source: 'searchResults',
        scopeType: 'Search results',
        scopeLabel:
          visibleAssets.length === 1
            ? 'Run or review people work for the current Search result.'
            : `Run or review people work for ${visibleAssets.length} current Search results.`,
        scopeSourceLabel: 'Current Search results',
        assetIds: visibleAssets.map((asset) => asset.id)
      };
    }

    return null;
  }, [
    checkedAlbumScopeAssetIds,
    checkedAlbumScopeLabel,
    appliedSearchFilters,
    isLibraryArea,
    isSearchArea,
    libraryBrowseMode,
    selectedAssetIds,
    visibleAssets
  ]);

  useEffect(() => {
    if (!scopedPeopleDialogOpen || !currentScopedPeopleScope) {
      return;
    }

    void loadScopedPeopleSummary(currentScopedPeopleScope.assetIds);
  }, [currentScopedPeopleScope, scopedPeopleDialogOpen]);

  const mainPaneDescription = isReviewArea
    ? reviewBrowseMode === 'Albums'
      ? 'Review: album-scoped curation. Keys: arrows navigate, Enter/Space full screen, Esc clears selection, S/P/R/U review.'
      : reviewBrowseMode === 'Timeline'
        ? 'Review: timeline curation. Keys: arrows navigate, Enter/Space full screen, Esc clears selection, S/P/R/U review.'
        : 'Review: flat curation. Keys: arrows navigate, Enter/Space full screen, Esc clears selection, S/P/R/U review.'
    : isLibraryArea
      ? 'Library: photo-first browsing. Keys: arrows navigate, Enter/Space full screen, Esc clears selection.'
      : 'Search: structured photo finding by state, album, and date.';
  const isSearchFromSmartAlbum = isSearchArea && activeSmartAlbum !== null;
  const hasPendingSmartAlbumSearchChanges =
    isSearchFromSmartAlbum && isActiveSmartAlbumView && hasPendingSearchChanges;
  const hasDivergedSmartAlbumSearch =
    isSearchFromSmartAlbum && !isActiveSmartAlbumView;
  const activeContextSummary = useMemo(() => {
    if (isSearchFromSmartAlbum && activeSmartAlbum) {
      if (hasPendingSmartAlbumSearchChanges) {
        return {
          title: `Search (from Smart Album: ${activeSmartAlbum.label})`,
          badge: 'Pending Changes',
          meta: 'Current results still match the saved Smart Album. Run Search to view the edited filters.',
          kind: 'smart-album' as const
        };
      }

      if (hasDivergedSmartAlbumSearch) {
        return {
          title: `Search (from Smart Album: ${activeSmartAlbum.label})`,
          badge: 'Derived Search',
          meta: 'Filters no longer match the saved Smart Album. Exit Smart Album to return to ordinary Search.',
          kind: 'smart-album' as const
        };
      }

      return {
        title: `Smart Album: ${activeSmartAlbum.label}`,
        badge: 'Saved Filters',
        meta: 'Derived from saved filters. It is not a manual album and photos are not stored in it.',
        kind: 'smart-album' as const
      };
    }

    if (isSearchArea) {
      return {
        title: hasAppliedSearch ? 'Search' : 'Search',
        badge: hasAppliedSearch ? 'Ad Hoc Results' : 'Ready',
        meta: hasAppliedSearch
          ? 'Ordinary Search results from the current filters. Save supported filters as a Smart Album when needed.'
          : 'Set filters and run Search to view results.',
        kind: 'search' as const
      };
    }

    if (isAlbumsMode && singleCheckedAlbumSection) {
      return {
        title: `Album: ${singleCheckedAlbumSection.albumLabel}`,
        badge: 'Manual Album',
        meta: 'Curated album membership. Move, remove, and manual ordering actions apply to this album.',
        kind: 'album' as const
      };
    }

    if (isAlbumsMode && checkedAlbumIds.length > 1) {
      return {
        title: `Albums: ${checkedAlbumIds.length} checked`,
        badge: 'Manual Albums',
        meta: 'Curated album membership. Asset actions add to or move between manual albums.',
        kind: 'album' as const
      };
    }

    return null;
  }, [
    activeSmartAlbum,
    checkedAlbumIds.length,
    hasAppliedSearch,
    hasDivergedSmartAlbumSearch,
    hasPendingSmartAlbumSearchChanges,
    isAlbumsMode,
    isSearchArea,
    isSearchFromSmartAlbum,
    singleCheckedAlbumSection
  ]);
  const treeDisplayNodes = useMemo(
    () => buildAlbumTreeDisplayList(albumTreeNodes, expandedGroupIds, albumTreeSortMode),
    [albumTreeNodes, expandedGroupIds, albumTreeSortMode]
  );
  const checkedAlbumIdsInTreeOrder = useMemo(() => {
    const allGroupIds = albumTreeNodes
      .filter((node) => node.nodeType === 'Group')
      .map((node) => node.id);
    const checkedSet = new Set(checkedAlbumIds);

    return buildAlbumTreeDisplayList(albumTreeNodes, allGroupIds, albumTreeSortMode)
      .filter((node) => node.nodeType === 'Album' && checkedSet.has(node.id))
      .map((node) => node.id);
  }, [albumTreeNodes, albumTreeSortMode, checkedAlbumIds]);

  useEffect(() => {
    checkedAlbumRevealIndexRef.current = -1;
    pendingCheckedAlbumRevealIdRef.current = null;
  }, [checkedAlbumIdsInTreeOrder]);

  useEffect(() => {
    const pendingAlbumId = pendingCheckedAlbumRevealIdRef.current;
    if (!pendingAlbumId) {
      return;
    }

    const targetButton = albumTreeNodeButtonRefs.current.get(pendingAlbumId);
    if (!targetButton) {
      return;
    }

    pendingCheckedAlbumRevealIdRef.current = null;
    targetButton.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [treeDisplayNodes]);

  function getTopVisibleTimelineMonthKey(): string | null {
    if (timelineMonthGroups.length === 0) {
      return null;
    }

    let currentKey = timelineMonthGroups[0]?.key ?? null;
    for (const group of timelineMonthGroups) {
      const sectionElement = timelineSectionRefs.current[group.key];
      if (!sectionElement) {
        continue;
      }

      const rect = sectionElement.getBoundingClientRect();
      if (rect.top <= timelineActiveMonthOffsetPx) {
        currentKey = group.key;
        continue;
      }

      break;
    }

    return currentKey;
  }

  useEffect(() => {
    const validYearKeys = new Set(timelineNavigationYears.map((year) => year.key));
    const pruned = timelineNavExpandedYearKeys.filter((key) => validYearKeys.has(key));
    if (!arraysEqual(pruned, timelineNavExpandedYearKeys)) {
      setTimelineNavExpandedYearKeys(pruned);
    }
  }, [timelineNavExpandedYearKeys, timelineNavigationYears]);

  useEffect(() => {
    if (timelineNavigationYears.length === 0 || timelineNavExpandedYearKeys.length > 0) {
      return;
    }

    setTimelineNavExpandedYearKeys(timelineNavigationYears.map((year) => year.key));
  }, [timelineNavExpandedYearKeys.length, timelineNavigationYears]);

  useEffect(() => {
    if (!isTimelineGridMode) {
      setActiveTimelineMonthKey(null);
      return;
    }

    let animationFrameId = 0;

    const updateActiveMonth = () => {
      animationFrameId = 0;
      setActiveTimelineMonthKey(getTopVisibleTimelineMonthKey());
    };

    const handleScrollOrResize = () => {
      if (animationFrameId !== 0) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveMonth);
    };

    updateActiveMonth();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isTimelineGridMode, timelineContentSignature, timelineMonthGroups]);

  useEffect(() => {
    const wasTimelineMode = previousIsTimelineModeRef.current;

    if (wasTimelineMode && !isTimelineGridMode) {
      timelineScrollMemoryRef.current = {
        scrollY: window.scrollY,
        contentSignature: timelineContentSignature
      };
    }

    if (!wasTimelineMode && isTimelineGridMode) {
      const stored = timelineScrollMemoryRef.current;
      if (stored && stored.contentSignature === timelineContentSignature) {
        pendingTimelineRestoreRef.current = stored;
      }
    }

    previousIsTimelineModeRef.current = isTimelineGridMode;
  }, [isTimelineGridMode, timelineContentSignature]);

  useEffect(() => {
    if (!isTimelineGridMode) {
      return;
    }

    const anchorKey = pendingTimelineZoomAnchorKeyRef.current;
    if (anchorKey) {
      pendingTimelineZoomAnchorKeyRef.current = null;
      window.requestAnimationFrame(() => {
        const sectionElement = timelineSectionRefs.current[anchorKey];
        if (sectionElement) {
          sectionElement.scrollIntoView({ block: 'start' });
        }
      });
      return;
    }

    const pendingRestore = pendingTimelineRestoreRef.current;
    if (!pendingRestore || pendingRestore.contentSignature !== timelineContentSignature) {
      return;
    }

    pendingTimelineRestoreRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: pendingRestore.scrollY });
    });
  }, [isTimelineGridMode, timelineContentSignature, timelineZoomLevel]);

  useEffect(() => {
    const visibleIds = new Set(visibleAssets.map((asset) => asset.id));
    const prunedSelected = selectedAssetIds.filter((id) => visibleIds.has(id));

    let nextFocused: string | null = selectedAssetId;
    if (!nextFocused || !visibleIds.has(nextFocused)) {
      nextFocused = prunedSelected[0] ?? visibleAssets[0]?.id ?? null;
    }

    if (!arraysEqual(selectedAssetIds, prunedSelected)) {
      setSelectedAssetIds(prunedSelected);
    }

    if (selectedAssetId !== nextFocused) {
      setSelectedAssetId(nextFocused);
    }

    if (selectionAnchorAssetId && !visibleIds.has(selectionAnchorAssetId)) {
      setSelectionAnchorAssetId(nextFocused);
    }
  }, [selectionAnchorAssetId, visibleAssets, selectedAssetId, selectedAssetIds]);

  useEffect(() => {
    if (immersiveOpen && !selectedAsset) {
      closeImmersive();
    }
  }, [immersiveOpen, selectedAsset]);

  useEffect(() => {
    setAssetMaintenanceMessage(null);
    setAssetMaintenanceError(false);
  }, [selectedAssetId]);

  useEffect(() => {
    setAlbumMembershipNotice(null);
  }, [selectedTreeNodeId]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      if (!document.fullscreenElement) {
        setImmersiveOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (surveyOpen && compareAssets.length < 2) {
      setSurveyOpen(false);
    }
  }, [compareAssets, surveyOpen]);

  useEffect(() => {
    if (surveyOpen && surveyFocusedAsset && selectedAssetId !== surveyFocusedAsset.id) {
      setSelectedAssetId(surveyFocusedAsset.id);
    }
  }, [selectedAssetId, surveyFocusedAsset, surveyOpen]);

  useEffect(() => {
    if (slideshowActive && slideshowAssets.length === 0) {
      setSlideshowActive(false);
      setSlideshowPlaying(false);
    }
  }, [slideshowActive, slideshowAssets]);

  useEffect(() => {
    if (viewerMode === 'Loupe' && !selectedAsset) {
      setViewerMode('Grid');
    }
  }, [selectedAsset, viewerMode]);

  useEffect(() => {
    if (!isLoupeMode || loupeAssets.length === 0) {
      return;
    }

    if (selectedAssetId && loupeAssets.some((asset) => asset.id === selectedAssetId)) {
      return;
    }

    setSelectedAssetId(loupeAssets[0]?.id ?? null);
  }, [isLoupeMode, loupeAssets, selectedAssetId]);

  useEffect(() => {
    if (!slideshowActive || !slideshowPlaying || slideshowAssets.length < 2) {
      return;
    }

    const timerId = window.setInterval(() => {
      setSelectedAssetId((previous) => {
        const currentIndex = previous
          ? slideshowAssets.findIndex((asset) => asset.id === previous)
          : -1;

        if (currentIndex < 0) {
          return slideshowAssets[0]?.id ?? previous;
        }

        const nextIndex = (currentIndex + 1) % slideshowAssets.length;
        return slideshowAssets[nextIndex]?.id ?? previous;
      });
    }, slideshowIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [slideshowActive, slideshowAssets, slideshowIntervalMs, slideshowPlaying]);

  function setAssetUpdating(assetId: string, isUpdating: boolean): void {
    setUpdatingAssetIds((previous) => ({ ...previous, [assetId]: isUpdating }));
  }

  async function handleSetPhotoState(assetId: string, photoState: PhotoState): Promise<void> {
    const isActiveAssetUpdate = assetId === selectedAssetId;
    const navigationList = surveyOpen
      ? compareAssets
      : immersiveOpen
        ? immersiveAssets
        : isLoupeMode
          ? loupeAssets
          : visibleAssets;
    const currentIndex = navigationList.findIndex((asset) => asset.id === assetId);

    setAssetUpdating(assetId, true);
    setUpdateError(null);

    try {
      const response = await fetch(`/api/assets/${assetId}/photoState`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ photoState })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const updatedAsset = (await response.json()) as MediaAsset;
      setAssets((previous) =>
        previous.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset))
      );
      if (selectedAssetId === updatedAsset.id) {
        setSelectedAssetDetails(updatedAsset);
      }

      const remainsVisibleAfterUpdate = (() => {
        if (primaryArea === 'Search' && appliedSearchFilters) {
          const searchAlbumIdsSet = new Set(appliedSearchFilters.albumIds);
          const searchGroupAlbumIdsSet = new Set(
            getDescendantAlbumIdsForGroupIds(albumTreeNodes, appliedSearchFilters.groupIds)
          );
          const matchesSearchPhotoState =
            appliedSearchFilters.photoStates.length === 0 ||
            appliedSearchFilters.photoStates.includes(updatedAsset.photoState);
          const matchesSearchAlbum =
            appliedSearchFilters.albumIds.length === 0 ||
            (updatedAsset.albumIds ?? []).some((albumId) => searchAlbumIdsSet.has(albumId));
          const matchesSearchGroup =
            appliedSearchFilters.groupIds.length === 0 ||
            (updatedAsset.albumIds ?? []).some((albumId) => searchGroupAlbumIdsSet.has(albumId));
          const matchesSearchFilename = doesAssetMatchSearchFilename(
            updatedAsset,
            appliedSearchFilters.filenamePattern
          );
          const matchesSearchDate = doesAssetMatchSearchCaptureDateRange(
            updatedAsset,
            appliedSearchFilters.captureDateFrom,
            appliedSearchFilters.captureDateTo,
            appliedSearchFilters.captureDateAvailability
          );
          const matchesSearchPeople = doesAssetMatchSearchPeopleFilters(
            updatedAsset,
            appliedSearchFilters.peopleIds,
            appliedSearchFilters.peopleMatchMode,
            appliedSearchFilters.hasNoPeople,
            appliedSearchFilters.hasReviewableFaces
          );

          return (
            matchesSearchPhotoState &&
            matchesSearchAlbum &&
            matchesSearchGroup &&
            matchesSearchFilename &&
            matchesSearchDate &&
            matchesSearchPeople
          );
        }

        const matchesPhotoStateAfterUpdate = currentAreaPhotoStates.includes(updatedAsset.photoState);
        const matchesMediaTypeAfterUpdate =
          mediaTypeFilters.length === 0 || mediaTypeFilters.includes(updatedAsset.mediaType);
        return matchesPhotoStateAfterUpdate && matchesMediaTypeAfterUpdate;
      })();

      if (isActiveAssetUpdate) {
        if (!remainsVisibleAfterUpdate) {
          const replacementAssetId = getAdjacentReplacementAssetId(navigationList, assetId);
          setSelectedAssetId(replacementAssetId);
        } else if (advanceAfterRating) {
          const nextAsset =
            currentIndex >= 0 && currentIndex < navigationList.length - 1
              ? navigationList[currentIndex + 1]
              : undefined;
          if (nextAsset) {
            setSelectedAssetId(nextAsset.id);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setUpdateError(`Failed to update asset ${assetId}: ${error.message}`);
      } else {
        setUpdateError(`Failed to update asset ${assetId}`);
      }
    } finally {
      setAssetUpdating(assetId, false);
    }
  }

  async function handleDiscardDisplayedImmersiveAsset(): Promise<void> {
    if (!immersiveOpen || selectedAssetId === null || updatingAssetIds[selectedAssetId] === true) {
      return;
    }

    const assetId = selectedAssetId;
    const replacementAssetId =
      getAdjacentReplacementAssetId(immersiveAssets, assetId) ??
      getAdjacentReplacementAssetId(visibleAssets, assetId);

    await handleSetPhotoState(assetId, PhotoState.Discard);

    setSelectedAssetIds((previous) => previous.filter((id) => id !== assetId));
    if (selectionAnchorAssetId === assetId) {
      setSelectionAnchorAssetId(replacementAssetId);
    }
    if (selectedAssetId === assetId) {
      setSelectedAssetId(replacementAssetId);
    }
  }

  async function handleApplyPhotoStateToSelectedAssets(photoState: PhotoState): Promise<void> {
    const assetIds = selectedAssetIds;

    if (assetIds.length === 0) {
      return;
    }

    for (const assetId of assetIds) {
      setAssetUpdating(assetId, true);
    }
    setUpdateError(null);

    try {
      const updatedAssets = await Promise.all(
        assetIds.map(async (assetId) => {
          const response = await fetch(`/api/assets/${assetId}/photoState`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ photoState })
          });

          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }

          return (await response.json()) as MediaAsset;
        })
      );

      const updatesById = new Map(updatedAssets.map((asset) => [asset.id, asset]));
      setAssets((previous) =>
        previous.map((asset) => updatesById.get(asset.id) ?? asset)
      );
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to update selected assets');
    } finally {
      for (const assetId of assetIds) {
        setAssetUpdating(assetId, false);
      }
    }
  }

  function applyKeywordIdsToLocalAssets(
    assetIds: string[],
    updateKeywordIds: (currentKeywordIds: string[]) => string[]
  ): void {
    const assetIdSet = new Set(assetIds);

    setAssets((previous) =>
      previous.map((asset) =>
        assetIdSet.has(asset.id)
          ? { ...asset, keywordIds: updateKeywordIds(asset.keywordIds ?? []) }
          : asset
      )
    );
    setSelectedAssetDetails((previous) =>
      previous && assetIdSet.has(previous.id)
        ? { ...previous, keywordIds: updateKeywordIds(previous.keywordIds ?? []) }
        : previous
    );
  }

  async function ensureKeywordForEntry(entry: Keyword | string): Promise<Keyword> {
    if (typeof entry !== 'string') {
      return entry;
    }

    const trimmedLabel = entry.trim().replace(/\s+/g, ' ');
    const normalizedLabel = normalizeKeywordLabel(trimmedLabel);
    const existing = keywords.find((keyword) => keyword.normalizedLabel === normalizedLabel);
    if (existing) {
      return existing;
    }

    try {
      const response = await createKeywordRequest({ label: trimmedLabel });
      setKeywords((previous) => sortKeywordsByPath([...previous, response.item]));
      return response.item;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create keyword';
      if (message.toLowerCase().includes('already exists')) {
        const response = await listKeywordsRequest();
        const sorted = sortKeywordsByPath(response.items);
        setKeywords(sorted);
        const matched = sorted.find((keyword) => keyword.normalizedLabel === normalizedLabel);
        if (matched) {
          return matched;
        }
      }

      throw error;
    }
  }

  async function handleAddKeywordsToSelectedAssets(entries: Array<Keyword | string>): Promise<boolean> {
    const assetIds = selectedAssetIds;
    if (assetIds.length === 0 || entries.length === 0) {
      return false;
    }

    setKeywordUpdateBusy(true);
    setUpdateError(null);

    try {
      const resolvedKeywords = await Promise.all(entries.map((entry) => ensureKeywordForEntry(entry)));
      const keywordIds = Array.from(new Set(resolvedKeywords.map((keyword) => keyword.id)));
      if (keywordIds.length === 0) {
        return false;
      }

      await addKeywordsToAssetsRequest({ assetIds, keywordIds });
      applyKeywordIdsToLocalAssets(assetIds, (currentKeywordIds) =>
        Array.from(new Set([...currentKeywordIds, ...keywordIds]))
      );
      rememberRecentKeywordIds(keywordIds);
      return true;
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to add keywords');
      return false;
    } finally {
      setKeywordUpdateBusy(false);
    }
  }

  async function handleRemoveKeywordFromSelectedAssets(keyword: Keyword): Promise<void> {
    const assetIds = selectedAssetIds;
    if (assetIds.length === 0) {
      return;
    }

    setKeywordUpdateBusy(true);
    setUpdateError(null);

    try {
      await removeKeywordsFromAssetsRequest({ assetIds, keywordIds: [keyword.id] });
      applyKeywordIdsToLocalAssets(assetIds, (currentKeywordIds) =>
        currentKeywordIds.filter((keywordId) => keywordId !== keyword.id)
      );
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to remove keyword');
    } finally {
      setKeywordUpdateBusy(false);
    }
  }

  function handleOpenSetCaptureDateDialog(): void {
    if (selectedAssetIds.length === 0) {
      return;
    }

    setSetCaptureDateDialogOpen(true);
  }

  async function handleUpdateSelectedAssetsCaptureDateTime(input: {
    captureDateTime?: string | null;
    captureDate?: string;
  }): Promise<void> {
    const assetIds = selectedAssetIds;
    if (assetIds.length === 0) {
      return;
    }

    setUpdateError(null);

    try {
      const request: {
        assetIds: string[];
        captureDateTime?: string | null;
        captureDate?: string;
      } = {
        assetIds,
        ...(input.captureDateTime !== undefined ? { captureDateTime: input.captureDateTime } : {}),
        ...(input.captureDate !== undefined ? { captureDate: input.captureDate } : {})
      };

      const updatedAssets = await updateAssetsCaptureDateTime(request);

      const updatesById = new Map(updatedAssets.map((asset) => [asset.id, asset]));
      setAssets((previous) =>
        previous.map((asset) => updatesById.get(asset.id) ?? asset)
      );

      if (selectedAssetId && updatesById.has(selectedAssetId)) {
        setSelectedAssetDetails((previous) => {
          const updatedAsset = updatesById.get(selectedAssetId);
          if (!updatedAsset) {
            return previous;
          }

          return previous && previous.id === selectedAssetId
            ? { ...previous, ...updatedAsset }
            : updatedAsset;
        });
      }

      setSetCaptureDateDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update capture date.';
      setUpdateError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleMoveSelectedAssetWithinAlbum(
    destination: 'top' | 'up' | 'down' | 'bottom'
  ): Promise<void> {
    if (!singleCheckedAlbumId || !selectedManualOrderAsset) {
      return;
    }

    const currentOrder = manualOrderEligibleAssetsInCurrentAlbum.map((asset) => asset.id);
    const currentIndex = currentOrder.indexOf(selectedManualOrderAsset.id);
    if (currentIndex < 0 || currentOrder.length < 2) {
      return;
    }

    let nextIndex = currentIndex;
    switch (destination) {
      case 'top':
        nextIndex = 0;
        break;
      case 'up':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'down':
        nextIndex = Math.min(currentOrder.length - 1, currentIndex + 1);
        break;
      case 'bottom':
        nextIndex = currentOrder.length - 1;
        break;
    }

    if (nextIndex === currentIndex) {
      return;
    }

    const reorderedAssetIds = moveArrayItem(currentOrder, currentIndex, nextIndex);
    setAssetUpdating(selectedManualOrderAsset.id, true);
    setUpdateError(null);

    try {
      const updatedAssets = await updateAlbumManualOrder(singleCheckedAlbumId, {
        orderedAssetIds: reorderedAssetIds
      });
      const updatesById = new Map(updatedAssets.map((asset) => [asset.id, asset]));
      setAssets((previous) => previous.map((asset) => updatesById.get(asset.id) ?? asset));

      if (selectedAssetId && updatesById.has(selectedAssetId)) {
        setSelectedAssetDetails((previous) =>
          previous && previous.id === selectedAssetId
            ? { ...previous, ...(updatesById.get(selectedAssetId) ?? previous) }
            : previous
        );
      }
    } catch (error: unknown) {
      setUpdateError(
        error instanceof Error ? error.message : 'Failed to reorder the selected album asset'
      );
    } finally {
      setAssetUpdating(selectedManualOrderAsset.id, false);
    }
  }

  async function handleSetSelectedAssetAlbumOrderingMode(forceManualOrder: boolean): Promise<void> {
    if (!singleCheckedAlbumId || !selectedAsset || selectedAssetIds.length !== 1) {
      return;
    }

    setAssetUpdating(selectedAsset.id, true);
    setUpdateError(null);

    try {
      const updatedAsset = await updateAlbumOrderingMode(singleCheckedAlbumId, {
        assetId: selectedAsset.id,
        forceManualOrder
      });
      setAssets((previous) =>
        previous.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset))
      );
      setSelectedAssetDetails((previous) =>
        previous && previous.id === updatedAsset.id ? { ...previous, ...updatedAsset } : previous
      );
    } catch (error: unknown) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : 'Failed to update album ordering mode for the selected asset'
      );
    } finally {
      setAssetUpdating(selectedAsset.id, false);
    }
  }

  async function handleRotateSelectedAssets(
    direction: 'clockwise' | 'counterclockwise' | '180'
  ): Promise<void> {
    const assetIds = selectedAssetIds;
    if (assetIds.length === 0) {
      return;
    }

    for (const assetId of assetIds) {
      setAssetUpdating(assetId, true);
    }
    setUpdateError(null);

    try {
      const results = await Promise.allSettled(
        assetIds.map(async (assetId) => {
          const updatedAsset =
            direction === 'clockwise'
              ? await rotateAssetClockwise(assetId)
              : direction === '180'
                ? await rotateAsset180(assetId)
                : await rotateAssetCounterclockwise(assetId);
          return { assetId, updatedAsset };
        })
      );

      const succeeded = results.filter((result): result is PromiseFulfilledResult<{ assetId: string; updatedAsset: MediaAsset }> => result.status === 'fulfilled');
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

      if (succeeded.length > 0) {
        const updatesById = new Map(succeeded.map((result) => [result.value.updatedAsset.id, result.value.updatedAsset]));
        setAssets((previous) => previous.map((asset) => updatesById.get(asset.id) ?? asset));

        if (selectedAssetId && updatesById.has(selectedAssetId)) {
          const refreshedAsset = await loadAssetDetails(selectedAssetId);
          setSelectedAssetDetails(refreshedAsset);
        }
      }

      if (failed.length > 0) {
        const errorLines = failed.map((result) =>
          result.reason instanceof Error ? result.reason.message : 'Failed to rotate one or more assets'
        );
        setUpdateError(errorLines.join(' | '));
      }
    } finally {
      for (const assetId of assetIds) {
        setAssetUpdating(assetId, false);
      }
    }
  }

  async function handleRunPeopleRecognitionForSelectedAssets(): Promise<void> {
    const assetIds = selectedAssetIds;
    if (assetIds.length === 0 || peopleRecognitionBusy) {
      return;
    }

    setPeopleRecognitionBusy(true);
    setPeopleRecognitionNotice(null);
    setUpdateError(null);

    try {
      const results = await Promise.allSettled(
        assetIds.map(async (assetId) => {
          const response = await processPeopleAsset(assetId);
          return { assetId, response };
        })
      );

      const succeeded = results.filter((result) => result.status === 'fulfilled');
      const failed = results.filter((result) => result.status === 'rejected');

      if (failed.length === 0) {
        if (assetIds.length === 1 && selectedAssetId === assetIds[0]) {
          await loadSelectedAssetPeopleStatus(assetIds[0]);
        }
        setPeopleRecognitionNotice({
          kind: 'success',
          message:
            succeeded.length === 1
              ? 'People recognition completed for 1 asset.'
              : `People recognition completed for ${succeeded.length} assets.`,
          ...(assetIds.length === 1 ? { reviewAssetId: assetIds[0] } : {})
        });
        return;
      }

      if (succeeded.length === 0) {
        setPeopleRecognitionNotice({
          kind: 'error',
          message:
            failed[0]?.reason instanceof Error
              ? `People recognition failed: ${failed[0].reason.message}`
              : 'People recognition failed for all selected assets.'
        });
        return;
      }

      if (assetIds.length === 1 && selectedAssetId === assetIds[0]) {
        await loadSelectedAssetPeopleStatus(assetIds[0]);
      }
      setPeopleRecognitionNotice({
        kind: 'error',
        message: `People recognition completed for ${succeeded.length} assets, ${failed.length} failed.`,
        ...(assetIds.length === 1 ? { reviewAssetId: assetIds[0] } : {})
      });
    } finally {
      setPeopleRecognitionBusy(false);
    }
  }

  async function loadScopedPeopleSummary(assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) {
      setScopedPeopleSummary(null);
      return;
    }

    setScopedPeopleSummaryLoading(true);
    setScopedPeopleError(null);
    try {
      const summary = await getPeopleScopedAssetSummary({ assetIds });
      setScopedPeopleSummary(summary);
    } catch (error) {
      setScopedPeopleError(error instanceof Error ? error.message : 'Failed to load scoped people summary');
    } finally {
      setScopedPeopleSummaryLoading(false);
    }
  }

  function handleOpenScopedPeopleDialog(): void {
    if (!currentScopedPeopleScope || currentScopedPeopleScope.assetIds.length === 0) {
      return;
    }

    setScopedPeopleDialogOpen(true);
    setScopedPeopleNotice(null);
    void loadScopedPeopleSummary(currentScopedPeopleScope.assetIds);
  }

  async function runPeopleRecognitionForAssetScope(force: boolean): Promise<void> {
    if (!currentScopedPeopleScope || currentScopedPeopleScope.assetIds.length === 0 || scopedPeopleBusyAction) {
      return;
    }

    const assetIds = currentScopedPeopleScope.assetIds;
    if (assetIds.length > 300) {
      const confirmed = window.confirm(
        `${force ? 'Reprocess' : 'Run'} people recognition for ${assetIds.length} assets in ${currentScopedPeopleScope.scopeSourceLabel}?`
      );
      if (!confirmed) {
        return;
      }
    }
    setScopedPeopleBusyAction(force ? 'reprocess' : 'process');
    setScopedPeopleError(null);
    setScopedPeopleNotice(null);

    try {
      const results = await Promise.allSettled(
        assetIds.map(async (assetId) => {
          const response = await processPeopleAsset(assetId, force ? { force: true } : undefined);
          return { assetId, response };
        })
      );

      const succeeded = results.filter(
        (result): result is PromiseFulfilledResult<{ assetId: string; response: Awaited<ReturnType<typeof processPeopleAsset>> }> =>
          result.status === 'fulfilled'
      );
      const failed = results.filter((result) => result.status === 'rejected');

      if (succeeded.length > 0) {
        const updatesById = new Map(
          succeeded.map(({ value }) => [
            value.assetId,
            {
              people: value.response.people,
              detectionsCount: value.response.detections.length,
              reviewableDetectionsCount: value.response.detections.filter(
                (detection) =>
                  detection.matchStatus === 'unmatched' ||
                  detection.matchStatus === 'suggested' ||
                  detection.matchStatus === 'autoMatched'
              ).length,
              confirmedDetectionsCount: value.response.detections.filter(
                (detection) => detection.matchStatus === 'confirmed'
              ).length
            }
          ])
        );

        setAssets((previous) =>
          previous.map((asset) => {
            const update = updatesById.get(asset.id);
            return update
              ? {
                  ...asset,
                  ...update
                }
              : asset;
          })
        );
      }

      await loadScopedPeopleSummary(assetIds);

      const skipped = succeeded.filter(({ value }) => value.response.processed === false).length;
      const processed = succeeded.filter(({ value }) => value.response.processed === true).length;
      const failureCount = failed.length;

      setScopedPeopleNotice(
        `${force ? 'Reprocessed' : 'Processed'} ${processed} asset${processed === 1 ? '' : 's'}${
          skipped > 0 ? `, skipped ${skipped}` : ''
        }${failureCount > 0 ? `, failed ${failureCount}` : ''}.`
      );
    } catch (error) {
      setScopedPeopleError(error instanceof Error ? error.message : 'Failed to run scoped people recognition');
    } finally {
      setScopedPeopleBusyAction(null);
    }
  }

  function handleOpenScopedPeopleReview(): void {
    if (!currentScopedPeopleScope || currentScopedPeopleScope.assetIds.length === 0) {
      return;
    }

    writeSessionStorageJson(scopedPeopleReviewAssetIdsStorageKey, {
      assetIds: currentScopedPeopleScope.assetIds,
      scopeType: currentScopedPeopleScope.scopeType,
      scopeLabel: currentScopedPeopleScope.scopeLabel,
      scopeSourceLabel: currentScopedPeopleScope.scopeSourceLabel
    } satisfies ScopedPeopleReviewAssetIdsState);
    setScopedPeopleDialogOpen(false);
    void navigate('/people/review?scopeAssetIds=active');
  }

  function handleOpenAssetPeopleReviewDialog(): void {
    if (!isLibraryArea || selectedAssetIds.length !== 1 || !selectedAsset) {
      return;
    }

    setAssetPeopleReviewDialogOpen(true);
  }

  function handleSelectRelativeInList(list: MediaAsset[], offset: number): void {
    if (selectedAssetId === null || list.length === 0) {
      return;
    }

    const currentIndex = list.findIndex((asset) => asset.id === selectedAssetId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), list.length - 1);
    const nextAsset = list[nextIndex];
    if (nextAsset) {
      setSelectedAssetId(nextAsset.id);
    }
  }

  function handleDeselectCurrentImmersiveSelection(): void {
    if (!immersiveOpen || selectedAssetId === null || compareAssets.length === 0) {
      return;
    }

    const currentSelectedAsset = compareAssets.find((asset) => asset.id === selectedAssetId);
    if (!currentSelectedAsset) {
      return;
    }

    const replacementAssetId =
      getAdjacentReplacementAssetId(compareAssets, selectedAssetId) ??
      getAdjacentReplacementAssetId(visibleAssets, selectedAssetId);
    const nextSelectedIds = selectedAssetIds.filter((id) => id !== selectedAssetId);

    setSelectedAssetIds(nextSelectedIds);
    setSelectedAssetId(replacementAssetId);

    if (selectionAnchorAssetId === selectedAssetId) {
      setSelectionAnchorAssetId(nextSelectedIds[0] ?? replacementAssetId);
    }
  }

  function handleSelectAbsolute(position: 'first' | 'last'): void {
    if (visibleAssets.length === 0) {
      return;
    }

    const nextAsset =
      position === 'first' ? visibleAssets[0] : visibleAssets[visibleAssets.length - 1];
    if (nextAsset) {
      setSelectedAssetId(nextAsset.id);
    }
  }

  function getRenderedGridCardLayouts(): GridCardLayout[] {
    if (!mainColumnRef.current) {
      return [];
    }

    return Array.from(
      mainColumnRef.current.querySelectorAll<HTMLElement>('[data-grid-card="true"][data-asset-id]')
    )
      .map((node) => {
        const assetId = node.dataset.assetId;
        if (!assetId) {
          return null;
        }

        const rect = node.getBoundingClientRect();
        return {
          assetId,
          node,
          rect,
          centerX: (rect.left + rect.right) / 2,
          centerY: (rect.top + rect.bottom) / 2
        };
      })
      .filter((entry): entry is GridCardLayout => entry !== null);
  }

  function handleSelectGridDirectional(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (!selectedAssetId || !mainColumnRef.current) {
      return;
    }

    const layouts = getRenderedGridCardLayouts();
    if (layouts.length === 0) {
      return;
    }

    const currentLayout =
      layouts.find(
        (layout) =>
          layout.assetId === selectedAssetId &&
          layout.node.dataset.active === 'true'
      ) ?? layouts.find((layout) => layout.assetId === selectedAssetId);
    if (!currentLayout) {
      return;
    }

    const { rect: currentRect, centerX: currentCenterX, centerY: currentCenterY } = currentLayout;
    const rowTolerance = getGridRowTolerance(currentRect.height);
    const columnTolerance = Math.max(currentRect.width * 0.75, 24);

    let bestLayout: GridCardLayout | null = null;
    let bestPrimary = Number.POSITIVE_INFINITY;
    let bestSecondary = Number.POSITIVE_INFINITY;

    for (const layout of layouts) {
      if (layout.node === currentLayout.node) {
        continue;
      }

      const { rect, centerX, centerY } = layout;
      const horizontalOverlap = getOverlapLength(rect.left, rect.right, currentRect.left, currentRect.right);
      const verticalOverlap = getOverlapLength(rect.top, rect.bottom, currentRect.top, currentRect.bottom);
      let primaryDistance = Number.POSITIVE_INFINITY;
      let secondaryDistance = Number.POSITIVE_INFINITY;

      if (direction === 'right') {
        if (centerX <= currentCenterX) {
          continue;
        }

        const rowAligned =
          verticalOverlap > Math.min(rect.height, currentRect.height) * 0.35 ||
          Math.abs(centerY - currentCenterY) <= rowTolerance;
        if (!rowAligned) {
          continue;
        }

        primaryDistance = centerX - currentCenterX;
        secondaryDistance = Math.abs(centerY - currentCenterY);
      } else if (direction === 'left') {
        if (centerX >= currentCenterX) {
          continue;
        }

        const rowAligned =
          verticalOverlap > Math.min(rect.height, currentRect.height) * 0.35 ||
          Math.abs(centerY - currentCenterY) <= rowTolerance;
        if (!rowAligned) {
          continue;
        }

        primaryDistance = currentCenterX - centerX;
        secondaryDistance = Math.abs(centerY - currentCenterY);
      } else if (direction === 'down') {
        if (centerY <= currentCenterY) {
          continue;
        }

        const columnAligned =
          horizontalOverlap > Math.min(rect.width, currentRect.width) * 0.35 ||
          Math.abs(centerX - currentCenterX) <= columnTolerance;
        if (!columnAligned) {
          continue;
        }

        primaryDistance = centerY - currentCenterY;
        secondaryDistance = Math.abs(centerX - currentCenterX);
      } else {
        if (centerY >= currentCenterY) {
          continue;
        }

        const columnAligned =
          horizontalOverlap > Math.min(rect.width, currentRect.width) * 0.35 ||
          Math.abs(centerX - currentCenterX) <= columnTolerance;
        if (!columnAligned) {
          continue;
        }

        primaryDistance = currentCenterY - centerY;
        secondaryDistance = Math.abs(centerX - currentCenterX);
      }

      if (
        primaryDistance < bestPrimary ||
        (Math.abs(primaryDistance - bestPrimary) < 0.5 && secondaryDistance < bestSecondary)
      ) {
        bestLayout = layout;
        bestPrimary = primaryDistance;
        bestSecondary = secondaryDistance;
      }
    }

    let nextAssetId = bestLayout?.assetId ?? null;
    const currentRowLayouts = layouts
      .filter((layout) => Math.abs(layout.centerY - currentCenterY) <= rowTolerance)
      .sort((left, right) => left.centerX - right.centerX);
    const currentRowIndex = currentRowLayouts.findIndex((layout) => layout.assetId === currentLayout.assetId);

    if (!nextAssetId && (direction === 'right' || direction === 'left') && currentRowIndex >= 0) {
      const sortedRows = [...layouts]
        .sort((left, right) =>
          Math.abs(left.centerY - right.centerY) < rowTolerance
            ? left.centerX - right.centerX
            : left.centerY - right.centerY
        )
        .reduce<GridCardLayout[][]>((rows, layout) => {
          const lastRow = rows[rows.length - 1];
          if (!lastRow) {
            rows.push([layout]);
            return rows;
          }

          const rowCenterY =
            lastRow.reduce((sum, rowLayout) => sum + rowLayout.centerY, 0) / lastRow.length;
          if (Math.abs(layout.centerY - rowCenterY) <= rowTolerance) {
            lastRow.push(layout);
            lastRow.sort((left, right) => left.centerX - right.centerX);
          } else {
            rows.push([layout]);
          }

          return rows;
        }, []);

      const currentVisualRowIndex = sortedRows.findIndex((row) =>
        row.some((layout) => layout.assetId === currentLayout.assetId)
      );

      if (currentVisualRowIndex >= 0) {
        if (direction === 'right') {
          const nextRow = sortedRows[currentVisualRowIndex + 1];
          nextAssetId = nextRow?.[0]?.assetId ?? null;
        } else {
          const previousRow = sortedRows[currentVisualRowIndex - 1];
          nextAssetId = previousRow?.[previousRow.length - 1]?.assetId ?? null;
        }
      }
    }

    if (nextAssetId) {
      pendingGridRevealAssetIdRef.current = nextAssetId;
      setSelectedAssetId(nextAssetId);
    }
  }

  async function requestBrowserFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      return;
    }

    const fullscreenTarget = document.documentElement;
    if (typeof fullscreenTarget.requestFullscreen !== 'function') {
      return;
    }

    try {
      await fullscreenTarget.requestFullscreen();
    } catch {
      // Ignore browser/fullscreen permission failures and continue with overlay fallback.
    }
  }

  async function exitBrowserFullscreenIfNeeded(): Promise<void> {
    if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch {
      // Ignore browser/fullscreen permission failures during cleanup.
    }
  }

  function openImmersive(): void {
    if (!selectedAsset) {
      return;
    }
    openImmersiveForAsset(selectedAsset.id);
  }

  function openImmersiveForAsset(assetId: string): void {
    const targetAssetExists =
      visibleAssets.some((asset) => asset.id === assetId) ||
      loupeAssets.some((asset) => asset.id === assetId) ||
      compareAssets.some((asset) => asset.id === assetId);

    if (!targetAssetExists) {
      return;
    }

    setSelectedAssetId(assetId);
    setSlideshowActive(false);
    setSlideshowPlaying(false);
    setSurveyOpen(false);
    setImmersiveOpen(true);
    void requestBrowserFullscreen();
  }

  function closeImmersive(): void {
    setImmersiveOpen(false);
    void exitBrowserFullscreenIfNeeded();
  }

  function openSurveyMode(): void {
    if (compareAssets.length < 2) {
      return;
    }

    setSlideshowActive(false);
    setSlideshowPlaying(false);
    setImmersiveOpen(false);
    void exitBrowserFullscreenIfNeeded();
    setSurveyOpen(true);
  }

  function startSlideshow(): void {
    if (slideshowAssets.length === 0) {
      return;
    }

    setSurveyOpen(false);
    setImmersiveOpen(false);
    void exitBrowserFullscreenIfNeeded();
    setSlideshowActive(true);
    setSlideshowPlaying(true);

    if (!selectedAssetId || !slideshowAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(slideshowAssets[0]?.id ?? null);
    }
  }

  function stopSlideshow(): void {
    setSlideshowActive(false);
    setSlideshowPlaying(false);
  }

  function toggleSlideshowPlayPause(): void {
    setSlideshowPlaying((previous) => !previous);
  }

  function handleSlideshowRelative(offset: number): void {
    if (slideshowAssets.length === 0) {
      return;
    }

    setSelectedAssetId((previous) => {
      const currentIndex = previous ? slideshowAssets.findIndex((asset) => asset.id === previous) : -1;
      if (currentIndex < 0) {
        return slideshowAssets[0]?.id ?? previous;
      }

      const nextIndex = (currentIndex + offset + slideshowAssets.length) % slideshowAssets.length;
      return slideshowAssets[nextIndex]?.id ?? previous;
    });
  }

  function setCurrentAreaPhotoStateVisibility(nextPhotoStates: PhotoState[]): void {
    if (primaryArea === 'Review') {
      setReviewVisiblePhotoStates(nextPhotoStates);
      return;
    }

    if (primaryArea === 'Library') {
      setLibraryVisiblePhotoStates(nextPhotoStates);
    }
  }

  function toggleCurrentAreaPhotoState(photoState: PhotoState): void {
    const rawNextPhotoStates = currentAreaPhotoStates.includes(photoState)
      ? currentAreaPhotoStates.filter((state) => state !== photoState)
      : [...currentAreaPhotoStates, photoState];
    const nextPhotoStates = photoStateFilterOptions.filter((state) =>
      rawNextPhotoStates.includes(state)
    );

    setCurrentAreaPhotoStateVisibility(nextPhotoStates);
  }

  function toggleMediaTypeFilter(mediaType: MediaType): void {
    setMediaTypeFilters((previous) =>
      previous.includes(mediaType)
        ? previous.filter((type) => type !== mediaType)
        : [...previous, mediaType]
    );
  }

  function toggleSearchPhotoState(photoState: PhotoState): void {
    setSearchPhotoStates((previous) =>
      previous.includes(photoState)
        ? previous.filter((state) => state !== photoState)
        : [...previous, photoState]
    );
  }

  function toggleSearchAlbum(albumId: string): void {
    setSearchAlbumIds((previous) =>
      previous.includes(albumId)
        ? previous.filter((id) => id !== albumId)
        : [...previous, albumId]
    );
  }

  function toggleSearchGroup(groupId: string): void {
    setSearchGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId]
    );
  }

  function toggleSearchPerson(personId: string): void {
    setSearchHasNoPeople(false);
    setSearchPeopleIds((previous) =>
      previous.includes(personId)
        ? previous.filter((id) => id !== personId)
        : [...previous, personId]
    );
  }

  function setPendingSearchFilters(filters: SearchFilters): void {
    setSearchPhotoStates(filters.photoStates);
    setSearchAlbumIds(filters.albumIds);
    setSearchGroupIds(filters.groupIds);
    setSearchFilenamePattern(filters.filenamePattern);
    setSearchCaptureDateFrom(filters.captureDateFrom);
    setSearchCaptureDateTo(filters.captureDateTo);
    setSearchCaptureDateAvailability(filters.captureDateAvailability);
    setSearchPeopleIds(filters.peopleIds);
    setSearchPeopleMatchMode(filters.peopleMatchMode);
    setSearchHasNoPeople(filters.hasNoPeople);
    setSearchHasReviewableFaces(filters.hasReviewableFaces);
    setSearchKeywordId(filters.keywordId);
  }

  function applyPendingSearchFilters(): void {
    setAppliedSearchFilters(pendingSearchFilters);
    setSmartAlbumSaveError(null);
    setSmartAlbumSaveNotice(null);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectionAnchorAssetId(null);
  }

  function clearFilters(): void {
    const defaultStates = getDefaultPhotoStatesForPrimaryArea(primaryArea);
    if (defaultStates) {
      setCurrentAreaPhotoStateVisibility(defaultStates);
    }
    setMediaTypeFilters([]);
  }

  function clearSearchFilters(): void {
    setPendingSearchFilters(getDefaultSearchFilters());
    setAppliedSearchFilters(null);
    setSearchKeywordQuery('');
    setSearchPeopleQuery('');
    setActiveSmartAlbumId(null);
    setSmartAlbumSaveError(null);
    setSmartAlbumSaveNotice(null);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectionAnchorAssetId(null);
  }

  function applySmartAlbumToSearch(smartAlbum: SmartAlbum): void {
    const filterSpec = normalizeSmartAlbumFilterSpecForComparison(smartAlbum.filterSpec);
    const keyword = filterSpec.keywordId ? keywordsById.get(filterSpec.keywordId) ?? null : null;
    const nextFilters: SearchFilters = {
      ...getDefaultSearchFilters(),
      photoStates: filterSpec.photoState ? [filterSpec.photoState] : [],
      groupIds: filterSpec.yearGroupId ? [filterSpec.yearGroupId] : [],
      keywordId: filterSpec.keywordId ?? null
    };

    setPrimaryArea('Search');
    setPendingSearchFilters(nextFilters);
    setAppliedSearchFilters(nextFilters);
    setSearchKeywordQuery(keyword ? formatKeywordPathLabel(keyword, keywordsById) : '');
    setSearchPeopleQuery('');
    setActiveSmartAlbumId(smartAlbum.id);
    setSmartAlbumSaveError(null);
    setSmartAlbumSaveNotice(null);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectionAnchorAssetId(null);
  }

  async function handleSaveCurrentSearchAsSmartAlbum(): Promise<void> {
    if (hasPendingSearchChanges) {
      setSmartAlbumSaveError('Run Search before saving a Smart Album.');
      setSmartAlbumSaveNotice(null);
      return;
    }

    if (!appliedSearchSmartAlbumFilterSpec) {
      setSmartAlbumSaveError(
        'Smart Albums currently support one keyword, one photo state, and one year group only.'
      );
      setSmartAlbumSaveNotice(null);
      return;
    }

    const label = normalizeSmartAlbumSaveLabel(smartAlbumSaveLabel);
    if (label.length === 0) {
      setSmartAlbumSaveError('Enter a Smart Album label.');
      setSmartAlbumSaveNotice(null);
      return;
    }

    setSmartAlbumSaveBusy(true);
    setSmartAlbumSaveError(null);
    setSmartAlbumSaveNotice(null);

    try {
      const response = await createSmartAlbumRequest({
        label,
        filterSpec: appliedSearchSmartAlbumFilterSpec
      });
      setSmartAlbums((previous) =>
        [...previous, response.item].sort((left, right) =>
          left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
        )
      );
      setSmartAlbumSaveLabel('');
      setSmartAlbumSaveNotice(`Saved Smart Album "${response.item.label}".`);
      setActiveSmartAlbumId(response.item.id);
      await loadSmartAlbums({ showLoading: false });
    } catch (error) {
      setSmartAlbumSaveError(error instanceof Error ? error.message : 'Failed to save Smart Album');
    } finally {
      setSmartAlbumSaveBusy(false);
    }
  }

  function clearSelection(): void {
    setSelectedAssetIds([]);
    setSelectionAnchorAssetId(selectedAssetId);
  }

  function handleSetLibraryBrowseMode(mode: LibraryBrowseMode): void {
    setLibraryBrowseMode(mode);
  }

  function handleSetReviewBrowseMode(mode: ReviewBrowseMode): void {
    setReviewBrowseMode(mode);
  }

  function handleSetTimelineZoomLevel(nextLevel: number): void {
    if (nextLevel === timelineZoomLevel) {
      return;
    }

    pendingTimelineZoomAnchorKeyRef.current = getTopVisibleTimelineMonthKey();
    setTimelineZoomLevel(nextLevel);
  }

  function handleSetAlbumResultsPresentation(mode: AlbumResultsPresentation): void {
    setAlbumResultsPresentation(mode);
  }

  function toggleTimelineYearExpanded(yearKey: string): void {
    setTimelineNavExpandedYearKeys((previous) =>
      previous.includes(yearKey)
        ? previous.filter((key) => key !== yearKey)
        : [...previous, yearKey]
    );
  }

  function handleJumpToTimelineMonth(groupKey: string): void {
    setActiveTimelineMonthKey(groupKey);
    const sectionElement = timelineSectionRefs.current[groupKey];
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggleGroupExpanded(groupId: string): void {
    setExpandedGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId]
    );
  }

  function toggleAlbumChecked(albumId: string): void {
    if (primaryArea === 'Library') {
      setLibraryBrowseMode('Albums');
    }
    setCheckedAlbumIds((previous) =>
      previous.includes(albumId)
        ? previous.filter((id) => id !== albumId)
        : [...previous, albumId]
    );
  }

  function clearCheckedAlbums(): void {
    setCheckedAlbumIds([]);
  }

  function collapseAllAlbumGroups(): void {
    setExpandedGroupIds([]);
  }

  function revealCheckedAlbums(): void {
    if (checkedAlbumIdsInTreeOrder.length === 0) {
      return;
    }

    const nextIndex = (checkedAlbumRevealIndexRef.current + 1) % checkedAlbumIdsInTreeOrder.length;
    const targetAlbumId = checkedAlbumIdsInTreeOrder[nextIndex] ?? null;
    if (!targetAlbumId) {
      return;
    }

    checkedAlbumRevealIndexRef.current = nextIndex;
    pendingCheckedAlbumRevealIdRef.current = targetAlbumId;

    const ancestorGroupIds = getAncestorGroupIdsForAlbumIds([targetAlbumId], albumNodesById);
    setExpandedGroupIds((previous) => {
      const merged = new Set(previous);
      for (const ancestorId of ancestorGroupIds) {
        merged.add(ancestorId);
      }

      return Array.from(merged);
    });
  }

  async function handleCreateAlbumTreeNode(
    nodeType: 'Group' | 'Album',
    parentId: string | null,
    targetIndex?: number
  ): Promise<void> {
    const canCreateNode = nodeType === 'Group' ? canCreateGroupNode : canCreateAlbumNode;
    if (!canCreateNode) {
      setUpdateError('Album tree is still loading.');
      return;
    }

    const input = window.prompt(nodeType === 'Group' ? 'Group label' : 'Album label');
    if (!input) {
      return;
    }

    const label = input.trim();
    if (label.length === 0) {
      return;
    }

    try {
      const created = await createAlbumTreeNode({
        label,
        nodeType,
        parentId,
        ...(targetIndex !== undefined ? { targetIndex } : {})
      });

      if (nodeType === 'Album') {
        if (primaryArea === 'Library') {
          setLibraryBrowseMode('Albums');
        }
        setCheckedAlbumIds((previous) => (previous.includes(created.id) ? previous : [...previous, created.id]));
      }

      if (parentId && !expandedGroupIds.includes(parentId)) {
        setExpandedGroupIds((previous) => (previous.includes(parentId) ? previous : [...previous, parentId]));
      }

      setSelectedTreeNodeId(created.id);
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : nodeType === 'Group'
            ? 'Failed to create group'
            : 'Failed to create album'
      );
    }
  }

  async function handleCreateGroup(): Promise<void> {
    await handleCreateAlbumTreeNode('Group', albumTreeCreationParentId);
  }

  async function handleCreateTopLevelGroup(): Promise<void> {
    if (!canCreateGroupNode) {
      setUpdateError('Album tree is still loading.');
      return;
    }

    setCreateTopLevelGroupDialogOpen(true);
  }

  async function handleCreateTopLevelGroupWithPosition(input: {
    label: string;
    targetIndex: number;
  }): Promise<void> {
    try {
      const created = await createAlbumTreeNode({
        label: input.label,
        nodeType: 'Group',
        parentId: null,
        targetIndex: input.targetIndex
      });

      setSelectedTreeNodeId(created.id);
      setCreateTopLevelGroupDialogOpen(false);
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create group';
      setUpdateError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleCreateAlbum(): Promise<void> {
    await handleCreateAlbumTreeNode('Album', albumTreeCreationParentId);
  }

  async function handleCreateTopLevelAlbum(): Promise<void> {
    await handleCreateAlbumTreeNode('Album', null);
  }

  function handleOpenImportDialog(
    initialAlbumDestination: ImportAssetsDialogInitialAlbumDestination | null = null
  ): void {
    setImportDialogInitialAlbumDestination(initialAlbumDestination);
    setImportDialogOpen(true);
  }

  function closeAlbumTreeContextMenu(): void {
    setAlbumTreeOrderSubmenuOpen(false);
    setAlbumTreeContextMenu(null);
  }

  function handleAlbumTreeNodeContextMenu(
    event: ReactMouseEvent<HTMLDivElement>,
    node: AlbumTreeNode
  ): void {
    if (selectedTreeNodeId !== node.id) {
      return;
    }

    if (node.nodeType !== 'Group' && node.nodeType !== 'Album') {
      return;
    }

    event.preventDefault();
    setAlbumTreeOrderSubmenuOpen(false);
    setAlbumTreeContextMenu({
      nodeId: node.id,
      x: event.clientX,
      y: event.clientY
    });
  }

  function handleImportAlbumFromSelectedGroup(): void {
    if (!selectedAlbumTreeGroupNode) {
      return;
    }

    closeAlbumTreeContextMenu();
    handleOpenImportDialog({
      mode: 'new',
      parentGroupId: selectedAlbumTreeGroupNode.id
    });
  }

  async function handleSetSelectedGroupChildOrderMode(
    childOrderMode: AlbumTreeChildOrderMode
  ): Promise<void> {
    if (!selectedAlbumTreeGroupNode) {
      return;
    }

    closeAlbumTreeContextMenu();

    try {
      const updatedNode = await updateAlbumTreeChildOrderMode(selectedAlbumTreeGroupNode.id, {
        childOrderMode
      });
      setAlbumTreeNodes((previous) =>
        previous.map((node) => (node.id === updatedNode.id ? updatedNode : node))
      );
      setSelectedTreeNodeId(updatedNode.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to update group child order mode.');
    }
  }

  function handleAlbumTreeMoveToPlaceholder(): void {
    closeAlbumTreeContextMenu();
  }

  function openMoveDialogForSelectedTreeNode(): void {
    if (!selectedTreeNodeId) {
      return;
    }

    closeAlbumTreeContextMenu();
    setMoveDialogNodeId(selectedTreeNodeId);
  }

  async function handleReorderSelectedTreeNode(direction: 'up' | 'down'): Promise<void> {
    if (!selectedTreeNodeId) {
      return;
    }

    if (!canUseCustomReorderCommands) {
      closeAlbumTreeContextMenu();
      return;
    }

    if (direction === 'up' && !canMoveSelectedTreeNodeUp) {
      closeAlbumTreeContextMenu();
      return;
    }

    if (direction === 'down' && !canMoveSelectedTreeNodeDown) {
      closeAlbumTreeContextMenu();
      return;
    }

    closeAlbumTreeContextMenu();

    try {
      await reorderAlbumTreeNode(selectedTreeNodeId, { direction });
      await loadAlbumTreeNodes({ showLoading: false });
      setSelectedTreeNodeId(selectedTreeNodeId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to reorder album tree node.');
    }
  }

  function handleImportPhotosIntoSelectedAlbum(): void {
    if (!selectedAlbumTreeAlbumNode) {
      return;
    }

    closeAlbumTreeContextMenu();
    handleOpenImportDialog({
      mode: 'existing',
      albumId: selectedAlbumTreeAlbumNode.id
    });
  }

  async function handleMoveTreeNode(input: { destinationParentId: string | null; targetIndex: number }): Promise<void> {
    if (!moveDialogNode) {
      return;
    }

    setUpdateError(null);

    try {
      const moved = await moveAlbumTreeNode(moveDialogNode.id, {
        parentId: input.destinationParentId,
        targetIndex: input.targetIndex
      });
      const ancestorGroupIds = getAncestorGroupIdsForParentId(input.destinationParentId, albumNodesById);

      if (ancestorGroupIds.length > 0) {
        setExpandedGroupIds((previous) => {
          const merged = new Set(previous);
          for (const groupId of ancestorGroupIds) {
            merged.add(groupId);
          }
          return Array.from(merged);
        });
      }

      setSelectedTreeNodeId(moved.id);
      setMoveDialogNodeId(null);
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to move node';
      setUpdateError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function handleRenameSelectedTreeNode(): Promise<void> {
    if (!selectedTreeNodeId) {
      return;
    }

    const current = albumNodesById.get(selectedTreeNodeId);
    if (!current) {
      return;
    }

    const input = window.prompt('Rename node', current.label);
    if (!input) {
      return;
    }

    const label = input.trim();
    if (label.length === 0) {
      return;
    }

    try {
      await renameAlbumTreeNode(selectedTreeNodeId, label);
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to rename node');
    }
  }

  async function handleDeleteSelectedTreeNode(): Promise<void> {
    if (!selectedTreeNodeId) {
      return;
    }

    const current = albumNodesById.get(selectedTreeNodeId);
    if (!current) {
      return;
    }

    const confirmed = window.confirm(`Delete ${current.nodeType.toLowerCase()} "${current.label}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteAlbumTreeNode(current.id);
      setSelectedTreeNodeId(null);
      if (current.nodeType === 'Album') {
        setCheckedAlbumIds((previous) => previous.filter((id) => id !== current.id));
      }
      await loadAlbumTreeNodes({ showLoading: false });
      await loadAssets({ showLoading: false, preserveCachedFirstPage: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to delete node');
    }
  }

  async function handleAddSelectedToAlbum(): Promise<void> {
    if (selectedAssetIdsForAlbumAction.length === 0) {
      return;
    }

    if (albumNodes.length === 0) {
      setUpdateError('Create an album first');
      return;
    }

    const options = albumNodes.map((album) => album.label).join(', ');
    const input = window.prompt(`Add selected assets to album (label)\n${options}`);
    if (!input) {
      return;
    }

    const selectedLabel = input.trim().toLowerCase();
    const targetAlbum = albumNodes.find(
      (album) => album.label.trim().toLowerCase() === selectedLabel
    );
    if (!targetAlbum) {
      setUpdateError('Album not found');
      return;
    }

    try {
      await addAssetsToAlbum(targetAlbum.id, {
        assetIds: selectedAssetIdsForAlbumAction
      });
      await loadAssets({ showLoading: false, preserveCachedFirstPage: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to add assets to album');
    }
  }

  async function handleRemoveSelectedFromFocusedAlbum(): Promise<void> {
    if (!focusedAlbumForMembershipAction) {
      return;
    }

    if (selectedAssetsForAlbumMembershipAction.length === 0) {
      setAlbumMembershipNotice({
        kind: 'error',
        message: `Select one or more assets to remove from "${focusedAlbumForMembershipAction.label}".`
      });
      return;
    }

    if (selectedAssetsInFocusedAlbum.length === 0) {
      setAlbumMembershipNotice({
        kind: 'error',
        message: `Nothing removed. None of the selected assets are in "${focusedAlbumForMembershipAction.label}".`
      });
      return;
    }

    const removalCount = selectedAssetsInFocusedAlbum.length;
    const alreadyOutsideCount = selectedAssetsAlreadyOutsideFocusedAlbumCount;
    const confirmed = window.confirm(
      `Remove ${removalCount} selected ${removalCount === 1 ? 'asset' : 'assets'} from "${focusedAlbumForMembershipAction.label}"?` +
        (alreadyOutsideCount > 0
          ? ` ${alreadyOutsideCount} selected ${alreadyOutsideCount === 1 ? 'asset is' : 'assets are'} already outside this album.`
          : '') +
        ' The assets will remain in Tedography.'
    );
    if (!confirmed) {
      return;
    }

    setAlbumMembershipNotice(null);
    setUpdateError(null);

    try {
      await removeAssetsFromAlbum(focusedAlbumForMembershipAction.id, {
        assetIds: selectedAssetIdsForAlbumAction
      });
      const removedAssetIds = new Set(selectedAssetsInFocusedAlbum.map((asset) => asset.id));
      setAssets((previous) =>
        previous.map((asset) =>
          removedAssetIds.has(asset.id)
            ? {
                ...asset,
                albumIds: (asset.albumIds ?? []).filter((albumId) => albumId !== focusedAlbumForMembershipAction.id)
              }
            : asset
        )
      );
      setAlbumMembershipNotice({
        kind: 'success',
        message:
          `Removed ${removalCount} ${removalCount === 1 ? 'asset' : 'assets'} from "${focusedAlbumForMembershipAction.label}".` +
          (alreadyOutsideCount > 0
            ? ` ${alreadyOutsideCount} selected ${alreadyOutsideCount === 1 ? 'asset was' : 'assets were'} already outside that album.`
            : '')
      });
      await loadAssets({ showLoading: false });
    } catch (error: unknown) {
      setAlbumMembershipNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : `Failed to remove assets from "${focusedAlbumForMembershipAction.label}".`
      });
      setUpdateError(error instanceof Error ? error.message : 'Failed to remove assets from album');
    }
  }

  async function handleMoveSelectedAssetsToAlbum(input: {
    destinationAlbumId: string;
    keepInSourceAlbum: boolean;
  }): Promise<void> {
    if (primaryArea === 'Search') {
      if (selectedAssetsForAlbumMembershipAction.length === 0) {
        throw new Error('Select one or more assets first.');
      }

      setAlbumMembershipNotice(null);
      setUpdateError(null);

      const selectedAssets = selectedAssetsForAlbumMembershipAction;
      const selectedAssetIds = selectedAssets.map((asset) => asset.id);
      const updatedAssets = await moveAssetsToAlbumRequest(input.destinationAlbumId, {
        assetIds: selectedAssetIds
      });
      const updatesById = new Map(updatedAssets.map((asset) => [asset.id, asset]));
      setAssets((previous) => previous.map((asset) => updatesById.get(asset.id) ?? asset));
      setSelectedAssetDetails((previous) =>
        previous && updatesById.has(previous.id)
          ? { ...previous, ...(updatesById.get(previous.id) ?? previous) }
          : previous
      );

      const destinationAlbum = albumNodesById.get(input.destinationAlbumId);
      setAlbumMembershipNotice({
        kind: 'success',
        message:
          `Moved ${selectedAssets.length} ${selectedAssets.length === 1 ? 'asset' : 'assets'} to "${destinationAlbum?.label ?? 'the destination album'}".`
      });
      setSelectedAssetIds([]);
      setSelectedAssetId(null);
      setSelectionAnchorAssetId(null);
      return;
    }

    if (!focusedAlbumForMembershipAction) {
      throw new Error('Select a source album first.');
    }

    if (selectedAssetsInFocusedAlbum.length === 0) {
      throw new Error(`Select one or more assets in "${focusedAlbumForMembershipAction.label}".`);
    }

    if (input.destinationAlbumId === focusedAlbumForMembershipAction.id) {
      throw new Error('Destination album must be different from the source album.');
    }

    setAlbumMembershipNotice(null);
    setUpdateError(null);

    if (input.keepInSourceAlbum) {
      await addAssetsToAlbum(input.destinationAlbumId, {
        assetIds: selectedAssetsInFocusedAlbum.map((asset) => asset.id)
      });
    } else {
      const updatedAssets = await moveAssetsToAlbumRequest(input.destinationAlbumId, {
        assetIds: selectedAssetsInFocusedAlbum.map((asset) => asset.id)
      });
      const updatesById = new Map(updatedAssets.map((asset) => [asset.id, asset]));
      setAssets((previous) => previous.map((asset) => updatesById.get(asset.id) ?? asset));
      setSelectedAssetDetails((previous) =>
        previous && updatesById.has(previous.id)
          ? { ...previous, ...(updatesById.get(previous.id) ?? previous) }
          : previous
      );
    }

    const destinationAlbum = albumNodesById.get(input.destinationAlbumId);
    const movedCount = selectedAssetsInFocusedAlbum.length;
    setAlbumMembershipNotice({
      kind: 'success',
      message:
        `${input.keepInSourceAlbum ? 'Added' : 'Moved'} ${movedCount} ${movedCount === 1 ? 'asset' : 'assets'} to "${destinationAlbum?.label ?? 'the destination album'}".` +
        (input.keepInSourceAlbum ? ` They remain in "${focusedAlbumForMembershipAction.label}".` : '')
    });
    if (input.keepInSourceAlbum) {
      await loadAssets({ showLoading: false, preserveCachedFirstPage: false });
    }
    setSelectedAssetIds([]);
    setSelectedAssetId(null);
    setSelectionAnchorAssetId(null);
  }

  function handleFilmstripSelectAsset(assetId: string): void {
    setSelectedAssetId(assetId);
  }

  async function handleReimportSelectedAsset(): Promise<void> {
    if (!selectedAsset) {
      return;
    }

    setAssetMaintenanceBusy('reimport');
    setAssetMaintenanceMessage(null);
    setAssetMaintenanceError(false);

    try {
      const response = await reimportAsset(selectedAsset.id);
      const result = response.results[0];
      if (!result || result.status === 'Error' || result.status === 'SourceMissing') {
        throw new Error(result?.message ?? 'Asset reimport failed');
      }

      setAssetMaintenanceMessage(`Reimported ${selectedAsset.filename}.`);
      await loadAssets({ showLoading: false });
      const refreshedAsset = await loadAssetDetails(selectedAsset.id);
      setSelectedAssetDetails(refreshedAsset);
    } catch (error: unknown) {
      setAssetMaintenanceError(true);
      setAssetMaintenanceMessage(error instanceof Error ? error.message : 'Failed to reimport asset');
    } finally {
      setAssetMaintenanceBusy(null);
    }
  }

  async function handleRebuildDerivedFilesForSelectedAsset(): Promise<void> {
    if (!selectedAsset) {
      return;
    }

    setAssetMaintenanceBusy('rebuild');
    setAssetMaintenanceMessage(null);
    setAssetMaintenanceError(false);

    try {
      const response = await rebuildAssetDerivedFiles(selectedAsset.id);
      const result = response.results[0];
      if (!result || result.status === 'Error' || result.status === 'SourceMissing') {
        throw new Error(result?.message ?? 'Derived rebuild failed');
      }

      setAssetMaintenanceMessage(`Rebuilt derived files for ${selectedAsset.filename}.`);
      await loadAssets({ showLoading: false });
    } catch (error: unknown) {
      setAssetMaintenanceError(true);
      setAssetMaintenanceMessage(
        error instanceof Error ? error.message : 'Failed to rebuild derived files for asset'
      );
    } finally {
      setAssetMaintenanceBusy(null);
    }
  }

  function handleImmersiveActiveImageLoad(loadedAssetId: string): void {
    if (!immersiveOpen && !slideshowActive) {
      return;
    }

    const navigationAssets = immersiveOpen ? immersiveAssets : slideshowAssets;
    const navigationIndex = immersiveOpen ? immersiveSelectedAssetIndex : slideshowSelectedAssetIndex;

    // Guard against stale load events when fast navigation changes the active asset.
    if (!selectedAssetId || loadedAssetId !== selectedAssetId || navigationIndex < 0) {
      return;
    }

    const nextAsset = navigationAssets[navigationIndex + 1];
    const previousAsset = navigationAssets[navigationIndex - 1];

    // Prefetch forward first because next-image navigation is the primary review flow.
    if (nextAsset) {
      prefetchImage(getDisplayMediaUrl(nextAsset.id));
    }

    if (previousAsset) {
      prefetchImage(getDisplayMediaUrl(previousAsset.id));
    }
  }

  function isDiscardKeyboardEvent(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    const code = event.code.toLowerCase();
    return (
      key === 'delete' ||
      key === 'backspace' ||
      code === 'delete' ||
      code === 'backspace' ||
      event.keyCode === 8 ||
      event.keyCode === 46
    );
  }

  async function handleKeyboardReview(shortcutKey: string): Promise<void> {
    const key = shortcutKey.toLowerCase();
    if (key === 'delete' || key === 'backspace') {
      if (selectedAssetIds.length > 0) {
        await handleApplyPhotoStateToSelectedAssets(PhotoState.Discard);
        return;
      }

      if (!selectedAsset || updatingAssetIds[selectedAsset.id] === true) {
        return;
      }

      await handleSetPhotoState(selectedAsset.id, PhotoState.Discard);
      return;
    }

    if (!selectedAsset || updatingAssetIds[selectedAsset.id] === true) {
      return;
    }

    if (key === 's') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Keep);
      return;
    }

    if (key === 'p') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Pending);
      return;
    }

    if (key === 'r') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Discard);
      return;
    }

    if (key === 'u') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.New);
    }
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>, assetId: string): void {
    if (event.shiftKey) {
      const anchorId = selectionAnchorAssetId ?? selectedAssetId ?? assetId;
      const anchorIndex = visibleAssets.findIndex((asset) => asset.id === anchorId);
      const targetIndex = visibleAssets.findIndex((asset) => asset.id === assetId);

      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeSelection = visibleAssets.slice(start, end + 1).map((asset) => asset.id);
        setSelectedAssetIds(rangeSelection);
        setSelectedAssetId(assetId);
        return;
      }
    }

    const isToggleSelection = event.metaKey || event.ctrlKey;

    if (!isToggleSelection) {
      setSelectedAssetId(assetId);
      setSelectedAssetIds([assetId]);
      setSelectionAnchorAssetId(assetId);
      return;
    }

    const alreadySelected = selectedAssetIds.includes(assetId);
    if (!alreadySelected) {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
      setSelectedAssetId(assetId);
      setSelectionAnchorAssetId(assetId);
      return;
    }

    const nextSelectedIds = selectedAssetIds.filter((id) => id !== assetId);
    setSelectedAssetIds(nextSelectedIds);
    setSelectionAnchorAssetId(assetId);

    if (selectedAssetId === assetId) {
      setSelectedAssetId(nextSelectedIds[0] ?? null);
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (
        viewerMode === 'Grid' &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'a' &&
        visibleAssets.length > 0 &&
        selectedAssetId !== null
      ) {
        event.preventDefault();
        setSelectedAssetIds(visibleAssets.map((asset) => asset.id));
        setSelectionAnchorAssetId(selectedAssetId);
        return;
      }

      if (event.key === 'Escape' && albumTreeContextMenu) {
        event.preventDefault();
        closeAlbumTreeContextMenu();
        return;
      }

      if (event.key === 'Escape' && surveyOpen) {
        setSurveyOpen(false);
        return;
      }

      if (event.key === 'Escape' && slideshowActive) {
        event.preventDefault();
        stopSlideshow();
        return;
      }

      if (event.key === 'Escape' && immersiveOpen) {
        closeImmersive();
        return;
      }

      if (event.key === 'Escape' && selectedAssetIds.length > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (visibleAssets.length === 0 || selectedAssetId === null) {
        return;
      }

      if (surveyOpen) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectRelativeInList(compareAssets, 1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectRelativeInList(compareAssets, -1);
        }

        void handleKeyboardReview(event.key);
        return;
      }

      if (slideshowActive) {
        if (event.key === ' ') {
          event.preventDefault();
          toggleSlideshowPlayPause();
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSlideshowRelative(1);
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSlideshowRelative(-1);
          return;
        }

        return;
      }

      if (immersiveOpen) {
        const immersiveNavigationAssets = immersiveAssets;
        if (
          event.key.toLowerCase() === 'u' &&
          compareAssets.length > 0 &&
          compareAssets.some((asset) => asset.id === selectedAssetId)
        ) {
          event.preventDefault();
          handleDeselectCurrentImmersiveSelection();
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectRelativeInList(immersiveNavigationAssets, 1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectRelativeInList(immersiveNavigationAssets, -1);
        }

        if (isDiscardKeyboardEvent(event)) {
          event.preventDefault();
          void handleDiscardDisplayedImmersiveAsset();
          return;
        }

        void handleKeyboardReview(event.key);
        return;
      }

      const primaryNavigationAssets = isLoupeMode ? loupeAssets : visibleAssets;

      if (viewerMode === 'Grid') {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectGridDirectional('right');
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectGridDirectional('left');
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          handleSelectGridDirectional('down');
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          handleSelectGridDirectional('up');
          return;
        }
      } else {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          handleSelectRelativeInList(primaryNavigationAssets, 1);
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          handleSelectRelativeInList(primaryNavigationAssets, -1);
        }
      }

      if (event.key === 'Home') {
        event.preventDefault();
        handleSelectAbsolute('first');
      }

      if (event.key === 'End') {
        event.preventDefault();
        handleSelectAbsolute('last');
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openImmersive();
      }

      void handleKeyboardReview(event.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    albumTreeContextMenu,
    compareAssets,
    immersiveAssets,
    immersiveSelectedAssetIndex,
    loupeAssets,
    visibleAssets,
    isLoupeMode,
    immersiveOpen,
    selectedAsset,
    selectedAssetId,
    slideshowAssets,
    slideshowSelectedAssetIndex,
    slideshowActive,
    selectedAssetIds.length,
    surveyOpen,
    updatingAssetIds,
    viewerMode
  ]);

  useEffect(() => {
    if (!albumTreeContextMenu) {
      return;
    }

    const handlePointerDown = (): void => {
      setAlbumTreeContextMenu(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [albumTreeContextMenu]);

  useEffect(() => {
    if (albumTreeContextMenu && albumTreeContextMenu.nodeId !== selectedTreeNodeId) {
      setAlbumTreeContextMenu(null);
    }
  }, [albumTreeContextMenu, selectedTreeNodeId]);

  useEffect(() => {
    if (!albumTreeContextMenu || !albumTreeContextMenuRef.current) {
      return;
    }

    const repositionMenu = (): void => {
      const menuBounds = albumTreeContextMenuRef.current?.getBoundingClientRect();
      if (!menuBounds) {
        return;
      }

      const maxX = Math.max(
        albumTreeContextMenuViewportPaddingPx,
        window.innerWidth - menuBounds.width - albumTreeContextMenuViewportPaddingPx
      );
      const maxY = Math.max(
        albumTreeContextMenuViewportPaddingPx,
        window.innerHeight - menuBounds.height - albumTreeContextMenuViewportPaddingPx
      );
      const nextX = Math.min(Math.max(albumTreeContextMenu.x, albumTreeContextMenuViewportPaddingPx), maxX);
      const nextY = Math.min(Math.max(albumTreeContextMenu.y, albumTreeContextMenuViewportPaddingPx), maxY);

      if (nextX !== albumTreeContextMenu.x || nextY !== albumTreeContextMenu.y) {
        setAlbumTreeContextMenu((previous) =>
          previous
            ? {
                ...previous,
                x: nextX,
                y: nextY
              }
            : previous
        );
      }
    };

    repositionMenu();
    window.addEventListener('resize', repositionMenu);
    return () => {
      window.removeEventListener('resize', repositionMenu);
    };
  }, [albumTreeContextMenu]);

  useEffect(() => {
    if (viewerMode !== 'Grid') {
      pendingGridRevealAssetIdRef.current = null;
      return;
    }

    const pendingAssetId = pendingGridRevealAssetIdRef.current;
    if (!pendingAssetId || pendingAssetId !== selectedAssetId || !mainColumnRef.current) {
      return;
    }

    const targetNode = mainColumnRef.current.querySelector<HTMLElement>(
      `[data-grid-card="true"][data-asset-id="${pendingAssetId}"]`
    );
    pendingGridRevealAssetIdRef.current = null;
    if (!targetNode) {
      return;
    }

    targetNode.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedAssetId, viewerMode, visibleAssets]);

  function renderActiveContextSummary(): ReactElement | null {
    if (!activeContextSummary) {
      return null;
    }

    const isSmartAlbumContext = activeContextSummary.kind === 'smart-album';

    return (
      <section
        style={isSmartAlbumContext ? smartAlbumContextSummaryStyle : contextSummaryStyle}
        aria-label="Current browsing context"
      >
        <div style={contextSummaryTitleRowStyle}>
          <h2 style={contextSummaryTitleStyle}>{activeContextSummary.title}</h2>
          <span style={isSmartAlbumContext ? smartAlbumContextSummaryBadgeStyle : contextSummaryBadgeStyle}>
            {activeContextSummary.badge}
          </span>
          {isSearchFromSmartAlbum ? (
            <button type="button" style={compareButtonStyle} onClick={clearSearchFilters}>
              Exit Smart Album
            </button>
          ) : null}
        </div>
        <p style={contextSummaryMetaStyle}>{activeContextSummary.meta}</p>
      </section>
    );
  }

  function renderAlbumTreeRows(
    checkedIds: string[],
    onToggleChecked: (albumId: string) => void,
    options?: {
      scrollable?: boolean,
      attachScrollRef?: boolean
    }
  ): ReactElement {
    const useScrollableContainer = options?.scrollable === true;
    const attachScrollRef = options?.attachScrollRef === true;

    return (
      <div
        style={useScrollableContainer ? albumTreeScrollableListStyle : albumTreeListStyle}
        ref={attachScrollRef ? albumTreeListRef : undefined}
      >
        {treeDisplayNodes.length === 0 ? (
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>No tree nodes yet.</p>
        ) : (
          treeDisplayNodes.map((node) => {
            const isGroup = node.nodeType === 'Group';
            const isExpanded = expandedGroupIds.includes(node.id);
            const isChecked = checkedIds.includes(node.id);
            const isSelected = selectedTreeNodeId === node.id;
            const depthIndent = `${node.depth * 10}px`;
            const countStatus = !isGroup
              ? albumAssetCountStatuses.get(node.id) ?? 'loading-indeterminate'
              : null;
            const labelText = isGroup
              ? node.label
              : `${node.label} (${albumAssetCounts.get(node.id) ?? 0})`;
            const titleText = !isGroup && countStatus
              ? `${labelText} • ${getAlbumAssetCountStatusTitle(countStatus, node.label)}`
              : labelText;

            return (
              <div
                key={node.id}
                style={{ ...albumTreeRowStyle, marginLeft: depthIndent }}
                onContextMenu={(event) => handleAlbumTreeNodeContextMenu(event, node)}
              >
                {isGroup ? (
                  <button
                    type="button"
                    style={albumTreeChevronButtonStyle}
                    data-selected={isExpanded ? 'true' : undefined}
                    onClick={() => toggleGroupExpanded(node.id)}
                    aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                    title={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                ) : (
                  <span style={albumTreeSpacerStyle} />
                )}
                <span
                  style={albumTreeCheckboxCellStyle}
                >
                  {!isGroup ? (
                    <input
                      type="checkbox"
                      style={albumTreeShiftedCheckboxStyle}
                      checked={isChecked}
                      onChange={() => onToggleChecked(node.id)}
                      title="Scope to this album"
                    />
                  ) : null}
                </span>
                <button
                  type="button"
                  style={
                    isGroup
                      ? albumTreeLabelButtonStyle
                      : {
                          ...albumTreeLabelButtonStyle,
                          paddingLeft: '10px'
                        }
                  }
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => setSelectedTreeNodeId(node.id)}
                  title={titleText}
                  ref={(element) => {
                    if (element) {
                      albumTreeNodeButtonRefs.current.set(node.id, element);
                    } else {
                      albumTreeNodeButtonRefs.current.delete(node.id);
                    }
                  }}
                >
                  <span style={albumTreeLabelContentStyle}>
                    <span style={albumTreeLabelTextStyle}>{labelText}</span>
                    {!isGroup && countStatus ? (
                      <span
                        style={getAlbumAssetCountStatusBadgeStyle(countStatus)}
                        aria-label={getAlbumAssetCountStatusTitle(countStatus, node.label)}
                      >
                        {getAlbumAssetCountStatusLabel(countStatus)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  function renderSearchGroupTreeRows(): ReactElement {
    const groupDisplayNodes = treeDisplayNodes.filter((node) => node.nodeType === 'Group');

    return (
      <div style={albumTreeListStyle}>
        {groupDisplayNodes.length === 0 ? (
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>No groups yet.</p>
        ) : (
          groupDisplayNodes.map((node) => {
              const isExpanded = expandedGroupIds.includes(node.id);
              const isChecked = searchGroupIds.includes(node.id);
              const isSelected = selectedTreeNodeId === node.id;
              const depthIndent = `${node.depth * 10}px`;

              return (
                <div
                  key={node.id}
                  style={{ ...albumTreeRowStyle, marginLeft: depthIndent }}
                  onContextMenu={(event) => handleAlbumTreeNodeContextMenu(event, node)}
                >
                  <button
                    type="button"
                    style={albumTreeChevronButtonStyle}
                    data-selected={isExpanded ? 'true' : undefined}
                    onClick={() => toggleGroupExpanded(node.id)}
                    aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                    title={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <span style={albumTreeCheckboxCellStyle}>
                    <input
                      type="checkbox"
                      style={albumTreeShiftedCheckboxStyle}
                      checked={isChecked}
                      onChange={() => toggleSearchGroup(node.id)}
                      title="Limit search to descendant albums"
                    />
                  </span>
                  <button
                    type="button"
                    style={albumTreeLabelButtonStyle}
                    data-selected={isSelected ? 'true' : undefined}
                    onClick={() => setSelectedTreeNodeId(node.id)}
                    title={node.label}
                  >
                    <span style={albumTreeLabelContentStyle}>
                      <span style={albumTreeLabelTextStyle}>{node.label}</span>
                    </span>
                  </button>
                </div>
              );
            })
        )}
      </div>
    );
  }

  function renderAlbumTreeContextMenu(): ReactElement | null {
    if (!albumTreeContextMenu) {
      return null;
    }

    const isSelectedGroupMenu = selectedAlbumTreeGroupNode?.id === albumTreeContextMenu.nodeId;
    const isSelectedAlbumMenu = selectedAlbumTreeAlbumNode?.id === albumTreeContextMenu.nodeId;
    if (!isSelectedGroupMenu && !isSelectedAlbumMenu) {
      return null;
    }

    return (
      <div
        ref={albumTreeContextMenuRef}
        style={{
          ...contextMenuStyle,
          left: `${albumTreeContextMenu.x}px`,
          top: `${albumTreeContextMenu.y}px`
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isSelectedGroupMenu ? (
          <>
            <button type="button" style={contextMenuItemStyle} onClick={handleImportAlbumFromSelectedGroup}>
              Import Album
            </button>
            <div
              style={contextMenuSubmenuContainerStyle}
              onPointerEnter={() => setAlbumTreeOrderSubmenuOpen(true)}
              onPointerLeave={() => setAlbumTreeOrderSubmenuOpen(false)}
            >
              <button
                type="button"
                style={contextMenuSubmenuTriggerStyle}
                onClick={() => setAlbumTreeOrderSubmenuOpen((previous) => !previous)}
                title="Choose how albums in this group are ordered"
              >
                <span>Album Order</span>
                <span aria-hidden="true">&gt;</span>
              </button>
              {albumTreeOrderSubmenuOpen ? (
                <div style={contextMenuSubmenuStyle}>
                  <button
                    type="button"
                    style={contextMenuItemStyle}
                    onClick={() => {
                      void handleSetSelectedGroupChildOrderMode('Custom');
                    }}
                    title="Use manual/custom ordering for albums in this group"
                  >
                    {selectedGroupChildOrderMode === 'Custom' ? '✓ ' : ''}Custom Order
                  </button>
                  <button
                    type="button"
                    style={contextMenuItemStyle}
                    onClick={() => {
                      void handleSetSelectedGroupChildOrderMode('Name');
                    }}
                    title="Sort albums in this group alphabetically"
                  >
                    {selectedGroupChildOrderMode === 'Name' ? '✓ ' : ''}Name
                  </button>
                  <button
                    type="button"
                    style={contextMenuItemStyle}
                    onClick={() => {
                      void handleSetSelectedGroupChildOrderMode('NumericThenName');
                    }}
                    title="Sort albums in this group numerically, then alphabetically"
                  >
                    {selectedGroupChildOrderMode === 'NumericThenName' ? '✓ ' : ''}Numeric Then Name
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleCreateGroup();
              }}
            >
              Add Group
            </button>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleCreateAlbum();
              }}
            >
              Add Album
            </button>
            <button type="button" style={contextMenuItemStyle} onClick={openMoveDialogForSelectedTreeNode}>
              Move To...
            </button>
            <button
              type="button"
              style={canMoveSelectedTreeNodeUp ? contextMenuItemStyle : disabledContextMenuItemStyle}
              onClick={() => {
                void handleReorderSelectedTreeNode('up');
              }}
              disabled={!canMoveSelectedTreeNodeUp}
              title={
                !canUseCustomReorderCommands
                  ? 'Available only when these siblings use Custom order'
                  : canMoveSelectedTreeNodeUp
                    ? 'Move earlier among same-type siblings'
                    : 'Already first in custom order'
              }
            >
              Move Up
            </button>
            <button
              type="button"
              style={canMoveSelectedTreeNodeDown ? contextMenuItemStyle : disabledContextMenuItemStyle}
              onClick={() => {
                void handleReorderSelectedTreeNode('down');
              }}
              disabled={!canMoveSelectedTreeNodeDown}
              title={
                !canUseCustomReorderCommands
                  ? 'Available only when these siblings use Custom order'
                  : canMoveSelectedTreeNodeDown
                    ? 'Move later among same-type siblings'
                    : 'Already last in custom order'
              }
            >
              Move Down
            </button>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleRenameSelectedTreeNode();
              }}
            >
              Rename
            </button>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleDeleteSelectedTreeNode();
              }}
            >
              Delete
            </button>
          </>
        ) : null}
        {isSelectedAlbumMenu ? (
          <>
            <button type="button" style={contextMenuItemStyle} onClick={handleImportPhotosIntoSelectedAlbum}>
              Import Photos
            </button>
            <button type="button" style={contextMenuItemStyle} onClick={openMoveDialogForSelectedTreeNode}>
              Move To...
            </button>
            <button
              type="button"
              style={canMoveSelectedTreeNodeUp ? contextMenuItemStyle : disabledContextMenuItemStyle}
              onClick={() => {
                void handleReorderSelectedTreeNode('up');
              }}
              disabled={!canMoveSelectedTreeNodeUp}
              title={
                !canUseCustomReorderCommands
                  ? 'Available only when these siblings use Custom order'
                  : canMoveSelectedTreeNodeUp
                    ? 'Move earlier among same-type siblings'
                    : 'Already first in custom order'
              }
            >
              Move Up
            </button>
            <button
              type="button"
              style={canMoveSelectedTreeNodeDown ? contextMenuItemStyle : disabledContextMenuItemStyle}
              onClick={() => {
                void handleReorderSelectedTreeNode('down');
              }}
              disabled={!canMoveSelectedTreeNodeDown}
              title={
                !canUseCustomReorderCommands
                  ? 'Available only when these siblings use Custom order'
                  : canMoveSelectedTreeNodeDown
                    ? 'Move later among same-type siblings'
                    : 'Already last in custom order'
              }
            >
              Move Down
            </button>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleRenameSelectedTreeNode();
              }}
            >
              Rename
            </button>
            <button
              type="button"
              style={contextMenuItemStyle}
              onClick={() => {
                closeAlbumTreeContextMenu();
                void handleDeleteSelectedTreeNode();
              }}
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    );
  }

  function renderAlbumTreePanel(): ReactElement | null {
    if (isSearchArea) {
      return null;
    }

    if (isReviewArea && !isReviewAlbumsMode) {
      return null;
    }

    const title =
      isReviewArea
        ? `Review Albums (${checkedAlbumIds.length} checked)`
        : isLibraryAlbumsMode
          ? `Albums (${checkedAlbumIds.length} checked)`
          : 'Albums';

    return (
      <section style={albumPanelSectionStyle}>
        <div style={albumPanelHeaderStyle}>
          <h2 style={sidePanelTitleStyle}>{title}</h2>
          <div style={albumPanelUtilityRowStyle}>
            <Tooltip title="Reveal checked albums">
              <span>
                <button
                  type="button"
                  style={
                    checkedAlbumIds.length > 0
                      ? toolbarIconButtonStyle
                      : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                  }
                  onClick={revealCheckedAlbums}
                  disabled={checkedAlbumIds.length === 0}
                  aria-label="Reveal checked albums"
                >
                  <VisibilityIcon sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
            <Tooltip title="Clear checked albums">
              <span>
                <button
                  type="button"
                  style={
                    checkedAlbumIds.length > 0
                      ? toolbarIconButtonStyle
                      : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                  }
                  onClick={clearCheckedAlbums}
                  disabled={checkedAlbumIds.length === 0}
                  aria-label="Clear checked albums"
                >
                  <DeselectIcon sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
            <Tooltip title="Collapse album tree">
              <span>
                <button
                  type="button"
                  style={
                    expandedGroupIds.length > 0
                      ? toolbarIconButtonStyle
                      : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                  }
                  onClick={collapseAllAlbumGroups}
                  disabled={expandedGroupIds.length === 0}
                  aria-label="Collapse album tree"
                >
                  <UnfoldLessIcon sx={{ fontSize: 18 }} />
                </button>
              </span>
            </Tooltip>
            {isLibraryArea ? (
              <Tooltip title="Add top-level group">
                <span>
                  <button
                    type="button"
                    style={
                      canCreateGroupNode
                        ? toolbarIconButtonStyle
                        : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                    }
                    onClick={() => void handleCreateTopLevelGroup()}
                    disabled={!canCreateGroupNode}
                    aria-label="Add top-level group"
                  >
                    <CreateNewFolderIcon sx={{ fontSize: 18 }} />
                  </button>
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {albumTreeLoading ? <p>Loading albums...</p> : null}
        {albumTreeError ? <p>Failed to load album tree: {albumTreeError}</p> : null}
        {!albumTreeLoading
          ? renderAlbumTreeRows(checkedAlbumIds, toggleAlbumChecked, {
              scrollable: true,
              attachScrollRef: true
            })
          : null}
      </section>
    );
  }

  function renderVisibilityPanel(): ReactElement | null {
    if (isSearchArea) {
      return null;
    }

    return (
      <section style={sidePanelSectionStyle}>
        <div style={sidePanelHeaderStyle}>
          <h2 style={sidePanelTitleStyle}>Visibility</h2>
          <button type="button" style={compareButtonStyle} onClick={clearFilters} disabled={!hasActiveFilters}>
            Reset
          </button>
        </div>
        <div style={photoStateSummaryListStyle}>
          {photoStateFilterOptions.map((option) => (
            <label key={option} style={photoStateSummaryRowStyle} title={`Show ${option}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={currentAreaPhotoStates.includes(option)}
                  onChange={() => toggleCurrentAreaPhotoState(option)}
                />
                <span>{option}</span>
              </span>
              <span style={photoStateCountBadgeStyle}>{photoStateSummaryCounts.get(option) ?? 0}</span>
            </label>
          ))}
        </div>
      </section>
    );
  }

  function renderSearchFiltersPanel(): ReactElement | null {
    if (!isSearchArea) {
      return null;
    }

    return (
      <section style={sidePanelSectionStyle}>
        <div style={sidePanelHeaderStyle}>
          <h2 style={sidePanelTitleStyle}>Search</h2>
          <button
            type="button"
            style={compareButtonStyle}
            onClick={clearSearchFilters}
            disabled={!hasActiveSearchFilters && !hasAppliedSearch}
          >
            Reset
          </button>
        </div>
        <div style={{ ...filterRowStyle, marginTop: '8px' }}>
          <button
            type="button"
            style={hasPendingSearchChanges ? primarySearchButtonStyle : disabledToolbarActionButtonStyle}
            onClick={applyPendingSearchFilters}
            disabled={!hasPendingSearchChanges}
          >
            Search
          </button>
          {hasPendingSearchChanges ? (
            <span style={{ color: '#5f6b78', fontSize: '12px' }}>
              {hasAppliedSearch
                ? 'Search criteria changed. Click Search to update results.'
                : 'Set search criteria and click Search.'}
            </span>
          ) : hasAppliedSearch ? (
            <span style={{ color: '#5f6b78', fontSize: '12px' }}>Search results are current.</span>
          ) : (
            <span style={{ color: '#5f6b78', fontSize: '12px' }}>Set search criteria and click Search.</span>
          )}
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>Smart Album</h3>
          <div style={{ fontSize: '12px', color: '#5f6b78' }}>
            Save a reusable derived view from the current Search filters. This first slice supports one keyword, one photo state, and one year group.
          </div>
          {isSearchFromSmartAlbum && activeSmartAlbum ? (
            <div style={{ ...searchPeopleChipRowStyle, marginTop: '8px' }}>
              <div style={smartAlbumChipStyle}>
                {isActiveSmartAlbumView && !hasPendingSearchChanges
                  ? `Smart Album: ${activeSmartAlbum.label}`
                  : `Search from Smart Album: ${activeSmartAlbum.label}`}
              </div>
              {hasPendingSearchChanges ? (
                <span style={{ color: '#7a5c00', fontSize: '12px' }}>Pending changes</span>
              ) : hasDivergedSmartAlbumSearch ? (
                <span style={{ color: '#7a5c00', fontSize: '12px' }}>Filters diverged</span>
              ) : null}
              <button
                type="button"
                style={compareButtonStyle}
                onClick={clearSearchFilters}
              >
                Exit Smart Album
              </button>
            </div>
          ) : null}
          <div style={{ ...filterRowStyle, marginTop: '8px' }}>
            <label style={{ ...filterOptionLabelStyle, display: 'grid', gap: '4px', width: '100%' }}>
              Save current Search as
              <input
                type="text"
                value={smartAlbumSaveLabel}
                onChange={(event) => setSmartAlbumSaveLabel(event.target.value)}
                placeholder="Smart Album label"
                style={{ minWidth: 0 }}
              />
            </label>
          </div>
          <div style={filterRowStyle}>
            <button
              type="button"
              style={canSaveCurrentSearchAsSmartAlbum ? compareButtonStyle : disabledToolbarActionButtonStyle}
              disabled={!canSaveCurrentSearchAsSmartAlbum}
              onClick={() => void handleSaveCurrentSearchAsSmartAlbum()}
            >
              {smartAlbumSaveBusy ? 'Saving...' : 'Save as Smart Album'}
            </button>
          </div>
          {hasPendingSearchChanges ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
              Run Search before saving a Smart Album.
            </p>
          ) : hasUnsupportedActiveSearchFiltersForSmartAlbums ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
              Current Search uses filters that Smart Albums do not support yet. Clear albums, date, filename, or people filters to save this view.
            </p>
          ) : appliedSearchSmartAlbumFilterSpec === null ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
              Choose at least one supported filter before saving a Smart Album.
            </p>
          ) : null}
          {smartAlbumSaveError ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{smartAlbumSaveError}</p>
          ) : null}
          {smartAlbumSaveNotice ? (
            <p style={{ margin: 0, color: '#2f6f3e', fontSize: '12px' }}>{smartAlbumSaveNotice}</p>
          ) : null}
          {smartAlbumsLoading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Refreshing Smart Albums...</p>
          ) : null}
          {smartAlbumsError && smartAlbums.length === 0 ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>
              Failed to refresh Smart Albums: {smartAlbumsError}
            </p>
          ) : null}
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>Keyword</h3>
          <div style={{ fontSize: '12px', color: '#5f6b78' }}>
            Find photos tagged with one keyword across the whole library. Parent keywords include their descendants.
          </div>
          <div style={filterRowStyle}>
            <Autocomplete
              options={filteredSearchKeywordOptions}
              value={selectedSearchKeyword}
              inputValue={searchKeywordQuery}
              onInputChange={(_event, value) => setSearchKeywordQuery(value)}
              onChange={(_event, value) => {
                setSearchKeywordId(value?.id ?? null);
                setSearchKeywordQuery(
                  value ? formatKeywordPathLabel(value, keywordsById) : ''
                );
              }}
              getOptionLabel={(option) => formatKeywordPathLabel(option, keywordsById)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={keywordsLoading}
              style={{ minWidth: 0, width: '100%' }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Keyword"
                  placeholder="Find keyword"
                  error={Boolean(keywordsError)}
                  helperText={keywordsError ?? undefined}
                />
              )}
            />
          </div>
          {selectedSearchKeyword ? (
            <div style={searchPeopleChipRowStyle}>
              <button
                type="button"
                style={searchPeopleChipStyle}
                onClick={() => {
                  setSearchKeywordId(null);
                  setSearchKeywordQuery('');
                }}
                title={`Remove keyword filter ${selectedSearchKeyword.label}`}
              >
                Keyword: {formatKeywordPathLabel(selectedSearchKeyword, keywordsById)} ×
              </button>
            </div>
          ) : null}
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>Photo State</h3>
          <div style={filterRowStyle}>
            <div style={filterGroupStyle}>
              {photoStateFilterOptions.map((option) => (
                <label key={option} style={filterOptionLabelStyle}>
                  <input
                    type="checkbox"
                    checked={searchPhotoStates.includes(option)}
                    onChange={() => toggleSearchPhotoState(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>Date Range</h3>
          <div style={filterRowStyle}>
            <label style={filterOptionLabelStyle}>
              From
              <input
                type="date"
                value={searchCaptureDateFrom}
                disabled={searchCaptureDateAvailability === 'undatedOnly'}
                onChange={(event) => setSearchCaptureDateFrom(event.target.value)}
              />
            </label>
            <label style={filterOptionLabelStyle}>
              To
              <input
                type="date"
                value={searchCaptureDateTo}
                disabled={searchCaptureDateAvailability === 'undatedOnly'}
                onChange={(event) => setSearchCaptureDateTo(event.target.value)}
              />
            </label>
            {(searchCaptureDateFrom || searchCaptureDateTo) && (
              <button
                onClick={() => {
                  setSearchCaptureDateFrom('');
                  setSearchCaptureDateTo('');
                }}
                style={{ alignSelf: 'flex-end', fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}
                title="Clear date range"
              >
                Clear
              </button>
            )}
          </div>
          <div style={filterRowStyle}>
            <label style={filterOptionLabelStyle}>
              Date availability
              <select
                value={searchCaptureDateAvailability}
                onChange={(event) =>
                  setSearchCaptureDateAvailability(
                    event.target.value as SearchCaptureDateAvailabilityMode
                  )
                }
                style={compactSelectStyle}
              >
                <option value="datedOnly">Normal</option>
                <option value="datedOrUndated">Include assets with no date</option>
                <option value="undatedOnly">Only assets with no date</option>
              </select>
            </label>
          </div>
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>People</h3>
          <div style={{ fontSize: '12px', color: '#5f6b78' }}>
            People filters match confirmed derived asset people. Reviewable faces are unresolved face detections.
          </div>
          <div style={filterRowStyle}>
            <label style={filterOptionLabelStyle}>
              Match
              <select
                value={searchPeopleMatchMode}
                onChange={(event) => setSearchPeopleMatchMode(event.target.value as SearchPeopleMatchMode)}
                style={compactSelectStyle}
                disabled={searchPeopleIds.length === 0}
              >
                <option value="Any">Any</option>
                <option value="All">All</option>
              </select>
            </label>
          </div>
          <div style={filterRowStyle}>
            <label style={{ ...filterOptionLabelStyle, display: 'grid', gap: '4px', width: '100%' }}>
              Find person
              <input
                type="text"
                value={searchPeopleQuery}
                onChange={(event) => setSearchPeopleQuery(event.target.value)}
                placeholder="Filter people list"
                style={{ minWidth: 0 }}
              />
            </label>
          </div>
          {selectedSearchPeople.length > 0 ? (
            <div style={searchPeopleChipRowStyle}>
              {selectedSearchPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  style={searchPeopleChipStyle}
                  onClick={() => toggleSearchPerson(person.id)}
                  title={`Remove ${person.displayName}`}
                >
                  {person.displayName} ×
                </button>
              ))}
            </div>
          ) : null}
          <div style={filterGroupStyle}>
            {searchPeopleError ? (
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Failed to load people: {searchPeopleError}</p>
            ) : filteredSearchPeopleOptions.length > 0 ? (
              <>
                {searchPeopleLoading ? (
                  <p style={{ margin: 0, color: '#666', fontSize: '12px', width: '100%' }}>
                    Loading full people list...
                  </p>
                ) : null}
                {filteredSearchPeopleOptions.map((person) => (
                  <label key={person.id} style={filterOptionLabelStyle}>
                    <input
                      type="checkbox"
                      checked={searchPeopleIds.includes(person.id)}
                      onChange={() => toggleSearchPerson(person.id)}
                    />
                    {person.displayName}
                  </label>
                ))}
              </>
            ) : availableSearchPeopleOptions.length === 0 ? (
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>No people exist yet.</p>
            ) : (
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>No people match the current text filter.</p>
            )}
          </div>
          <div style={filterRowStyle}>
            <label style={filterOptionLabelStyle}>
              <input
                type="checkbox"
                checked={searchHasNoPeople}
                onChange={(event) => {
                  const nextChecked = event.target.checked;
                  setSearchHasNoPeople(nextChecked);
                  if (nextChecked) {
                    setSearchPeopleIds([]);
                  }
                }}
              />
              Has no confirmed people
            </label>
          </div>
          <div style={filterRowStyle}>
            <label style={filterOptionLabelStyle}>
              <input
                type="checkbox"
                checked={searchHasReviewableFaces}
                onChange={(event) => setSearchHasReviewableFaces(event.target.checked)}
              />
              Has reviewable faces
            </label>
          </div>
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>File Name</h3>
          <div style={filterRowStyle}>
            <label style={{ ...filterOptionLabelStyle, display: 'grid', gap: '4px', width: '100%' }}>
              Pattern
              <input
                type="text"
                value={searchFilenamePattern}
                onChange={(event) => setSearchFilenamePattern(event.target.value)}
                placeholder="Case-insensitive regular expression"
                style={{ minWidth: 0 }}
              />
            </label>
          </div>
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>Albums</h3>
          {albumTreeLoading ? <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading albums...</p> : null}
          {albumTreeError ? <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Failed to load album tree: {albumTreeError}</p> : null}
          {!albumTreeLoading ? renderAlbumTreeRows(searchAlbumIds, toggleSearchAlbum) : null}
        </div>
        <div style={filterSubsectionStyle}>
          <h3 style={filterSubsectionTitleStyle}>
            GROUPS{searchGroupIds.length > 0 ? ` (${searchGroupIds.length} selected)` : ''}
          </h3>
          {albumTreeLoading ? <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading groups...</p> : null}
          {albumTreeError ? <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Failed to load album tree: {albumTreeError}</p> : null}
          {!albumTreeLoading ? renderSearchGroupTreeRows() : null}
        </div>
      </section>
    );
  }

  function renderTimelineNavigationPanel(): ReactElement | null {
    if (!isTimelineGridMode) {
      return null;
    }

    return (
      <section style={sidePanelSectionStyle}>
        <div style={sidePanelHeaderStyle}>
          <h2 style={sidePanelTitleStyle}>Timeline</h2>
        </div>
	          {timelineNavigationYears.map((year) => {
	          const isExpanded = timelineNavExpandedYearKeys.includes(year.key);
          return (
            <section key={year.key} style={{ marginTop: '6px' }}>
              <div style={timelineYearHeaderStyle}>
	                <button
	                  type="button"
	                  style={compareButtonStyle}
	                  data-selected={isExpanded ? 'true' : undefined}
	                  onClick={() => toggleTimelineYearExpanded(year.key)}
	                >
                  {isExpanded ? '▾' : '▸'}
                </button>
                <strong>{year.label}</strong>
              </div>
              {isExpanded
                ? year.months.map((month) => (
	                    <button
	                      key={month.key}
	                      type="button"
	                      style={
	                        activeTimelineMonthKey === month.key
	                          ? activeTimelineMonthButtonStyle
	                          : timelineMonthButtonStyle
	                      }
	                      data-selected={activeTimelineMonthKey === month.key ? 'true' : undefined}
	                      onClick={() => handleJumpToTimelineMonth(month.key)}
	                    >
                      {month.label} ({month.assetCount})
                    </button>
                  ))
                : null}
            </section>
          );
        })}
      </section>
    );
  }

  const toolbarBrowseMode = isReviewArea
    ? reviewBrowseMode
    : isLibraryArea
      ? libraryBrowseMode
      : null;

  function renderLeftPanel(): ReactElement | null {
    if (!leftPanelVisible) {
      return null;
    }

    return (
      <aside style={isAlbumsMode ? leftPanelStyle : sidePanelStyle}>
        {isReviewArea ? (
          <>
            <section style={sidePanelSectionStyle}>
              <div style={sidePanelHeaderStyle}>
                <h2 style={sidePanelTitleStyle}>Review</h2>
              </div>
            </section>
            {renderVisibilityPanel()}
            {renderAlbumTreePanel()}
            {isTimelineGridMode ? renderTimelineNavigationPanel() : null}
          </>
        ) : null}
        {isLibraryArea ? (
          <>
            {renderVisibilityPanel()}
            {isTimelineGridMode ? renderTimelineNavigationPanel() : null}
            {isLibraryAlbumsMode ? renderAlbumTreePanel() : null}
          </>
        ) : null}
        {isSearchArea ? renderSearchFiltersPanel() : null}
      </aside>
    );
  }

  function renderRightPanel(): ReactElement | null {
    if (!showDetailsPanels || immersiveOpen || slideshowActive || surveyOpen) {
      return null;
    }

    return (
      <aside style={rightPanelStyle}>
        <section style={sidePanelSectionStyle}>
          <div style={sidePanelHeaderStyle}>
            <h2 style={sidePanelTitleStyle}>Inspector</h2>
            <button
              type="button"
              style={compareButtonStyle}
              onClick={() => setDetailsPanelsVisible(false)}
              title="Hide inspector"
            >
              Hide
            </button>
          </div>
          <AssetDetailPanel
            asset={selectedAsset}
          />
          <AssetDetailsPanel
            asset={selectedAssetForDetails}
            albumLabels={selectedAssetAlbumLabels}
            albumOrderingModeLabel={selectedAssetAlbumOrderingModeLabel}
            onEditCaptureDate={
              (isReviewArea || isLibraryArea || isSearchArea) && selectedAssetIds.length === 1 && selectedAsset
                ? handleOpenSetCaptureDateDialog
                : undefined
            }
            onReimportAsset={() => void handleReimportSelectedAsset()}
            onRebuildDerivedFiles={() => void handleRebuildDerivedFilesForSelectedAsset()}
            assetOperationBusy={assetMaintenanceBusy !== null}
            assetOperationMessage={assetMaintenanceMessage}
            assetOperationError={assetMaintenanceError}
            peopleStatus={
              isLibraryArea && selectedAssetIds.length === 1 && selectedAsset
                ? {
                    detectionsCount: selectedAssetPeopleStatus?.detections.length ?? 0,
                    reviewableCount:
                      selectedAssetPeopleStatus?.detections.filter((detection) =>
                        detection.matchStatus === 'unmatched' ||
                        detection.matchStatus === 'suggested' ||
                        detection.matchStatus === 'autoMatched'
                      ).length ?? 0,
                    confirmedPeopleNames: (selectedAssetPeopleStatus?.people ?? []).map((person) => person.displayName),
                    loading: selectedAssetPeopleStatusLoading,
                    errorMessage: selectedAssetPeopleStatusError,
                    reviewHref: `/people/review?assetId=${encodeURIComponent(selectedAsset.id)}`,
                    onOpenReview: handleOpenAssetPeopleReviewDialog
                  }
                : null
            }
          />
          <AssetKeywordsPanel
            selectedAssetCount={selectedAssetsForKeywordEditing.length}
            displayedKeywords={displayedKeywordsForSelection}
            allKeywords={keywords}
            recentKeywords={recentKeywords}
            keywordsLoading={keywordsLoading}
            keywordsError={keywordsError}
            updateBusy={keywordUpdateBusy}
            onAddKeywords={handleAddKeywordsToSelectedAssets}
            onRemoveKeyword={handleRemoveKeywordFromSelectedAssets}
          />
        </section>
      </aside>
    );
  }

  return (
    <div style={pageStyle} className="tdg-app">
      <style>{controlStateStyles}</style>
      <div style={topBarsStackStyle}>
        <div style={topBarStyle}>
          <div style={toolbarGroupStyle}>
            <strong style={toolbarTitleStyle}>Tedography</strong>
            <button
              type="button"
              style={toolbarButtonStyle}
              data-selected={primaryArea === 'Review' ? 'true' : undefined}
              onClick={() => setPrimaryArea('Review')}
            >
              Review
            </button>
            <button
              type="button"
              style={toolbarButtonStyle}
              data-selected={primaryArea === 'Library' ? 'true' : undefined}
              onClick={() => setPrimaryArea('Library')}
            >
              Library
            </button>
            <button
              type="button"
              style={toolbarButtonStyle}
              data-selected={primaryArea === 'Search' ? 'true' : undefined}
              onClick={() => setPrimaryArea('Search')}
            >
              Search
            </button>
            <Link to="/people" style={toolbarLinkButtonStyle}>
              People
            </Link>
          </div>

          {(isReviewArea || isLibraryArea) && toolbarBrowseMode ? (
            <div style={toolbarGroupStyle}>
              <button
                type="button"
                style={toolbarButtonStyle}
                data-selected={toolbarBrowseMode === 'Flat' ? 'true' : undefined}
                onClick={() =>
                  isReviewArea ? handleSetReviewBrowseMode('Flat') : handleSetLibraryBrowseMode('Flat')
                }
                title="Flat presentation"
              >
                Flat
              </button>
              <button
                type="button"
                style={toolbarButtonStyle}
                data-selected={toolbarBrowseMode === 'Timeline' ? 'true' : undefined}
                onClick={() =>
                  isReviewArea
                    ? handleSetReviewBrowseMode('Timeline')
                    : handleSetLibraryBrowseMode('Timeline')
                }
                title="Timeline presentation"
              >
                Time
              </button>
              <button
                type="button"
                style={toolbarButtonStyle}
                data-selected={toolbarBrowseMode === 'Albums' ? 'true' : undefined}
                onClick={() =>
                  isReviewArea ? handleSetReviewBrowseMode('Albums') : handleSetLibraryBrowseMode('Albums')
                }
                title="Albums presentation"
              >
                Albums
              </button>
            </div>
          ) : null}

          {isReviewArea ? (
            <div style={toolbarGroupStyle}>
              <label style={toggleOptionLabelStyle} title="Advance to the next asset after a rating change">
                <input
                  type="checkbox"
                  checked={advanceAfterRating}
                  onChange={(event) => setAdvanceAfterRating(event.target.checked)}
                />
                Auto-advance
              </label>
            </div>
          ) : null}

          <div style={toolbarGroupStyle}>
            {showsThumbnailSizeControl ? (
              <div style={menuAnchorStyle} id="tdg-thumbnail-size-root" ref={thumbnailSizeRootRef}>
                <Tooltip title="Thumbnail Size">
                  <span>
                    <button
                      type="button"
                      style={toolbarIconButtonStyle}
                      data-selected={thumbnailSizeMenuOpen ? 'true' : undefined}
                      onClick={() => setThumbnailSizeMenuOpen((previous) => !previous)}
                      aria-label="Thumbnail Size"
                    >
                      <PhotoSizeSelectLargeIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                {thumbnailSizeMenuOpen ? (
                  <div
                    style={{
                      ...optionsMenuStyle,
                      position: 'fixed',
                      top: `${thumbnailSizeMenuPosition.top}px`,
                      right: `${thumbnailSizeMenuPosition.right}px`
                    }}
                  >
                    {timelineZoomLevels.map((level, index) => (
                      <button
                        key={level.label}
                        type="button"
                        style={toolbarButtonStyle}
                        data-selected={timelineZoomLevel === index ? 'true' : undefined}
                        onClick={() => {
                          handleSetTimelineZoomLevel(index);
                          setThumbnailSizeMenuOpen(false);
                        }}
                        title={`Thumbnail size ${level.label}`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {(hasSelectedAssets || focusedAlbumForMembershipAction) ? (
            <div style={toolbarGroupStyle}>
              <button
                type="button"
                style={hasSelectedAssets ? compareButtonStyle : disabledToolbarActionButtonStyle}
                onClick={() => void handleAddSelectedToAlbum()}
                disabled={!hasSelectedAssets}
                title={
                  hasSelectedAssets
                    ? 'Add current selection to a manual album'
                    : 'Select one or more photos to add them to a manual album'
                }
              >
                +Album
              </button>
              {(focusedAlbumForMembershipAction || isSearchArea) ? (
                <button
                  type="button"
                  style={
                    (isSearchArea
                      ? hasSelectedAssets
                      : selectedAssetsInFocusedAlbum.length > 0)
                      ? compareButtonStyle
                      : disabledToolbarActionButtonStyle
                  }
                  onClick={() => setMoveAssetsDialogOpen(true)}
                  disabled={isSearchArea ? !hasSelectedAssets : selectedAssetsInFocusedAlbum.length === 0}
                  title={
                    isSearchArea
                      ? hasSelectedAssets
                        ? 'Move selected search results to a manual album'
                        : 'Select one or more photos to move them to a manual album'
                      : selectedAssetIdsForAlbumAction.length === 0
                        ? `Select one or more photos to move them out of "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}"`
                        : selectedAssetsInFocusedAlbum.length > 0
                          ? `Move selected assets from "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}" to another album`
                          : `None of the selected assets are in "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}"`
                  }
                >
                  Move to Album...
                </button>
              ) : null}
              {focusedAlbumForMembershipAction ? (
                <button
                  type="button"
                  style={
                    selectedAssetsInFocusedAlbum.length > 0
                      ? compareButtonStyle
                      : disabledToolbarActionButtonStyle
                  }
                  onClick={() => void handleRemoveSelectedFromFocusedAlbum()}
                  disabled={selectedAssetsInFocusedAlbum.length === 0}
                  title={
                    selectedAssetIdsForAlbumAction.length === 0
                      ? `Select one or more photos to remove them from "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}"`
                      : selectedAssetsInFocusedAlbum.length > 0
                        ? `Remove selected assets from "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}"`
                        : `None of the selected assets are in "${focusedAlbumForMembershipAction?.label ?? 'the focused album'}"`
                  }
                >
                  {`Remove from "${focusedAlbumForMembershipAction?.label ?? 'Album'}"`}
                </button>
              ) : null}
            </div>
          ) : null}

          {isLibraryArea || isSearchArea ? (
            <div style={toolbarGroupStyle}>
              <button
                type="button"
                style={hasSelectedAssets ? compareButtonStyle : disabledToolbarActionButtonStyle}
                onClick={startSlideshow}
                disabled={!hasSelectedAssets}
                title={
                  hasSelectedAssets
                    ? 'Start slideshow from selected visible assets'
                    : 'Select one or more photos to start a slideshow'
                }
              >
                Slide
              </button>
            </div>
          ) : null}

          {(isLibraryArea || isSearchArea) ? (
            <div style={toolbarGroupStyle}>
              {isLibraryArea ? (
                <button
                  type="button"
                  style={hasSelectedAssets && !peopleRecognitionBusy ? compareButtonStyle : disabledToolbarActionButtonStyle}
                  onClick={() => void handleRunPeopleRecognitionForSelectedAssets()}
                  disabled={!hasSelectedAssets || peopleRecognitionBusy}
                  title={
                    !hasSelectedAssets
                      ? 'Select one or more photos to run people recognition'
                      : peopleRecognitionBusy
                        ? 'Running people recognition for the current selection'
                        : 'Run people recognition for the current selection'
                  }
                >
                  {peopleRecognitionBusy ? 'Running People...' : 'Run People Recognition'}
                </button>
              ) : null}
              <button
                type="button"
                style={currentScopedPeopleScope ? compareButtonStyle : disabledToolbarActionButtonStyle}
                onClick={handleOpenScopedPeopleDialog}
                disabled={!currentScopedPeopleScope}
                title={
                  currentScopedPeopleScope
                    ? `Open scoped people tools for ${currentScopedPeopleScope.scopeSourceLabel.toLowerCase()}`
                    : isLibraryArea
                      ? 'Select one or more assets to use scoped people tools'
                      : 'Adjust Search until there are results to use scoped people tools'
                }
              >
                People Scope
              </button>
            </div>
          ) : null}

          {!isReviewArea ? (
            <div style={toolbarGroupStyle}>
              <button
                type="button"
                style={compareButtonStyle}
                onClick={() => handleOpenImportDialog()}
                title="Import assets"
              >
                Import
              </button>
            </div>
          ) : null}

          <div style={toolbarGroupStyle}>
            <Tooltip title={leftPanelVisible ? 'Hide Left Panel' : 'Show Left Panel'}>
              <span>
                <button
                  type="button"
                  style={toolbarIconButtonStyle}
                  data-selected={leftPanelVisible ? 'true' : undefined}
                  onClick={() => setLeftPanelVisible((previous) => !previous)}
                  aria-label={leftPanelVisible ? 'Hide Left Panel' : 'Show Left Panel'}
                >
                  <ViewSidebarIcon
                    fontSize="inherit"
                    style={{
                      ...toolbarIconContentStyle,
                      transform: leftPanelVisible ? 'none' : 'scaleX(-1)'
                    }}
                  />
                </button>
              </span>
            </Tooltip>
            {(isReviewArea || isLibraryArea || isSearchArea) ? (
              <Tooltip title={detailsPanelsVisible ? 'Hide Inspector' : 'Show Inspector'}>
                <span>
                  <button
                    type="button"
                    style={toolbarIconButtonStyle}
                    data-selected={detailsPanelsVisible ? 'true' : undefined}
                    onClick={() => setDetailsPanelsVisible((previous) => !previous)}
                    aria-label={detailsPanelsVisible ? 'Hide Inspector' : 'Show Inspector'}
                  >
                    <InfoOutlinedIcon fontSize="inherit" style={toolbarIconContentStyle} />
                  </button>
                </span>
              </Tooltip>
            ) : null}
            <div style={menuAnchorStyle} id="tdg-view-options-root" ref={viewOptionsRootRef}>
              <Tooltip title="View Options">
                <span>
                  <button
                    type="button"
                    style={toolbarIconButtonStyle}
                    data-selected={viewOptionsOpen ? 'true' : undefined}
                    onClick={() => setViewOptionsOpen((previous) => !previous)}
                    aria-label="View Options"
                  >
                    <TuneIcon fontSize="inherit" style={toolbarIconContentStyle} />
                  </button>
                </span>
              </Tooltip>
              {viewOptionsOpen ? (
                <div
                  style={{
                    ...optionsMenuStyle,
                    position: 'fixed',
                    top: `${viewOptionsMenuPosition.top}px`,
                    right: `${viewOptionsMenuPosition.right}px`
                  }}
                >
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="checkbox"
                      checked={showFilmstrip}
                      onChange={(event) => setShowFilmstrip(event.target.checked)}
                    />
                    Show filmstrip
                  </label>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="checkbox"
                      checked={showThumbnailPhotoStateBadges}
                      onChange={(event) => setShowThumbnailPhotoStateBadges(event.target.checked)}
                    />
                    Show thumbnail state
                  </label>
                  <span style={filterSubsectionTitleStyle}>Album Layout</span>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="radio"
                      name="album-results-presentation"
                      checked={albumResultsPresentation === 'Merged'}
                      onChange={() => handleSetAlbumResultsPresentation('Merged')}
                    />
                    Merged
                  </label>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="radio"
                      name="album-results-presentation"
                      checked={albumResultsPresentation === 'GroupedByAlbum'}
                      onChange={() => handleSetAlbumResultsPresentation('GroupedByAlbum')}
                    />
                    Grouped
                  </label>
                  <span style={filterSubsectionTitleStyle}>Album Tree Sort</span>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="radio"
                      name="album-tree-sort-mode"
                      checked={albumTreeSortMode === 'Custom'}
                      onChange={() => setAlbumTreeSortMode('Custom')}
                    />
                    Custom
                  </label>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="radio"
                      name="album-tree-sort-mode"
                      checked={albumTreeSortMode === 'Name'}
                      onChange={() => setAlbumTreeSortMode('Name')}
                    />
                    Name
                  </label>
                  <label style={toggleOptionLabelStyle}>
                    <input
                      type="radio"
                      name="album-tree-sort-mode"
                      checked={albumTreeSortMode === 'Month/Name'}
                      onChange={() => setAlbumTreeSortMode('Month/Name')}
                    />
                    Month/Name
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div style={topBarSpacerStyle} />

          <div style={toolbarTrailingGroupStyle}>
            <div style={menuAnchorStyle} id="tdg-toolbar-overflow-root" ref={toolbarOverflowRootRef}>
              <Tooltip title="More">
                <span>
                  <button
                    type="button"
                    style={toolbarIconButtonStyle}
                    data-selected={toolbarOverflowOpen ? 'true' : undefined}
                    onClick={() => setToolbarOverflowOpen((previous) => !previous)}
                    aria-label="More"
                  >
                    <MoreHorizIcon fontSize="inherit" style={toolbarIconContentStyle} />
                  </button>
                </span>
              </Tooltip>
              {toolbarOverflowOpen ? (
                <div
                  style={{
                    ...optionsMenuStyle,
                    position: 'fixed',
                    top: `${toolbarOverflowMenuPosition.top}px`,
                    right: `${toolbarOverflowMenuPosition.right}px`
                  }}
                >
                  <Link
                    to="/people/dev"
                    style={toolbarLinkButtonStyle}
                    onClick={() => setToolbarOverflowOpen(false)}
                  >
                    People Dev
                  </Link>
                  <button
                    type="button"
                    style={toolbarButtonStyle}
                    onClick={() => {
                      setToolbarOverflowOpen(false);
                      setMaintenanceDialogOpen(true);
                    }}
                    title="Open maintenance tools"
                  >
                    Maintenance
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={secondaryBarStyle}>
          <div style={secondaryBarGroupStyle}>
            {hasSelectedAssets ? (
              <>
                <div style={selectionChipStyle}>
                  <span>{selectionCount} selected</span>
                </div>
                <button
                  type="button"
                  style={compareButtonStyle}
                  onClick={clearSelection}
                  title="Deselect all (Esc)"
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>

          <div style={secondaryBarGroupStyle}>
            {(isReviewArea || isLibraryArea) ? (
              reviewActions.map((state) => (
                <button
                  key={state}
                  type="button"
                  style={hasSelectedAssets ? compareButtonStyle : disabledToolbarActionButtonStyle}
                  onClick={() => void handleApplyPhotoStateToSelectedAssets(state)}
                  disabled={!hasSelectedAssets}
                  title={
                    hasSelectedAssets
                      ? `Apply ${state} to the current selection`
                      : `Select one or more photos to apply ${state}`
                  }
                >
                  {state}
                </button>
              ))
            ) : null}
          </div>

          <div style={secondaryBarGroupStyle}>
            {(isReviewArea || isLibraryArea || isSearchArea) ? (
              <button
                type="button"
                style={hasSelectedAssets ? compareButtonStyle : disabledToolbarActionButtonStyle}
                onClick={handleOpenSetCaptureDateDialog}
                disabled={!hasSelectedAssets}
                title={
                  hasSelectedAssets
                    ? 'Set or clear capture date/time for the current selection'
                    : 'Select one or more photos to set capture date/time'
                }
              >
                Set Capture Date...
              </button>
            ) : null}
          </div>

          <div style={secondaryBarGroupStyle}>
            {(isReviewArea || isLibraryArea) && isAlbumsMode ? (
              <>
                {canToggleSelectedAssetOrderingModeInCurrentAlbum ? (
                  <button
                    type="button"
                    style={compareButtonStyle}
                    onClick={() =>
                      void handleSetSelectedAssetAlbumOrderingMode(
                        selectedAssetAlbumOrderingMode === 'capture-time'
                      )
                    }
                    title={
                      selectedAssetAlbumOrderingMode === 'manual'
                        ? 'Use capture-time ordering for the selected photo in this album'
                        : 'Force the selected photo to use manual ordering in this album'
                    }
                  >
                    {selectedAssetAlbumOrderingMode === 'manual'
                      ? 'Use Capture Time'
                      : 'Use Manual Order'}
                  </button>
                ) : null}
                <Tooltip
                  title={
                    canMoveCurrentAlbumSelectionToTop
                      ? 'Move selected manually ordered album photo to the start of the manual section'
                      : 'Select one manually ordered photo in a single checked album to reorder it'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={
                        canMoveCurrentAlbumSelectionToTop
                          ? toolbarIconButtonStyle
                          : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                      }
                      onClick={() => void handleMoveSelectedAssetWithinAlbum('top')}
                      disabled={!canMoveCurrentAlbumSelectionToTop}
                      aria-label="Move selected album photo to top"
                    >
                      <VerticalAlignTopIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    canMoveCurrentAlbumSelectionUp
                      ? 'Move selected manually ordered album photo up'
                      : 'Select one manually ordered photo in a single checked album to reorder it'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={
                        canMoveCurrentAlbumSelectionUp
                          ? toolbarIconButtonStyle
                          : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                      }
                      onClick={() => void handleMoveSelectedAssetWithinAlbum('up')}
                      disabled={!canMoveCurrentAlbumSelectionUp}
                      aria-label="Move selected album photo up"
                    >
                      <ArrowUpwardIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    canMoveCurrentAlbumSelectionDown
                      ? 'Move selected manually ordered album photo down'
                      : 'Select one manually ordered photo in a single checked album to reorder it'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={
                        canMoveCurrentAlbumSelectionDown
                          ? toolbarIconButtonStyle
                          : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                      }
                      onClick={() => void handleMoveSelectedAssetWithinAlbum('down')}
                      disabled={!canMoveCurrentAlbumSelectionDown}
                      aria-label="Move selected album photo down"
                    >
                      <ArrowDownwardIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    canMoveCurrentAlbumSelectionToBottom
                      ? 'Move selected manually ordered album photo to the end of the manual section'
                      : 'Select one manually ordered photo in a single checked album to reorder it'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={
                        canMoveCurrentAlbumSelectionToBottom
                          ? toolbarIconButtonStyle
                          : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                      }
                      onClick={() => void handleMoveSelectedAssetWithinAlbum('bottom')}
                      disabled={!canMoveCurrentAlbumSelectionToBottom}
                      aria-label="Move selected album photo to bottom"
                    >
                      <VerticalAlignBottomIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
              </>
            ) : null}
          </div>

          <div style={secondaryBarGroupStyle}>
            {(isReviewArea || isLibraryArea || isSearchArea) ? (
              <>
                <Tooltip title={hasSelectedAssets ? 'Rotate selected photos counterclockwise' : 'Select one or more photos to rotate'}>
                  <span>
                    <button
                      type="button"
                      style={hasSelectedAssets ? toolbarIconButtonStyle : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }}
                      onClick={() => void handleRotateSelectedAssets('counterclockwise')}
                      disabled={!hasSelectedAssets}
                      aria-label="Rotate selected photos counterclockwise"
                    >
                      <RotateLeftIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip title={hasSelectedAssets ? 'Rotate selected photos 180°' : 'Select one or more photos to rotate'}>
                  <span>
                    <button
                      type="button"
                      style={hasSelectedAssets ? { ...toolbarIconButtonStyle, fontSize: '11px', fontWeight: 'bold' } : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle, fontSize: '11px', fontWeight: 'bold' }}
                      onClick={() => void handleRotateSelectedAssets('180')}
                      disabled={!hasSelectedAssets}
                      aria-label="Rotate selected photos 180 degrees"
                    >
                      180°
                    </button>
                  </span>
                </Tooltip>
                <Tooltip title={hasSelectedAssets ? 'Rotate selected photos clockwise' : 'Select one or more photos to rotate'}>
                  <span>
                    <button
                      type="button"
                      style={hasSelectedAssets ? toolbarIconButtonStyle : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }}
                      onClick={() => void handleRotateSelectedAssets('clockwise')}
                      disabled={!hasSelectedAssets}
                      aria-label="Rotate selected photos clockwise"
                    >
                      <RotateRightIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
              </>
            ) : null}
          </div>

          <div style={secondaryBarGroupStyle}>
            {(isReviewArea || isLibraryArea || isSearchArea) ? (
              <>
                <Tooltip title="Grid">
                  <span>
                    <button
                      type="button"
                      style={toolbarIconButtonStyle}
                      data-selected={viewerMode === 'Grid' ? 'true' : undefined}
                      onClick={() => setViewerMode('Grid')}
                      aria-label="Grid"
                    >
                      <GridViewIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip title="Loupe">
                  <span>
                    <button
                      type="button"
                      style={selectedAsset ? toolbarIconButtonStyle : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }}
                      data-selected={viewerMode === 'Loupe' ? 'true' : undefined}
                      onClick={() => setViewerMode('Loupe')}
                      disabled={!selectedAsset}
                      aria-label="Loupe"
                    >
                      <ImageSearchIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    compareAssets.length >= 2
                      ? 'Survey'
                      : 'Select two or more visible photos to enter Survey'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={
                        compareAssets.length >= 2
                          ? toolbarIconButtonStyle
                          : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }
                      }
                      data-selected={surveyOpen ? 'true' : undefined}
                      onClick={openSurveyMode}
                      disabled={compareAssets.length < 2}
                      aria-label="Survey"
                    >
                      <DashboardCustomizeIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    selectedAsset
                      ? 'Full Screen'
                      : 'Select a photo to open full screen'
                  }
                >
                  <span>
                    <button
                      type="button"
                      style={selectedAsset ? toolbarIconButtonStyle : { ...toolbarIconButtonStyle, ...disabledToolbarActionButtonStyle }}
                      data-selected={immersiveOpen ? 'true' : undefined}
                      onClick={openImmersive}
                      disabled={!selectedAsset}
                      aria-label="Full Screen"
                    >
                      <FullscreenIcon fontSize="inherit" style={toolbarIconContentStyle} />
                    </button>
                  </span>
                </Tooltip>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div style={shellViewportStyle}>
        <div
          style={
            leftPanelVisible
              ? showDetailsPanels && !immersiveOpen && !slideshowActive && !surveyOpen
                ? shellLayoutStyle
                : shellLayoutNoRightStyle
              : showDetailsPanels && !immersiveOpen && !slideshowActive && !surveyOpen
                ? shellLayoutNoLeftStyle
                : shellLayoutMainOnlyStyle
          }
        >
          {renderLeftPanel()}

        <main
          ref={mainColumnRef}
          style={isLoupeMode ? loupeMainColumnStyle : isSearchArea ? searchMainColumnStyle : mainColumnStyle}
        >
          {!isLoupeMode ? (
            activeContextSummary ? (
              renderActiveContextSummary()
            ) : (
              <p style={{ color: '#666', fontSize: '12px', margin: '0 0 8px 0' }}>
                {mainPaneDescription}
              </p>
            )
          ) : null}

      {assetsLoading ? <p>Loading assets...</p> : null}
      {assetsError ? <p>Failed to load assets: {assetsError}</p> : null}
      {updateError ? <p>{updateError}</p> : null}
      {albumMembershipNotice ? (
        <p
          style={{
            color: albumMembershipNotice.kind === 'error' ? '#b00020' : '#136f2d',
            fontSize: '12px',
            margin: '0 0 8px 0'
          }}
        >
          {albumMembershipNotice.message}
        </p>
      ) : null}
      {peopleRecognitionNotice ? (
        <div
          style={{
            color: peopleRecognitionNotice.kind === 'error' ? '#b00020' : '#136f2d',
            fontSize: '12px',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <span>{peopleRecognitionNotice.message}</span>
          {peopleRecognitionNotice.reviewAssetId ? (
            <Link
              to={`/people/review?assetId=${encodeURIComponent(peopleRecognitionNotice.reviewAssetId)}`}
              style={{ ...compareButtonStyle, textDecoration: 'none', padding: '4px 8px' }}
            >
              Review Faces
            </Link>
          ) : null}
        </div>
      ) : null}
      {!assetsLoading && !assetsError ? (
        hasNoAssets ? (
          <section style={emptyStateStyle}>
            <h2 style={emptyStateHeadingStyle}>No media assets yet</h2>
            <p style={emptyStateTextStyle}>
              Import photos to start reviewing and organizing your archive.
            </p>
            <button
              type="button"
              style={compareButtonStyle}
              onClick={() => handleOpenImportDialog()}
            >
              Import Assets
            </button>
          </section>
        ) : isSearchArea && !hasAppliedSearch ? (
          <section style={emptyStateStyle}>
            <h2 style={emptyStateHeadingStyle}>Ready to search</h2>
            <p style={emptyStateTextStyle}>Set search criteria and click Search.</p>
          </section>
        ) : hasFilteredAssets ? (
          <>
            <div style={isSearchArea && !isLoupeMode ? stickySearchAssetChromeStyle : stickyAssetChromeStyle}>
              {isSearchArea && !isLoupeMode ? (
                <div style={stickySearchSummaryBlockStyle}>
                  {activeContextSummary ? (
                    <div style={contextSummaryTitleRowStyle}>
                      <strong style={{ fontSize: '13px' }}>{activeContextSummary.title}</strong>
                      <span
                        style={
                          activeContextSummary.kind === 'smart-album'
                            ? smartAlbumContextSummaryBadgeStyle
                            : contextSummaryBadgeStyle
                        }
                      >
                        {activeContextSummary.badge}
                      </span>
                      <span style={{ color: '#666', fontSize: '13px' }}>
                        {visibleAssets.length} results
                      </span>
                    </div>
                  ) : (
                    <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                      {visibleAssets.length} results
                    </p>
                  )}
                  {hasPendingSearchChanges ? (
                    <p style={{ color: '#7a5c00', fontSize: '12px', margin: '6px 0 0 0' }}>
                      Search criteria changed. Click Search to update results.
                    </p>
                  ) : null}
                  {isSearchFromSmartAlbum && activeSmartAlbum ? (
                    <div style={{ ...searchPeopleChipRowStyle, marginTop: '8px' }}>
                      <div style={smartAlbumChipStyle}>
                        {isActiveSmartAlbumView && !hasPendingSearchChanges
                          ? `Smart Album: ${activeSmartAlbum.label}`
                          : `Search from Smart Album: ${activeSmartAlbum.label}`}
                      </div>
                      {hasPendingSearchChanges ? (
                        <span style={{ color: '#7a5c00', fontSize: '12px' }}>Pending changes</span>
                      ) : hasDivergedSmartAlbumSearch ? (
                        <span style={{ color: '#7a5c00', fontSize: '12px' }}>Filters diverged</span>
                      ) : null}
                      <button
                        type="button"
                        style={compareButtonStyle}
                        onClick={clearSearchFilters}
                      >
                        Exit Smart Album
                      </button>
                    </div>
                  ) : null}
                  {appliedSearchKeyword ? (
                    <div style={{ ...searchPeopleChipRowStyle, marginTop: '8px' }}>
                      <div style={selectionChipStyle}>
                        Keyword: {formatKeywordPathLabel(appliedSearchKeyword, keywordsById)}
                      </div>
                      <button
                        type="button"
                        style={compareButtonStyle}
                        onClick={() => {
                          setSearchKeywordId(null);
                          setSearchKeywordQuery('');
                        }}
                      >
                        Clear Keyword
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!immersiveOpen ? (
                <AssetQuickBar
                  asset={selectedAsset}
                  currentIndex={isLoupeMode ? loupeSelectedAssetIndex : selectedAssetIndex}
                  totalCount={isLoupeMode ? loupeAssets.length : visibleAssets.length}
                  compact={isLoupeMode}
                />
              ) : null}
              {showFilmstrip ? (
                <AssetFilmstrip
                  assets={isLoupeMode ? loupeAssets : visibleAssets}
                  activeAssetId={selectedAssetId}
                  onSelectAsset={handleFilmstripSelectAsset}
                />
              ) : null}
            </div>
            {isLoupeMode && selectedAsset ? (
              <LoupeViewer
                asset={selectedAsset}
                onOpenImmersive={openImmersiveForAsset}
              />
            ) : null}
            {!isLoupeMode && isTimelineGridMode ? (
              <div style={timelineLayoutStyle}>
                {timelineMonthGroups.map((group) => (
                  <section
                    key={group.key}
                    style={groupSectionStyle}
                    ref={(element) => {
                      timelineSectionRefs.current[group.key] = element;
                    }}
                  >
                    <h3 style={timelineGroupHeaderStyle}>
                      {group.label}
                      <span style={groupMetaStyle}>
                        · {group.assets.length} {group.assets.length === 1 ? 'asset' : 'assets'}
                      </span>
                    </h3>
                    <div style={browseGridStyle}>
                      {group.assets.map((asset) => (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          isSelected={selectedAssetIds.includes(asset.id)}
                          isActive={selectedAssetId === asset.id}
                          isUpdating={updatingAssetIds[asset.id] === true}
                          showPhotoStateBadge={showThumbnailPhotoStateBadges}
                          onCardClick={handleCardClick}
                          onCardDoubleClick={openImmersiveForAsset}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : !isLoupeMode && (isGroupedAlbumsPresentation || isReviewAlbumsMode) ? (
              <>
                {checkedAlbumSections.map((section) => (
                  <section key={section.albumId} style={groupSectionStyle}>
                    <h3 style={groupHeaderStyle}>
                      {section.albumLabel}
                      <span style={groupMetaStyle}>
                        · {section.assets.length} {section.assets.length === 1 ? 'asset' : 'assets'}
                      </span>
                    </h3>
                    <div style={browseGridStyle}>
                      {section.assets.map((asset) => (
                        <AssetCard
                          key={`${section.albumId}-${asset.id}`}
                          asset={asset}
                          isSelected={selectedAssetIds.includes(asset.id)}
                          isActive={selectedAssetId === asset.id}
                          isUpdating={updatingAssetIds[asset.id] === true}
                          showPhotoStateBadge={showThumbnailPhotoStateBadges}
                          onCardClick={handleCardClick}
                          onCardDoubleClick={openImmersiveForAsset}
                        />
                      ))}
                    </div>
                  </section>
                  ))}
                </>
            ) : !isLoupeMode ? (
              <div style={browseGridStyle}>
                {visibleAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    isActive={selectedAssetId === asset.id}
                    isUpdating={updatingAssetIds[asset.id] === true}
                    showPhotoStateBadge={showThumbnailPhotoStateBadges}
                    onCardClick={handleCardClick}
                    onCardDoubleClick={openImmersiveForAsset}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {isReviewAlbumsMode && !hasCheckedAlbums ? (
              <p>Check one or more albums to review their photos.</p>
            ) : isReviewAlbumsMode && !hasAssetsInCheckedAlbumsInAreaScope ? (
              <p>No photos in the checked albums match the current review visibility.</p>
            ) : isReviewAlbumsMode && !hasFilteredAssets ? (
              <p>No photos in the checked albums match the current filters.</p>
            ) : isLibraryAlbumsMode && !hasCheckedAlbums ? (
              <p>Check one or more albums to browse their photos.</p>
            ) : isLibraryAlbumsMode && !hasAssetsInCheckedAlbumsInAreaScope ? (
              <p>The checked albums contain no selected photos yet.</p>
            ) : isLibraryAlbumsMode && !hasAssetsInCheckedAlbumsAfterFilters ? (
              <p>No photos in the checked albums match the current filters.</p>
            ) : isSearchArea ? (
              <>
                <p>
                  {isActiveSmartAlbumView && activeSmartAlbum
                    ? `No photos found for Smart Album "${activeSmartAlbum.label}".`
                    : hasDivergedSmartAlbumSearch && activeSmartAlbum
                    ? `No photos found for Search from Smart Album "${activeSmartAlbum.label}".`
                    : appliedSearchKeyword
                    ? `No photos found for keyword "${formatKeywordPathLabel(appliedSearchKeyword, keywordsById)}"${
                        hasAdditionalAppliedSearchFiltersBesidesKeyword ? ' with the current search filters.' : '.'
                      }`
                    : 'No photos match the current search filters.'}
                </p>
                {hasPendingSearchChanges ? (
                  <p style={{ color: '#7a5c00', fontSize: '12px', margin: '0 0 8px 0' }}>
                    Search criteria changed. Click Search to update results.
                  </p>
                ) : null}
              </>
            ) : primaryArea === 'Review' && !hasAreaScopedAssets ? (
              <p>No photos need review right now. Switch to Library to browse selected photos.</p>
            ) : primaryArea === 'Library' && !hasAreaScopedAssets ? (
              <p>No selected photos in the library yet. Mark photos as Keep in Review.</p>
            ) : (
              <p>No visible assets match the current filters.</p>
            )}
            {!isSearchArea && hasActiveFilters ? (
              <div style={actionsStyle}>
                <button type="button" style={compareButtonStyle} onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : null}
            {isSearchArea && (hasActiveSearchFilters || hasAppliedSearch) ? (
              <div style={actionsStyle}>
                <button type="button" style={compareButtonStyle} onClick={clearSearchFilters}>
                  Clear Filters
                </button>
              </div>
            ) : null}
            {isLibraryAlbumsMode ? (
              <div style={actionsStyle}>
                <button
                  type="button"
                  style={compareButtonStyle}
                  onClick={() => setLibraryBrowseMode('Flat')}
                >
                  Switch to Flat
                </button>
                <button
                  type="button"
                  style={compareButtonStyle}
                  onClick={() => setLibraryBrowseMode('Timeline')}
                >
                  Switch to Timeline
                </button>
              </div>
            ) : null}
          </>
        )
      ) : null}
        </main>
        {renderRightPanel()}
        </div>
      </div>

      {slideshowActive && selectedAsset ? (
        <SlideshowViewer
          asset={selectedAsset}
          index={slideshowSelectedAssetIndex}
          total={slideshowAssets.length}
          isPlaying={slideshowPlaying}
          onExit={stopSlideshow}
          onPrevious={() => handleSlideshowRelative(-1)}
          onNext={() => handleSlideshowRelative(1)}
          onTogglePlayPause={toggleSlideshowPlayPause}
          onActiveImageLoad={handleImmersiveActiveImageLoad}
        />
      ) : null}

      {immersiveOpen && selectedAsset ? (
        <ImmersiveViewer
          asset={selectedAsset}
          index={immersiveSelectedAssetIndex}
          total={immersiveAssets.length}
          hasPrevious={immersiveSelectedAssetIndex > 0}
          hasNext={
            immersiveSelectedAssetIndex >= 0 &&
            immersiveSelectedAssetIndex < immersiveAssets.length - 1
          }
          onClose={closeImmersive}
          onPrevious={() => handleSelectRelativeInList(immersiveAssets, -1)}
          onNext={() => handleSelectRelativeInList(immersiveAssets, 1)}
          onActiveImageLoad={handleImmersiveActiveImageLoad}
        />
      ) : null}

      {surveyOpen && surveyFocusedAsset ? (
        <SurveyMode
          assets={compareAssets}
          focusedAsset={surveyFocusedAsset}
          focusedIndex={surveyFocusedIndex}
          isUpdating={updatingAssetIds[surveyFocusedAsset.id] === true}
          onClose={() => setSurveyOpen(false)}
          onFocusAsset={setSelectedAssetId}
          onOpenImmersiveAsset={openImmersiveForAsset}
          onSetPhotoState={handleSetPhotoState}
        />
      ) : null}

      {renderAlbumTreeContextMenu()}

      <MoveAlbumTreeNodeDialog
        open={moveDialogNode !== null}
        nodes={albumTreeNodes}
        nodeToMove={moveDialogNode}
        onClose={() => setMoveDialogNodeId(null)}
        onMove={handleMoveTreeNode}
      />
      <CreateTopLevelGroupDialog
        open={createTopLevelGroupDialogOpen}
        nodes={albumTreeNodes}
        onClose={() => setCreateTopLevelGroupDialogOpen(false)}
        onCreate={handleCreateTopLevelGroupWithPosition}
      />
      <MoveAssetsToAlbumDialog
        open={moveAssetsDialogOpen}
        albums={albumTreeNodes}
        sourceAlbum={isSearchArea ? null : focusedAlbumForMembershipAction}
        selectedAssetCount={isSearchArea ? selectedAssetIdsForAlbumAction.length : selectedAssetsInFocusedAlbum.length}
        onClose={() => setMoveAssetsDialogOpen(false)}
        onMove={handleMoveSelectedAssetsToAlbum}
      />
      <SetCaptureDateDialog
        open={setCaptureDateDialogOpen}
        selectedAssetCount={selectedAssetIds.length}
        initialCaptureDateTime={selectedAssetIds.length === 1 ? selectedAssetForDetails?.captureDateTime ?? null : null}
        onClose={() => setSetCaptureDateDialogOpen(false)}
        onSave={handleUpdateSelectedAssetsCaptureDateTime}
      />

      <ImportAssetsDialog
        open={importDialogOpen}
        initialAlbumDestination={importDialogInitialAlbumDestination}
        onClose={() => {
          setImportDialogOpen(false);
          setImportDialogInitialAlbumDestination(null);
        }}
        onImportCompleted={() => {
          void loadAssets({ showLoading: false, preserveCachedFirstPage: false });
          void loadAlbumTreeNodes({ showLoading: false });
        }}
      />
      <MaintenanceDialog
        open={maintenanceDialogOpen}
        onClose={() => setMaintenanceDialogOpen(false)}
        onMaintenanceCompleted={() => {
          void loadAssets({ showLoading: false });
          void loadAlbumTreeNodes({ showLoading: false });
        }}
        albumTreeNodes={albumTreeNodes}
        onOpenSmartAlbum={(smartAlbum) => {
          applySmartAlbumToSearch(smartAlbum);
          setMaintenanceDialogOpen(false);
        }}
        onSmartAlbumsChanged={() => {
          void loadSmartAlbums({ showLoading: false });
        }}
        onKeywordsChanged={() => {
          void loadKeywords({ showLoading: false });
        }}
      />
      <AssetPeopleReviewDialog
        open={assetPeopleReviewDialogOpen}
        asset={isLibraryArea && selectedAssetIds.length === 1 ? selectedAssetForDetails : null}
        initialState={selectedAssetPeopleStatus}
        onClose={() => setAssetPeopleReviewDialogOpen(false)}
        onUpdated={() =>
          selectedAssetId && isLibraryArea && selectedAssetIds.length === 1
            ? loadSelectedAssetPeopleStatus(selectedAssetId)
            : undefined
        }
      />
      <ScopedPeopleMaintenanceDialog
        open={scopedPeopleDialogOpen}
        scopeType={currentScopedPeopleScope?.scopeType ?? 'No scope'}
        scopeLabel={currentScopedPeopleScope?.scopeLabel ?? 'No scoped people source'}
        scopeSourceLabel={currentScopedPeopleScope?.scopeSourceLabel ?? 'No scope'}
        assetCount={currentScopedPeopleScope?.assetIds.length ?? 0}
        summary={scopedPeopleSummary}
        summaryLoading={scopedPeopleSummaryLoading}
        busyAction={scopedPeopleBusyAction}
        errorMessage={scopedPeopleError}
        noticeMessage={scopedPeopleNotice}
        onClose={() => setScopedPeopleDialogOpen(false)}
        onRunRecognition={() => void runPeopleRecognitionForAssetScope(false)}
        onReprocessRecognition={() => void runPeopleRecognitionForAssetScope(true)}
        onOpenReview={handleOpenScopedPeopleReview}
      />
    </div>
  );
}
