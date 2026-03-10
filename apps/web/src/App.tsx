import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
  backgroundColor: '#fff'
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

type AssetCardProps = {
  asset: MediaAsset;
  isSelected: boolean;
  isUpdating: boolean;
  onSelect: (assetId: string) => void;
  onSetPhotoState: (assetId: string, photoState: PhotoState) => void;
};

function AssetCard({ asset, isSelected, isUpdating, onSelect, onSetPhotoState }: AssetCardProps) {
  return (
    <article style={isSelected ? { ...cardStyle, ...selectedCardStyle } : cardStyle}>
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
        <button type="button" style={cardSelectButtonStyle} onClick={() => onSelect(asset.id)}>
          Focus
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

export default function App() {
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatingAssetIds, setUpdatingAssetIds] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<AssetFilter>('All');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [immersiveOpen, setImmersiveOpen] = useState(false);

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
  const selectedAssetIndex = useMemo(
    () => filteredAssets.findIndex((asset) => asset.id === selectedAssetId),
    [filteredAssets, selectedAssetId]
  );

  useEffect(() => {
    if (filteredAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }

    const selectedIsVisible = filteredAssets.some((asset) => asset.id === selectedAssetId);
    if (!selectedIsVisible) {
      const firstAsset = filteredAssets[0];
      if (firstAsset) {
        setSelectedAssetId(firstAsset.id);
      }
    }
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (immersiveOpen && !selectedAsset) {
      setImmersiveOpen(false);
    }
  }, [immersiveOpen, selectedAsset]);

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

  function handleSelectAsset(assetId: string): void {
    setSelectedAssetId(assetId);
  }

  function handleSelectRelative(offset: number): void {
    if (selectedAssetId === null) {
      return;
    }

    const currentIndex = filteredAssets.findIndex((asset) => asset.id === selectedAssetId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), filteredAssets.length - 1);
    const nextAsset = filteredAssets[nextIndex];
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

    setImmersiveOpen(true);
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape' && immersiveOpen) {
        setImmersiveOpen(false);
        return;
      }

      if (filteredAssets.length === 0 || selectedAssetId === null) {
        return;
      }

      if (immersiveOpen) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleSelectRelative(1);
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleSelectRelative(-1);
        }
      } else {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          handleSelectRelative(1);
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          handleSelectRelative(-1);
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
      }

      void handleKeyboardReview(event.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredAssets, immersiveOpen, selectedAsset, selectedAssetId, updatingAssetIds]);

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
      </div>
      <p style={{ color: '#666', fontSize: '12px', marginTop: '-8px' }}>
        Keyboard: arrows navigate, Home/End jump, Enter/Space immersive, S/P/R/U review.
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
                  isSelected={selectedAssetId === asset.id}
                  isUpdating={updatingAssetIds[asset.id] === true}
                  onSelect={handleSelectAsset}
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
          onPrevious={() => handleSelectRelative(-1)}
          onNext={() => handleSelectRelative(1)}
        />
      ) : null}
    </div>
  );
}
