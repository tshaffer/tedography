import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { PhotoState, type MediaAsset } from '@tedography/domain';

type AssetFilter = 'All' | PhotoState;

const filterOptions: AssetFilter[] = [
  'All',
  PhotoState.Unreviewed,
  PhotoState.Pending,
  PhotoState.Select,
  PhotoState.Reject
];

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
  marginBottom: '16px'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
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

const imageStyle: CSSProperties = {
  aspectRatio: '3 / 2',
  backgroundColor: '#f1f1f1',
  display: 'block',
  objectFit: 'cover',
  width: '100%'
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

const surveySelectTileStyle: CSSProperties = {
  borderColor: '#1f8f4d',
  backgroundColor: '#132217'
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

const reviewActions: PhotoState[] = [
  PhotoState.Select,
  PhotoState.Pending,
  PhotoState.Reject,
  PhotoState.Unreviewed
];

function formatCaptureDate(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return parsed.toLocaleString();
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

type AssetCardProps = {
  asset: MediaAsset;
  isSelected: boolean;
  isUpdating: boolean;
  onCardClick: (event: ReactMouseEvent<HTMLElement>, assetId: string) => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function AssetCard({ asset, isSelected, isUpdating, onCardClick, onSetPhotoState }: AssetCardProps) {
  return (
    <article
      style={isSelected ? { ...cardStyle, ...selectedCardStyle } : cardStyle}
      onClick={(event) => onCardClick(event, asset.id)}
    >
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt={asset.filename} style={imageStyle} loading="lazy" />
      ) : (
        <div style={imageStyle} />
      )}
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

  return (
    <section style={detailPanelStyle}>
      <h2 style={{ marginTop: 0 }}>Focused Asset</h2>
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt={asset.filename} style={detailImageStyle} />
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
};

function ImmersiveViewer({
  asset,
  index,
  total,
  hasPrevious,
  hasNext,
  onClose,
  onPrevious,
  onNext
}: ImmersiveViewerProps) {
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
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.filename} style={immersiveImageStyle} />
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

        <div style={surveyDetailStyle}>
          <p>
            <strong>Focused:</strong> {focusedAsset.filename}
          </p>
          <p>
            <strong>State:</strong> {focusedAsset.photoState} | <strong>Type:</strong> {focusedAsset.mediaType}
          </p>
          <p>
            <strong>Captured:</strong> {formatCaptureDate(focusedAsset.captureDateTime)}
          </p>
          <div style={actionsStyle}>
            <button type="button" style={immersiveControlButtonStyle} onClick={onKeepFocusedRejectOthers}>
              Keep Focused (K)
            </button>
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
            Survey shortcuts: S/P/R/U review focused, K keep focused and reject others.
          </p>
        </div>

        <div style={surveyGridStyle}>
          {assets.map((asset) => (
            <article
              key={asset.id}
              style={{
                ...surveyTileStyle,
                ...(asset.photoState === PhotoState.Select ? surveySelectTileStyle : {}),
                ...(asset.photoState === PhotoState.Reject ? surveyRejectTileStyle : {}),
                ...(asset.id === focusedAsset.id ? surveyFocusedTileStyle : {})
              }}
              onClick={() => onFocusAsset(asset.id)}
            >
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt={asset.filename} style={surveyImageStyle} />
              ) : (
                <div style={surveyImageStyle} />
              )}
              <strong>{asset.filename}</strong>
              <p>{asset.photoState}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatingAssetIds, setUpdatingAssetIds] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<AssetFilter>('All');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);

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
    fetch('/api/assets')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Request failed with status ${r.status}`);
        }
        return r.json() as Promise<MediaAsset[]>;
      })
      .then((data) => {
        setAssets(data);
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          setAssetsError(error.message);
          return;
        }
        setAssetsError('Unknown error');
      })
      .finally(() => {
        setAssetsLoading(false);
      });
  }, []);

  const filteredAssets = useMemo(() => {
    if (filter === 'All') {
      return assets;
    }

    return assets.filter((asset) => asset.photoState === filter);
  }, [assets, filter]);

  const selectedAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [filteredAssets, selectedAssetId]
  );

  const compareAssets = useMemo(
    () => filteredAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [filteredAssets, selectedAssetIds]
  );

  const selectedAssetIndex = useMemo(
    () => filteredAssets.findIndex((asset) => asset.id === selectedAssetId),
    [filteredAssets, selectedAssetId]
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

  useEffect(() => {
    const visibleIds = new Set(filteredAssets.map((asset) => asset.id));
    const prunedSelected = selectedAssetIds.filter((id) => visibleIds.has(id));

    let nextFocused: string | null = selectedAssetId;
    if (!nextFocused || !visibleIds.has(nextFocused)) {
      nextFocused = prunedSelected[0] ?? filteredAssets[0]?.id ?? null;
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
  }, [filteredAssets, selectedAssetId, selectedAssetIds]);

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
    if (filteredAssets.length === 0) {
      return;
    }

    const nextAsset =
      position === 'first' ? filteredAssets[0] : filteredAssets[filteredAssets.length - 1];
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

      if (filteredAssets.length === 0 || selectedAssetId === null) {
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

        if (event.key.toLowerCase() === 'k') {
          event.preventDefault();
          void handleSurveyKeepFocusedRejectOthers();
          return;
        }

        void handleKeyboardReview(event.key);
        return;
      }

      if (immersiveOpen) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectRelativeInList(filteredAssets, 1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectRelativeInList(filteredAssets, -1);
        }

        void handleKeyboardReview(event.key);
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        handleSelectRelativeInList(filteredAssets, 1);
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        handleSelectRelativeInList(filteredAssets, -1);
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
    filteredAssets,
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

      <div style={controlsStyle}>
        <label htmlFor="asset-filter">Photo state:</label>
        <select
          id="asset-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AssetFilter)}
        >
          {filterOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          style={compareButtonStyle}
          onClick={openSurveyMode}
          disabled={compareAssets.length < 2}
        >
          Survey ({compareAssets.length})
        </button>
      </div>
      <p style={{ color: '#666', fontSize: '12px', marginTop: '-8px' }}>
        Keyboard: arrows navigate, Home/End jump, Enter/Space immersive, S/P/R/U review. Cmd/Ctrl-click
        to multi-select.
      </p>

      {assetsLoading ? <p>Loading assets...</p> : null}
      {assetsError ? <p>Failed to load assets: {assetsError}</p> : null}
      {updateError ? <p>{updateError}</p> : null}
      {!assetsLoading && !assetsError ? (
        filteredAssets.length > 0 ? (
          <>
            <AssetDetailPanel
              asset={selectedAsset}
              isUpdating={selectedAsset ? updatingAssetIds[selectedAsset.id] === true : false}
              onOpenImmersive={openImmersive}
              onSetPhotoState={handleSetPhotoState}
            />
            <div style={gridStyle}>
              {filteredAssets.map((asset) => (
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
          </>
        ) : (
          <>
            <AssetDetailPanel
              asset={null}
              isUpdating={false}
              onOpenImmersive={openImmersive}
              onSetPhotoState={handleSetPhotoState}
            />
            <p>No assets match this filter.</p>
          </>
        )
      ) : null}

      {immersiveOpen && selectedAsset ? (
        <ImmersiveViewer
          asset={selectedAsset}
          index={selectedAssetIndex}
          total={filteredAssets.length}
          hasPrevious={selectedAssetIndex > 0}
          hasNext={selectedAssetIndex >= 0 && selectedAssetIndex < filteredAssets.length - 1}
          onClose={() => setImmersiveOpen(false)}
          onPrevious={() => handleSelectRelativeInList(filteredAssets, -1)}
          onNext={() => handleSelectRelativeInList(filteredAssets, 1)}
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
          onKeepFocusedRejectOthers={() => void handleSurveyKeepFocusedRejectOthers()}
          onSetPhotoState={handleSetPhotoState}
        />
      ) : null}
    </div>
  );
}
