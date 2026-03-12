import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { MediaType, PhotoState, type AlbumTreeNode, type MediaAsset } from '@tedography/domain';
import {
  addAssetsToAlbum,
  createAlbumTreeNode,
  deleteAlbumTreeNode,
  listAlbumTreeNodes,
  removeAssetsFromAlbum,
  renameAlbumTreeNode
} from './api/albumTreeApi';
import { AssetDetailsPanel } from './components/assets/AssetDetailsPanel';
import { AssetFilmstrip } from './components/assets/AssetFilmstrip';
import { AssetQuickBar } from './components/assets/AssetQuickBar';
import { ImportAssetsDialog } from './components/import/ImportAssetsDialog';
import { sortVisibleAssetsForTimeline } from './utilities/groupAssetsByDate';
import { prefetchImage } from './utilities/imagePrefetch';
import {
  buildTimelineNavigationYears,
  groupAssetsByCaptureMonth,
  type TimelineNavigationYear
} from './utilities/libraryTimeline';
import { getDisplayMediaUrl, getThumbnailMediaUrl } from './utilities/mediaUrls';

const photoStateFilterOptions: PhotoState[] = [
  PhotoState.Unreviewed,
  PhotoState.Pending,
  PhotoState.Select,
  PhotoState.Reject
];

const mediaTypeFilterOptions: MediaType[] = [MediaType.Photo, MediaType.Video];
const advanceAfterRatingStorageKey = 'tedography.advanceAfterRating';
const hideRejectStorageKey = 'tedography.hideReject';
const checkedAlbumIdsStorageKey = 'tedography.checkedAlbumIds';
const expandedAlbumTreeGroupIdsStorageKey = 'tedography.expandedAlbumTreeGroupIds';
const albumScopeModeStorageKey = 'tedography.albumScopeMode';
const primaryAreaStorageKey = 'tedography.primaryArea';
const libraryBrowseModeStorageKey = 'tedography.libraryBrowseMode';
const timelineNavExpandedYearKeysStorageKey = 'tedography.timelineNavExpandedYears';

type TedographyPrimaryArea = 'Review' | 'Library' | 'Albums' | 'Search' | 'Maintenance';
type LibraryBrowseMode = 'Flat' | 'Timeline';

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '24px auto',
  maxWidth: '1100px',
  padding: '0 16px'
};

const controlsStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  marginBottom: '10px'
};

const primaryAreaControlsStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  marginBottom: '12px'
};

const filterSectionStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  padding: '10px',
  marginBottom: '14px',
  backgroundColor: '#fafafa'
};

const albumTreeSectionStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  padding: '10px',
  marginBottom: '14px',
  backgroundColor: '#fafafa'
};

const albumTreeListStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  marginTop: '8px'
};

const albumTreeRowStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  alignItems: 'center',
  flexWrap: 'wrap'
};

const filterRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '12px',
  marginTop: '8px'
};

const filterGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px'
};

const filterLabelStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '13px'
};

const filterOptionLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '13px'
};

const toggleOptionLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px'
};

const secondaryToggleOptionLabelStyle: CSSProperties = {
  ...toggleOptionLabelStyle,
  opacity: 0.65
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
};

const groupSectionStyle: CSSProperties = {
  marginBottom: '18px'
};

const groupHeaderStyle: CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '16px'
};

const groupMetaStyle: CSSProperties = {
  color: '#666',
  fontSize: '12px',
  marginLeft: '6px'
};

const timelineLayoutStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: '220px 1fr',
  alignItems: 'start'
};

const timelineNavPanelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  backgroundColor: '#fafafa',
  padding: '10px',
  position: 'sticky',
  top: '10px'
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

const cardStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  overflow: 'hidden',
  backgroundColor: '#fff',
  cursor: 'pointer'
};

const selectedCardStyle: CSSProperties = {
  border: '2px solid #1f6feb',
  boxShadow: '0 0 0 2px rgba(31, 111, 235, 0.15)'
};

const thumbnailFrameStyle: CSSProperties = {
  aspectRatio: '4 / 3',
  backgroundColor: '#1f1f1f',
  display: 'flex',
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%'
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

const cardBodyStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '10px'
};

const cardSelectButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1f6feb',
  cursor: 'pointer',
  fontSize: '12px',
  padding: 0,
  textAlign: 'left'
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '8px'
};

const actionButtonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '4px 8px'
};

const detailPanelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '14px',
  marginBottom: '16px',
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
  fontSize: '13px',
  padding: '6px 10px'
};

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
  backgroundColor: 'rgba(0, 0, 0, 0.92)',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px',
  zIndex: 1000
};

const immersiveTopBarStyle: CSSProperties = {
  width: '100%',
  color: '#f5f5f5',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  paddingBottom: '10px'
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const immersiveImageStyle: CSSProperties = {
  width: '100%',
  maxWidth: '96vw',
  maxHeight: '78vh',
  objectFit: 'contain',
  backgroundColor: '#111',
  borderRadius: '8px',
  border: '1px solid #2b2b2b'
};

const immersiveBottomHintStyle: CSSProperties = {
  color: '#a9a9a9',
  fontSize: '12px',
  marginTop: '8px'
};

const surveyOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.88)',
  padding: '16px',
  zIndex: 1100,
  overflow: 'auto'
};

const surveyContainerStyle: CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  color: '#f3f3f3'
};

const surveyGridStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
};

const surveyTileStyle: CSSProperties = {
  border: '1px solid #444',
  borderRadius: '8px',
  backgroundColor: '#171717',
  padding: '8px',
  cursor: 'pointer'
};

const surveyFocusedTileStyle: CSSProperties = {
  border: '2px solid #4da3ff',
  boxShadow: '0 0 0 2px rgba(77, 163, 255, 0.2)'
};

const surveyWinnerTileStyle: CSSProperties = {
  borderColor: '#1f8f4d',
  backgroundColor: '#132217'
};

const surveyAlternateTileStyle: CSSProperties = {
  borderColor: '#8f7530',
  backgroundColor: '#242013'
};

const surveyRejectTileStyle: CSSProperties = {
  opacity: 0.45,
  filter: 'grayscale(35%)'
};

const surveyImageStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '3 / 2',
  objectFit: 'cover',
  borderRadius: '6px',
  marginBottom: '6px',
  backgroundColor: '#2a2a2a'
};

const surveyDetailStyle: CSSProperties = {
  border: '1px solid #444',
  borderRadius: '8px',
  backgroundColor: '#1a1a1a',
  padding: '10px',
  marginBottom: '12px'
};

const surveyRoleStyle: CSSProperties = {
  fontSize: '12px',
  margin: '4px 0 0 0'
};

const reviewActions: PhotoState[] = [
  PhotoState.Select,
  PhotoState.Pending,
  PhotoState.Reject,
  PhotoState.Unreviewed
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

function parsePrimaryAreaFromStorage(value: string | null): TedographyPrimaryArea {
  if (value === 'Review' || value === 'Library') {
    return value;
  }

  return 'Review';
}

function parseLibraryBrowseModeFromStorage(value: string | null): LibraryBrowseMode {
  if (value === 'Flat' || value === 'Timeline') {
    return value;
  }

  return 'Timeline';
}

function getDefaultPhotoStatesForPrimaryArea(area: TedographyPrimaryArea): PhotoState[] {
  if (area === 'Library') {
    return [PhotoState.Select];
  }

  return [PhotoState.Unreviewed, PhotoState.Pending];
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

function getReplacementAssetIdWhenHidingReject(
  list: MediaAsset[],
  currentAssetId: string
): string | null {
  const currentIndex = list.findIndex((asset) => asset.id === currentAssetId);
  if (currentIndex < 0) {
    return null;
  }

  for (let index = currentIndex + 1; index < list.length; index += 1) {
    const candidate = list[index];
    if (candidate && candidate.photoState !== PhotoState.Reject) {
      return candidate.id;
    }
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = list[index];
    if (candidate && candidate.photoState !== PhotoState.Reject) {
      return candidate.id;
    }
  }

  return null;
}

type AlbumTreeNodeWithDepth = AlbumTreeNode & {
  depth: number;
};

function buildAlbumTreeDisplayList(
  nodes: AlbumTreeNode[],
  expandedGroupIds: string[]
): AlbumTreeNodeWithDepth[] {
  const expandedSet = new Set(expandedGroupIds);
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label);
    });
  }

  const ordered: AlbumTreeNodeWithDepth[] = [];

  function appendChildren(parentId: string | null, depth: number): void {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      ordered.push({ ...child, depth });
      if (child.nodeType === 'Group' && expandedSet.has(child.id)) {
        appendChildren(child.id, depth + 1);
      }
    }
  }

  appendChildren(null, 0);
  return ordered;
}

function compareRoleFromPhotoState(photoState: PhotoState): string {
  if (photoState === PhotoState.Select) {
    return 'Winner';
  }

  if (photoState === PhotoState.Pending) {
    return 'Alternate';
  }

  if (photoState === PhotoState.Reject) {
    return 'Reject';
  }

  return 'Unreviewed';
}

function getAssetDisplayImageUrl(asset: MediaAsset): string | null {
  if (typeof asset.id === 'string' && asset.id.trim().length > 0) {
    return getDisplayMediaUrl(asset.id);
  }

  return null;
}

function getAssetThumbnailImageUrl(asset: MediaAsset): string | null {
  if (typeof asset.id === 'string' && asset.id.trim().length > 0) {
    return getThumbnailMediaUrl(asset.id);
  }

  return getAssetDisplayImageUrl(asset);
}

type AssetCardProps = {
  asset: MediaAsset;
  isSelected: boolean;
  isUpdating: boolean;
  onCardClick: (event: ReactMouseEvent<HTMLElement>, assetId: string) => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function AssetCard({ asset, isSelected, isUpdating, onCardClick, onSetPhotoState }: AssetCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnailImageUrl = getAssetThumbnailImageUrl(asset);
  const displayImageUrl = getAssetDisplayImageUrl(asset);
  const imageUrl = imageFailed ? displayImageUrl : thumbnailImageUrl;

  useEffect(() => {
    setImageFailed(false);
  }, [thumbnailImageUrl, displayImageUrl]);

  return (
    <article
      style={isSelected ? { ...cardStyle, ...selectedCardStyle } : cardStyle}
      onClick={(event) => onCardClick(event, asset.id)}
    >
      <div style={thumbnailFrameStyle}>
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
      </div>
      <div style={cardBodyStyle}>
        <strong>{asset.filename}</strong>
        {isSelected ? <span>Selected</span> : null}
        <span>State: {asset.photoState}</span>
        <span>Type: {asset.mediaType}</span>
        <span>Captured: {formatCaptureDate(asset.captureDateTime)}</span>
        <button
          type="button"
          style={cardSelectButtonStyle}
          onClick={(event) => {
            event.stopPropagation();
            onCardClick(event, asset.id);
          }}
        >
          Focus
        </button>
        <div style={actionsStyle}>
          {reviewActions.map((state) => (
            <button
              key={state}
              type="button"
              style={actionButtonStyle}
              onClick={(event) => {
                event.stopPropagation();
                onSetPhotoState(asset.id, state);
              }}
              disabled={isUpdating || asset.photoState === state}
            >
              {state}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

type AssetDetailPanelProps = {
  asset: MediaAsset | null;
  isUpdating: boolean;
  onOpenImmersive: () => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function AssetDetailPanel({
  asset,
  isUpdating,
  onOpenImmersive,
  onSetPhotoState
}: AssetDetailPanelProps) {
  if (!asset) {
    return <p style={detailPanelStyle}>No asset selected.</p>;
  }

  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <section style={detailPanelStyle}>
      <h2 style={{ marginTop: 0 }}>Focused Asset</h2>
      {imageUrl ? (
        <img src={imageUrl} alt={asset.filename} style={detailImageStyle} />
      ) : null}
      <p>
        <strong>Filename:</strong> {asset.filename}
      </p>
      <p>
        <strong>Type:</strong> {asset.mediaType}
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
      <button type="button" style={immersiveButtonStyle} onClick={onOpenImmersive}>
        Immersive
      </button>
      <div style={actionsStyle}>
        {reviewActions.map((state) => (
          <button
            key={state}
            type="button"
            style={actionButtonStyle}
            onClick={() => onSetPhotoState(asset.id, state)}
            disabled={isUpdating || asset.photoState === state}
          >
            {state}
          </button>
        ))}
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
  index,
  total,
  hasPrevious,
  hasNext,
  onClose,
  onPrevious,
  onNext,
  onActiveImageLoad
}: ImmersiveViewerProps) {
  const imageUrl = getAssetDisplayImageUrl(asset);

  return (
    <div style={immersiveOverlayStyle} onClick={onClose}>
      <section style={{ width: '100%', height: '100%' }} onClick={(event) => event.stopPropagation()}>
        <div style={immersiveTopBarStyle}>
          <div style={immersiveInfoStyle}>
            <strong>{asset.filename}</strong>
            <span>
              {asset.photoState} | {asset.mediaType} | {index + 1} / {total}
            </span>
            <span>{formatCaptureDate(asset.captureDateTime)}</span>
          </div>
          <div style={immersiveControlsStyle}>
            <button type="button" style={immersiveControlButtonStyle} onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              style={immersiveControlButtonStyle}
              onClick={onPrevious}
              disabled={!hasPrevious}
            >
              Previous
            </button>
            <button
              type="button"
              style={immersiveControlButtonStyle}
              onClick={onNext}
              disabled={!hasNext}
            >
              Next
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
        <p style={immersiveBottomHintStyle}>Keyboard: Left/Right navigate, Escape close, S/P/R/U review.</p>
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
  onSetFocusedWinner: () => void;
  onSetFocusedAlternate: () => void;
  onSetFocusedReject: () => void;
  onKeepFocusedAlternates: () => void;
  onKeepFocusedRejectOthers: () => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function SurveyMode({
  assets,
  focusedAsset,
  focusedIndex,
  isUpdating,
  onClose,
  onFocusAsset,
  onSetFocusedWinner,
  onSetFocusedAlternate,
  onSetFocusedReject,
  onKeepFocusedAlternates,
  onKeepFocusedRejectOthers,
  onSetPhotoState
}: SurveyModeProps) {
  return (
    <div style={surveyOverlayStyle} onClick={onClose}>
      <section style={surveyContainerStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ ...immersiveTopBarStyle, paddingBottom: '12px' }}>
          <div style={immersiveInfoStyle}>
            <strong>Survey Compare</strong>
            <span>
              {focusedAsset.filename} | {focusedIndex + 1} / {assets.length}
            </span>
          </div>
          <button type="button" style={immersiveControlButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        <AssetQuickBar asset={focusedAsset} currentIndex={focusedIndex} totalCount={assets.length} />

        <div style={surveyDetailStyle}>
          <p>
            <strong>Focused:</strong> {focusedAsset.filename}
          </p>
          <p>
            <strong>Compare role:</strong> {compareRoleFromPhotoState(focusedAsset.photoState)} |{' '}
            <strong>State:</strong> {focusedAsset.photoState} | <strong>Type:</strong> {focusedAsset.mediaType}
          </p>
          <p>
            <strong>Captured:</strong> {formatCaptureDate(focusedAsset.captureDateTime)}
          </p>
          <div style={actionsStyle}>
            <button type="button" style={immersiveControlButtonStyle} onClick={onSetFocusedWinner}>
              Winner (W)
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onSetFocusedAlternate}>
              Alternate (A)
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onSetFocusedReject}>
              Reject (R)
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onKeepFocusedAlternates}>
              Winner + Alternates (K)
            </button>
            <button type="button" style={immersiveControlButtonStyle} onClick={onKeepFocusedRejectOthers}>
              Winner Only (Shift+K)
            </button>
          </div>
          <div style={actionsStyle}>
            {reviewActions.map((state) => (
              <button
                key={state}
                type="button"
                style={immersiveControlButtonStyle}
                onClick={() => onSetPhotoState(focusedAsset.id, state)}
                disabled={isUpdating || focusedAsset.photoState === state}
              >
                {state}
              </button>
            ))}
          </div>
          <p style={{ color: '#b8b8b8', fontSize: '12px', marginTop: '8px' }}>
            Survey shortcuts: W winner, A alternate, R reject, K winner + alternates, Shift+K winner
            only.
          </p>
          <p style={{ color: '#9f9f9f', fontSize: '12px', marginTop: '4px' }}>
            Also available: S/P/R/U maps to Select/Pending/Reject/Unreviewed.
          </p>
        </div>

        <div style={surveyGridStyle}>
          {assets.map((asset) => {
            const imageUrl = getAssetDisplayImageUrl(asset);

            return (
              <article
                key={asset.id}
                style={{
                  ...surveyTileStyle,
                  ...(asset.photoState === PhotoState.Select ? surveyWinnerTileStyle : {}),
                  ...(asset.photoState === PhotoState.Pending ? surveyAlternateTileStyle : {}),
                  ...(asset.photoState === PhotoState.Reject ? surveyRejectTileStyle : {}),
                  ...(asset.id === focusedAsset.id ? surveyFocusedTileStyle : {})
                }}
                onClick={() => onFocusAsset(asset.id)}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={asset.filename} style={surveyImageStyle} />
                ) : (
                  <div style={surveyImageStyle} />
                )}
                <strong>{asset.filename}</strong>
                <p>{asset.photoState}</p>
                <p style={surveyRoleStyle}>Role: {compareRoleFromPhotoState(asset.photoState)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [albumTreeNodes, setAlbumTreeNodes] = useState<AlbumTreeNode[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [albumTreeLoading, setAlbumTreeLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [albumTreeError, setAlbumTreeError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatingAssetIds, setUpdatingAssetIds] = useState<Record<string, boolean>>({});
  const [photoStateFilters, setPhotoStateFilters] = useState<PhotoState[]>([]);
  const [mediaTypeFilters, setMediaTypeFilters] = useState<MediaType[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [advanceAfterRating, setAdvanceAfterRating] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(advanceAfterRatingStorageKey) === 'true';
  });
  const [hideReject, setHideReject] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(hideRejectStorageKey) === 'true';
  });
  const [primaryArea, setPrimaryArea] = useState<TedographyPrimaryArea>(() => {
    if (typeof window === 'undefined') {
      return 'Review';
    }

    return parsePrimaryAreaFromStorage(window.localStorage.getItem(primaryAreaStorageKey));
  });
  const [albumScopeMode, setAlbumScopeMode] = useState<'all' | 'checked'>(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }

    return window.localStorage.getItem(albumScopeModeStorageKey) === 'checked' ? 'checked' : 'all';
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
  const timelineSectionRefs = useRef<Record<string, HTMLElement | null>>({});

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
    window.localStorage.setItem(advanceAfterRatingStorageKey, advanceAfterRating ? 'true' : 'false');
  }, [advanceAfterRating]);

  useEffect(() => {
    window.localStorage.setItem(hideRejectStorageKey, hideReject ? 'true' : 'false');
  }, [hideReject]);

  useEffect(() => {
    window.localStorage.setItem(primaryAreaStorageKey, primaryArea);
  }, [primaryArea]);

  useEffect(() => {
    window.localStorage.setItem(libraryBrowseModeStorageKey, libraryBrowseMode);
  }, [libraryBrowseMode]);

  useEffect(() => {
    window.localStorage.setItem(
      timelineNavExpandedYearKeysStorageKey,
      JSON.stringify(timelineNavExpandedYearKeys)
    );
  }, [timelineNavExpandedYearKeys]);

  useEffect(() => {
    window.localStorage.setItem(albumScopeModeStorageKey, albumScopeMode);
  }, [albumScopeMode]);

  useEffect(() => {
    window.localStorage.setItem(checkedAlbumIdsStorageKey, JSON.stringify(checkedAlbumIds));
  }, [checkedAlbumIds]);

  useEffect(() => {
    window.localStorage.setItem(expandedAlbumTreeGroupIdsStorageKey, JSON.stringify(expandedGroupIds));
  }, [expandedGroupIds]);

  async function loadAssets(options?: { showLoading?: boolean }): Promise<void> {
    if (options?.showLoading ?? true) {
      setAssetsLoading(true);
    }

    setAssetsError(null);

    try {
      const response = await fetch('/api/assets');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as MediaAsset[];
      setAssets(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setAssetsError(error.message);
        return;
      }
      setAssetsError('Unknown error');
    } finally {
      setAssetsLoading(false);
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

  useEffect(() => {
    void loadAssets({ showLoading: true });
    void loadAlbumTreeNodes({ showLoading: true });
  }, []);

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

    const groupNodeIds = new Set(
      albumTreeNodes.filter((node) => node.nodeType === 'Group').map((node) => node.id)
    );
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
  }, [albumTreeLoading, albumTreeNodes, checkedAlbumIds, expandedGroupIds, selectedTreeNodeId]);

  const selectedAssetIdsForAlbumAction = useMemo(() => {
    if (selectedAssetIds.length > 0) {
      return selectedAssetIds;
    }

    return selectedAssetId ? [selectedAssetId] : [];
  }, [selectedAssetId, selectedAssetIds]);

  const albumNodesById = useMemo(
    () =>
      new Map<string, AlbumTreeNode>(
        albumTreeNodes.map((node) => [node.id, node])
      ),
    [albumTreeNodes]
  );

  const albumNodes = useMemo(
    () => albumTreeNodes.filter((node) => node.nodeType === 'Album'),
    [albumTreeNodes]
  );

  const albumAssetCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const asset of assets) {
      for (const albumId of asset.albumIds ?? []) {
        counts.set(albumId, (counts.get(albumId) ?? 0) + 1);
      }
    }

    return counts;
  }, [assets]);

  const hasCheckedAlbums = checkedAlbumIds.length > 0;

  const albumScopedAssets = useMemo(() => {
    if (albumScopeMode === 'all') {
      return assets;
    }

    if (checkedAlbumIds.length === 0) {
      return [];
    }

    const checkedSet = new Set(checkedAlbumIds);
    const deduped = new Map<string, MediaAsset>();
    for (const asset of assets) {
      const belongsToCheckedAlbum = (asset.albumIds ?? []).some((albumId) => checkedSet.has(albumId));
      if (belongsToCheckedAlbum) {
        deduped.set(asset.id, asset);
      }
    }

    return [...deduped.values()];
  }, [albumScopeMode, assets, checkedAlbumIds]);

  const areaDefaultPhotoStates = useMemo(
    () => getDefaultPhotoStatesForPrimaryArea(primaryArea),
    [primaryArea]
  );

  const areaScopedAssets = useMemo(
    () => albumScopedAssets.filter((asset) => areaDefaultPhotoStates.includes(asset.photoState)),
    [albumScopedAssets, areaDefaultPhotoStates]
  );

  const filteredAssets = useMemo(() => {
    return areaScopedAssets.filter((asset) => {
      const matchesPhotoState =
        photoStateFilters.length === 0 || photoStateFilters.includes(asset.photoState);
      const matchesMediaType =
        mediaTypeFilters.length === 0 || mediaTypeFilters.includes(asset.mediaType);
      const matchesHideReject = !hideReject || asset.photoState !== PhotoState.Reject;

      return matchesPhotoState && matchesMediaType && matchesHideReject;
    });
  }, [areaScopedAssets, hideReject, mediaTypeFilters, photoStateFilters]);

  const visibleAssets = useMemo(
    () => sortVisibleAssetsForTimeline(filteredAssets),
    [filteredAssets]
  );

  const timelineMonthGroups = useMemo(
    () => groupAssetsByCaptureMonth(visibleAssets),
    [visibleAssets]
  );

  const timelineNavigationYears = useMemo<TimelineNavigationYear[]>(
    () => buildTimelineNavigationYears(timelineMonthGroups),
    [timelineMonthGroups]
  );


  const selectedAsset = useMemo(
    () => visibleAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [visibleAssets, selectedAssetId]
  );

  const compareAssets = useMemo(
    () => visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [visibleAssets, selectedAssetIds]
  );

  const selectedAssetIndex = useMemo(
    () => visibleAssets.findIndex((asset) => asset.id === selectedAssetId),
    [visibleAssets, selectedAssetId]
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
  const hasAreaScopedAssets = areaScopedAssets.length > 0;
  const hasFilteredAssets = visibleAssets.length > 0;
  const hasActiveFilters = photoStateFilters.length > 0 || mediaTypeFilters.length > 0 || hideReject;
  const isAlbumScopeMode = albumScopeMode === 'checked';
  const isReviewArea = primaryArea === 'Review';
  const isLibraryArea = primaryArea === 'Library';
  const isTimelineMode = isLibraryArea && libraryBrowseMode === 'Timeline';
  const treeDisplayNodes = useMemo(
    () => buildAlbumTreeDisplayList(albumTreeNodes, expandedGroupIds),
    [albumTreeNodes, expandedGroupIds]
  );

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
    const visibleIds = new Set(visibleAssets.map((asset) => asset.id));
    const prunedSelected = selectedAssetIds.filter((id) => visibleIds.has(id));

    let nextFocused: string | null = selectedAssetId;
    if (!nextFocused || !visibleIds.has(nextFocused)) {
      nextFocused = prunedSelected[0] ?? visibleAssets[0]?.id ?? null;
    }

    let nextSelected = prunedSelected;
    if (nextFocused && !nextSelected.includes(nextFocused)) {
      nextSelected = [nextFocused, ...nextSelected];
    }

    if (!arraysEqual(selectedAssetIds, nextSelected)) {
      setSelectedAssetIds(nextSelected);
    }

    if (selectedAssetId !== nextFocused) {
      setSelectedAssetId(nextFocused);
    }
  }, [visibleAssets, selectedAssetId, selectedAssetIds]);

  useEffect(() => {
    if (immersiveOpen && !selectedAsset) {
      setImmersiveOpen(false);
    }
  }, [immersiveOpen, selectedAsset]);

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

  function setAssetUpdating(assetId: string, isUpdating: boolean): void {
    setUpdatingAssetIds((previous) => ({ ...previous, [assetId]: isUpdating }));
  }

  async function handleSetPhotoState(assetId: string, photoState: PhotoState): Promise<void> {
    const isActiveAssetUpdate = assetId === selectedAssetId;
    const navigationList = surveyOpen ? compareAssets : visibleAssets;
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

      const matchesPhotoStateAfterUpdate =
        photoStateFilters.length === 0 || photoStateFilters.includes(updatedAsset.photoState);
      const matchesMediaTypeAfterUpdate =
        mediaTypeFilters.length === 0 || mediaTypeFilters.includes(updatedAsset.mediaType);
      const matchesHideRejectAfterUpdate =
        !hideReject || updatedAsset.photoState !== PhotoState.Reject;
      const remainsVisibleAfterUpdate =
        matchesPhotoStateAfterUpdate &&
        matchesMediaTypeAfterUpdate &&
        matchesHideRejectAfterUpdate;

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

  function openImmersive(): void {
    if (!selectedAsset) {
      return;
    }

    setSurveyOpen(false);
    setImmersiveOpen(true);
  }

  function openSurveyMode(): void {
    if (compareAssets.length < 2) {
      return;
    }

    setImmersiveOpen(false);
    setSurveyOpen(true);
  }

  function togglePhotoStateFilter(photoState: PhotoState): void {
    setPhotoStateFilters((previous) =>
      previous.includes(photoState)
        ? previous.filter((state) => state !== photoState)
        : [...previous, photoState]
    );
  }

  function toggleMediaTypeFilter(mediaType: MediaType): void {
    setMediaTypeFilters((previous) =>
      previous.includes(mediaType)
        ? previous.filter((type) => type !== mediaType)
        : [...previous, mediaType]
    );
  }

  function clearFilters(): void {
    setPhotoStateFilters([]);
    setMediaTypeFilters([]);
    setHideReject(false);
  }

  function handleToggleHideReject(nextValue: boolean): void {
    if (nextValue && selectedAssetId) {
      const currentAsset = visibleAssets.find((asset) => asset.id === selectedAssetId);
      if (currentAsset && currentAsset.photoState === PhotoState.Reject) {
        const replacementAssetId = getReplacementAssetIdWhenHidingReject(visibleAssets, selectedAssetId);
        setSelectedAssetId(replacementAssetId);
      }
    }

    setHideReject(nextValue);
  }

  function handleSetAllPhotosScope(): void {
    setAlbumScopeMode('all');
  }

  function handleSetCheckedAlbumScope(): void {
    setAlbumScopeMode('checked');
  }

  function handleSetLibraryBrowseMode(mode: LibraryBrowseMode): void {
    setLibraryBrowseMode(mode);
  }

  function toggleTimelineYearExpanded(yearKey: string): void {
    setTimelineNavExpandedYearKeys((previous) =>
      previous.includes(yearKey)
        ? previous.filter((key) => key !== yearKey)
        : [...previous, yearKey]
    );
  }

  function handleJumpToTimelineMonth(groupKey: string): void {
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
    setAlbumScopeMode('checked');
    setCheckedAlbumIds((previous) =>
      previous.includes(albumId)
        ? previous.filter((id) => id !== albumId)
        : [...previous, albumId]
    );
  }

  async function handleCreateGroup(): Promise<void> {
    const input = window.prompt('Group label');
    if (!input) {
      return;
    }

    const label = input.trim();
    if (label.length === 0) {
      return;
    }

    const selectedNode = selectedTreeNodeId ? albumNodesById.get(selectedTreeNodeId) : null;
    const parentId =
      selectedNode && selectedNode.nodeType === 'Group' ? selectedNode.id : selectedNode?.parentId ?? null;

    try {
      await createAlbumTreeNode({ label, nodeType: 'Group', parentId });
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to create group');
    }
  }

  async function handleCreateAlbum(): Promise<void> {
    const input = window.prompt('Album label');
    if (!input) {
      return;
    }

    const label = input.trim();
    if (label.length === 0) {
      return;
    }

    const selectedNode = selectedTreeNodeId ? albumNodesById.get(selectedTreeNodeId) : null;
    const parentId =
      selectedNode && selectedNode.nodeType === 'Group' ? selectedNode.id : selectedNode?.parentId ?? null;

    try {
      const created = await createAlbumTreeNode({ label, nodeType: 'Album', parentId });
      setAlbumScopeMode('checked');
      setCheckedAlbumIds((previous) => (previous.includes(created.id) ? previous : [...previous, created.id]));
      setExpandedGroupIds((previous) =>
        parentId && !previous.includes(parentId) ? [...previous, parentId] : previous
      );
      await loadAlbumTreeNodes({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to create album');
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
      await loadAssets({ showLoading: false });
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
      await loadAssets({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to add assets to album');
    }
  }

  async function handleRemoveSelectedFromFocusedAlbum(): Promise<void> {
    if (!selectedTreeNodeId) {
      return;
    }

    const focusedNode = albumNodesById.get(selectedTreeNodeId);
    if (!focusedNode || focusedNode.nodeType !== 'Album') {
      return;
    }

    if (selectedAssetIdsForAlbumAction.length === 0) {
      return;
    }

    try {
      await removeAssetsFromAlbum(focusedNode.id, {
        assetIds: selectedAssetIdsForAlbumAction
      });
      await loadAssets({ showLoading: false });
    } catch (error: unknown) {
      setUpdateError(error instanceof Error ? error.message : 'Failed to remove assets from album');
    }
  }

  function handleFilmstripSelectAsset(assetId: string): void {
    setSelectedAssetId(assetId);
  }

  function handleImmersiveActiveImageLoad(loadedAssetId: string): void {
    if (!immersiveOpen) {
      return;
    }

    // Guard against stale load events when fast navigation changes the active asset.
    if (!selectedAssetId || loadedAssetId !== selectedAssetId || selectedAssetIndex < 0) {
      return;
    }

    const nextAsset = visibleAssets[selectedAssetIndex + 1];
    const previousAsset = visibleAssets[selectedAssetIndex - 1];

    // Prefetch forward first because next-image navigation is the primary review flow.
    if (nextAsset) {
      prefetchImage(getDisplayMediaUrl(nextAsset.id));
    }

    if (previousAsset) {
      prefetchImage(getDisplayMediaUrl(previousAsset.id));
    }
  }

  async function handleKeyboardReview(shortcutKey: string): Promise<void> {
    if (!selectedAsset || updatingAssetIds[selectedAsset.id] === true) {
      return;
    }

    const key = shortcutKey.toLowerCase();
    if (key === 's') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Select);
      return;
    }

    if (key === 'p') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Pending);
      return;
    }

    if (key === 'r') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Reject);
      return;
    }

    if (key === 'u') {
      await handleSetPhotoState(selectedAsset.id, PhotoState.Unreviewed);
    }
  }

  async function handleSurveyKeepFocusedRejectOthers(): Promise<void> {
    if (!selectedAssetId || compareAssets.length < 2) {
      return;
    }

    for (const asset of compareAssets) {
      if (asset.id === selectedAssetId) {
        await handleSetPhotoState(asset.id, PhotoState.Select);
      } else {
        await handleSetPhotoState(asset.id, PhotoState.Reject);
      }
    }
  }

  async function handleSurveySetFocusedPhotoState(photoState: PhotoState): Promise<void> {
    if (!selectedAssetId) {
      return;
    }

    await handleSetPhotoState(selectedAssetId, photoState);
  }

  async function handleSurveyKeepFocusedAlternates(): Promise<void> {
    if (!selectedAssetId || compareAssets.length < 2) {
      return;
    }

    for (const asset of compareAssets) {
      if (asset.id === selectedAssetId) {
        await handleSetPhotoState(asset.id, PhotoState.Select);
      } else {
        await handleSetPhotoState(asset.id, PhotoState.Pending);
      }
    }
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>, assetId: string): void {
    const isToggleSelection = event.metaKey || event.ctrlKey;

    if (!isToggleSelection) {
      setSelectedAssetId(assetId);
      setSelectedAssetIds([assetId]);
      return;
    }

    const alreadySelected = selectedAssetIds.includes(assetId);
    if (!alreadySelected) {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
      setSelectedAssetId(assetId);
      return;
    }

    const nextSelectedIds = selectedAssetIds.filter((id) => id !== assetId);
    setSelectedAssetIds(nextSelectedIds);

    if (selectedAssetId === assetId) {
      setSelectedAssetId(nextSelectedIds[0] ?? null);
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape' && surveyOpen) {
        setSurveyOpen(false);
        return;
      }

      if (event.key === 'Escape' && immersiveOpen) {
        setImmersiveOpen(false);
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

        if (event.key.toLowerCase() === 'w') {
          event.preventDefault();
          void handleSurveySetFocusedPhotoState(PhotoState.Select);
          return;
        }

        if (event.key.toLowerCase() === 'a') {
          event.preventDefault();
          void handleSurveySetFocusedPhotoState(PhotoState.Pending);
          return;
        }

        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          void handleSurveySetFocusedPhotoState(PhotoState.Reject);
          return;
        }

        if (event.key.toLowerCase() === 'k' && event.shiftKey) {
          event.preventDefault();
          void handleSurveyKeepFocusedRejectOthers();
          return;
        }

        if (event.key.toLowerCase() === 'k') {
          event.preventDefault();
          void handleSurveyKeepFocusedAlternates();
          return;
        }

        void handleKeyboardReview(event.key);
        return;
      }

      if (immersiveOpen) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectRelativeInList(visibleAssets, 1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectRelativeInList(visibleAssets, -1);
        }

        void handleKeyboardReview(event.key);
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        handleSelectRelativeInList(visibleAssets, 1);
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        handleSelectRelativeInList(visibleAssets, -1);
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
    compareAssets,
    visibleAssets,
    immersiveOpen,
    selectedAsset,
    selectedAssetId,
    surveyOpen,
    updatingAssetIds
  ]);

  return (
    <div style={pageStyle}>
      <h1>Tedography</h1>
      <p>API status: {healthStatus}</p>

      <div style={primaryAreaControlsStyle}>
        <button
          type="button"
          style={
            primaryArea === 'Review'
              ? { ...compareButtonStyle, backgroundColor: '#e8f1ff', borderColor: '#1f6feb' }
              : compareButtonStyle
          }
          onClick={() => setPrimaryArea('Review')}
          disabled={primaryArea === 'Review'}
        >
          Review
        </button>
        <button
          type="button"
          style={
            primaryArea === 'Library'
              ? { ...compareButtonStyle, backgroundColor: '#e8f1ff', borderColor: '#1f6feb' }
              : compareButtonStyle
          }
          onClick={() => setPrimaryArea('Library')}
          disabled={primaryArea === 'Library'}
        >
          Library
        </button>
      </div>
      <p style={{ color: '#666', fontSize: '13px', margin: '-4px 0 10px 0' }}>
        {isReviewArea
          ? 'Review — curate unreviewed and pending photos quickly.'
          : 'Library — browse selected keeper photos.'}
      </p>
      {isLibraryArea && isTimelineMode ? (
        <p style={{ color: '#666', fontSize: '12px', margin: '-2px 0 10px 0' }}>
          Browse selected photos by month and jump quickly through your archive timeline.
        </p>
      ) : null}

      <div style={controlsStyle}>
        {isReviewArea ? (
          <button
            type="button"
            style={compareButtonStyle}
            onClick={openSurveyMode}
            disabled={compareAssets.length < 2}
          >
            Survey ({compareAssets.length})
          </button>
        ) : (
          <button
            type="button"
            style={compareButtonStyle}
            onClick={() => setImportDialogOpen(true)}
          >
            Import
          </button>
        )}
        <button
          type="button"
          style={compareButtonStyle}
          onClick={() => void handleAddSelectedToAlbum()}
          disabled={selectedAssetIdsForAlbumAction.length === 0}
        >
          Add to Album ({selectedAssetIdsForAlbumAction.length})
        </button>
        {selectedTreeNodeId && albumNodesById.get(selectedTreeNodeId)?.nodeType === 'Album' ? (
          <button
            type="button"
            style={compareButtonStyle}
            onClick={() => void handleRemoveSelectedFromFocusedAlbum()}
            disabled={selectedAssetIdsForAlbumAction.length === 0}
          >
            Remove from Album
          </button>
        ) : null}
        {isLibraryArea ? (
          <>
            <button type="button" style={compareButtonStyle} onClick={() => void handleCreateGroup()}>
              New Group
            </button>
            <button type="button" style={compareButtonStyle} onClick={() => void handleCreateAlbum()}>
              New Album
            </button>
            <button
              type="button"
              style={compareButtonStyle}
              onClick={() => void handleRenameSelectedTreeNode()}
              disabled={!selectedTreeNodeId}
            >
              Rename Node
            </button>
            <button
              type="button"
              style={compareButtonStyle}
              onClick={() => void handleDeleteSelectedTreeNode()}
              disabled={!selectedTreeNodeId}
            >
              Delete Node
            </button>
          </>
        ) : null}
        <label style={isReviewArea ? toggleOptionLabelStyle : secondaryToggleOptionLabelStyle}>
          <input
            type="checkbox"
            checked={advanceAfterRating}
            onChange={(event) => setAdvanceAfterRating(event.target.checked)}
          />
          Advance after rating
        </label>
        <label style={isReviewArea ? toggleOptionLabelStyle : secondaryToggleOptionLabelStyle}>
          <input
            type="checkbox"
            checked={hideReject}
            onChange={(event) => handleToggleHideReject(event.target.checked)}
          />
          Hide Reject
        </label>
        {isLibraryArea ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={filterLabelStyle}>Library View:</span>
            <button
              type="button"
              style={
                libraryBrowseMode === 'Flat'
                  ? { ...compareButtonStyle, backgroundColor: '#e8f1ff', borderColor: '#1f6feb' }
                  : compareButtonStyle
              }
              onClick={() => handleSetLibraryBrowseMode('Flat')}
              disabled={libraryBrowseMode === 'Flat'}
            >
              Flat
            </button>
            <button
              type="button"
              style={
                libraryBrowseMode === 'Timeline'
                  ? { ...compareButtonStyle, backgroundColor: '#e8f1ff', borderColor: '#1f6feb' }
                  : compareButtonStyle
              }
              onClick={() => handleSetLibraryBrowseMode('Timeline')}
              disabled={libraryBrowseMode === 'Timeline'}
            >
              Timeline
            </button>
          </div>
        ) : null}
        {isLibraryArea ? (
          <button
            type="button"
            style={compareButtonStyle}
            onClick={openSurveyMode}
            disabled={compareAssets.length < 2}
          >
            Survey ({compareAssets.length})
          </button>
        ) : (
          <button
            type="button"
            style={compareButtonStyle}
            onClick={() => setImportDialogOpen(true)}
          >
            Import
          </button>
        )}
      </div>
      <section style={albumTreeSectionStyle}>
        <strong>Albums</strong>
        <div style={albumTreeRowStyle}>
          <button
            type="button"
            style={compareButtonStyle}
            onClick={handleSetAllPhotosScope}
            disabled={albumScopeMode === 'all'}
          >
            All Photos ({assets.length})
          </button>
          <button
            type="button"
            style={compareButtonStyle}
            onClick={handleSetCheckedAlbumScope}
            disabled={albumScopeMode === 'checked'}
          >
            Checked Albums ({checkedAlbumIds.length})
          </button>
        </div>
        {albumTreeLoading ? <p>Loading album tree...</p> : null}
        {albumTreeError ? <p>Failed to load album tree: {albumTreeError}</p> : null}
        {!albumTreeLoading ? (
          <div style={albumTreeListStyle}>
            {treeDisplayNodes.length === 0 ? (
              <p>No tree nodes yet. Create a Group or Album.</p>
            ) : (
              treeDisplayNodes.map((node) => {
                const isGroup = node.nodeType === 'Group';
                const isExpanded = expandedGroupIds.includes(node.id);
                const isChecked = checkedAlbumIds.includes(node.id);
                const isSelected = selectedTreeNodeId === node.id;
                const childPrefix = ' '.repeat(node.depth * 2);

                return (
                  <div key={node.id} style={albumTreeRowStyle}>
                    <span style={{ minWidth: `${node.depth * 18}px` }}>{childPrefix}</span>
                    {isGroup ? (
                      <button
                        type="button"
                        style={compareButtonStyle}
                        onClick={() => toggleGroupExpanded(node.id)}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    ) : (
                      <span style={{ width: '34px' }} />
                    )}
                    {!isGroup ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAlbumChecked(node.id)}
                      />
                    ) : null}
                    <button
                      type="button"
                      style={compareButtonStyle}
                      onClick={() => setSelectedTreeNodeId(node.id)}
                      disabled={isSelected}
                    >
                      {node.label}
                      {!isGroup ? ` (${albumAssetCounts.get(node.id) ?? 0})` : ''}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </section>
      <section style={filterSectionStyle}>
        <strong>Filters</strong>
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <span style={filterLabelStyle}>Photo State:</span>
            {photoStateFilterOptions.map((option) => (
              <label key={option} style={filterOptionLabelStyle}>
                <input
                  type="checkbox"
                  checked={photoStateFilters.includes(option)}
                  onChange={() => togglePhotoStateFilter(option)}
                />
                {option}
              </label>
            ))}
          </div>
          <div style={filterGroupStyle}>
            <span style={filterLabelStyle}>Media Type:</span>
            {mediaTypeFilterOptions.map((option) => (
              <label key={option} style={filterOptionLabelStyle}>
                <input
                  type="checkbox"
                  checked={mediaTypeFilters.includes(option)}
                  onChange={() => toggleMediaTypeFilter(option)}
                />
                {option}
              </label>
            ))}
          </div>
          <button
            type="button"
            style={compareButtonStyle}
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      </section>
      <p style={{ color: '#666', fontSize: '12px', marginTop: '-8px' }}>
        {isReviewArea
          ? 'Keyboard: arrows navigate, Home/End jump, Enter/Space immersive, S/P/R/U review. Cmd/Ctrl-click to multi-select.'
          : 'Keyboard: arrows navigate, Home/End jump, Enter/Space immersive. Cmd/Ctrl-click to multi-select.'}
      </p>

      {assetsLoading ? <p>Loading assets...</p> : null}
      {assetsError ? <p>Failed to load assets: {assetsError}</p> : null}
      {updateError ? <p>{updateError}</p> : null}
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
              onClick={() => setImportDialogOpen(true)}
            >
              Import Assets
            </button>
          </section>
        ) : hasFilteredAssets ? (
          <>
            {!immersiveOpen ? (
              <AssetQuickBar
                asset={selectedAsset}
                currentIndex={selectedAssetIndex}
                totalCount={visibleAssets.length}
              />
            ) : null}
            <AssetDetailPanel
              asset={selectedAsset}
              isUpdating={selectedAsset ? updatingAssetIds[selectedAsset.id] === true : false}
              onOpenImmersive={openImmersive}
              onSetPhotoState={handleSetPhotoState}
            />
            <AssetFilmstrip
              assets={visibleAssets}
              activeAssetId={selectedAssetId}
              onSelectAsset={handleFilmstripSelectAsset}
            />
            <AssetDetailsPanel asset={selectedAsset} />
            {isTimelineMode ? (
              <div style={timelineLayoutStyle}>
                <aside style={timelineNavPanelStyle}>
                  <strong>Timeline</strong>
                  {timelineNavigationYears.map((year) => {
                    const isExpanded = timelineNavExpandedYearKeys.includes(year.key);
                    return (
                      <section key={year.key} style={{ marginTop: '8px' }}>
                        <div style={timelineYearHeaderStyle}>
                          <button
                            type="button"
                            style={compareButtonStyle}
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
                                style={timelineMonthButtonStyle}
                                onClick={() => handleJumpToTimelineMonth(month.key)}
                              >
                                {month.label} ({month.assetCount})
                              </button>
                            ))
                          : null}
                      </section>
                    );
                  })}
                </aside>
                <div>
                  {timelineMonthGroups.map((group) => (
                    <section
                      key={group.key}
                      style={groupSectionStyle}
                      ref={(element) => {
                        timelineSectionRefs.current[group.key] = element;
                      }}
                    >
                      <h3 style={groupHeaderStyle}>
                        {group.label}
                        <span style={groupMetaStyle}>
                          · {group.assets.length} {group.assets.length === 1 ? 'asset' : 'assets'}
                        </span>
                      </h3>
                      <div style={gridStyle}>
                        {group.assets.map((asset) => (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            isSelected={selectedAssetIds.includes(asset.id)}
                            isUpdating={updatingAssetIds[asset.id] === true}
                            onCardClick={handleCardClick}
                            onSetPhotoState={handleSetPhotoState}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <div style={gridStyle}>
                {visibleAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAssetIds.includes(asset.id)}
                    isUpdating={updatingAssetIds[asset.id] === true}
                    onCardClick={handleCardClick}
                    onSetPhotoState={handleSetPhotoState}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <AssetDetailPanel
              asset={null}
              isUpdating={false}
              onOpenImmersive={openImmersive}
              onSetPhotoState={handleSetPhotoState}
            />
            <AssetDetailsPanel asset={null} />
            {isAlbumScopeMode && !hasCheckedAlbums ? (
              <p>Check one or more albums to view their media.</p>
            ) : isAlbumScopeMode && albumScopedAssets.length === 0 ? (
              <p>The checked albums contain no assets yet.</p>
            ) : primaryArea === 'Review' && !hasAreaScopedAssets ? (
              <p>No photos need review right now. Switch to Library to browse selected photos.</p>
            ) : primaryArea === 'Library' && !hasAreaScopedAssets ? (
              <p>No selected photos in the library yet. Mark keepers as Select in Review.</p>
            ) : (
              <p>No visible assets match the current filters.</p>
            )}
            {hasActiveFilters ? (
              <div style={actionsStyle}>
                <button type="button" style={compareButtonStyle} onClick={clearFilters}>
                  Clear Filters
                </button>
                {hideReject ? (
                  <button
                    type="button"
                    style={compareButtonStyle}
                    onClick={() => handleToggleHideReject(false)}
                  >
                    Show Rejects
                  </button>
                ) : null}
              </div>
            ) : null}
            {isAlbumScopeMode ? (
              <button
                type="button"
                style={compareButtonStyle}
                onClick={handleSetAllPhotosScope}
              >
                All Photos
              </button>
            ) : null}
          </>
        )
      ) : null}

      {immersiveOpen && selectedAsset ? (
        <ImmersiveViewer
          asset={selectedAsset}
          index={selectedAssetIndex}
          total={visibleAssets.length}
          hasPrevious={selectedAssetIndex > 0}
          hasNext={selectedAssetIndex >= 0 && selectedAssetIndex < visibleAssets.length - 1}
          onClose={() => setImmersiveOpen(false)}
          onPrevious={() => handleSelectRelativeInList(visibleAssets, -1)}
          onNext={() => handleSelectRelativeInList(visibleAssets, 1)}
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
          onSetFocusedWinner={() => void handleSurveySetFocusedPhotoState(PhotoState.Select)}
          onSetFocusedAlternate={() => void handleSurveySetFocusedPhotoState(PhotoState.Pending)}
          onSetFocusedReject={() => void handleSurveySetFocusedPhotoState(PhotoState.Reject)}
          onKeepFocusedAlternates={() => void handleSurveyKeepFocusedAlternates()}
          onKeepFocusedRejectOthers={() => void handleSurveyKeepFocusedRejectOthers()}
          onSetPhotoState={handleSetPhotoState}
        />
      ) : null}

      <ImportAssetsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportCompleted={() => {
          void loadAssets({ showLoading: false });
          void loadAlbumTreeNodes({ showLoading: false });
        }}
      />
    </div>
  );
}
