import { useEffect, useRef, type CSSProperties } from 'react';
import { type MediaAsset } from '@tedography/domain';
import { getThumbnailMediaUrl } from '../../utilities/mediaUrls';

type AssetFilmstripProps = {
  assets: MediaAsset[];
  activeAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
};

const stripStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '8px',
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  backgroundColor: '#f7f7f7',
  marginBottom: '10px'
};

const itemButtonStyle: CSSProperties = {
  width: '88px',
  height: '88px',
  minWidth: '88px',
  padding: 0,
  border: '1px solid #bababa',
  borderRadius: '6px',
  overflow: 'hidden',
  backgroundColor: '#1f1f1f',
  cursor: 'pointer'
};

const activeItemButtonStyle: CSSProperties = {
  border: '2px solid #1f6feb',
  boxShadow: '0 0 0 2px rgba(31, 111, 235, 0.15)'
};

const imageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block'
};

export function AssetFilmstrip({ assets, activeAssetId, onSelectAsset }: AssetFilmstripProps) {
  const thumbnailRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!activeAssetId) {
      return;
    }

    const element = thumbnailRefs.current.get(activeAssetId);
    if (!element) {
      return;
    }

    element.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeAssetId]);

  if (assets.length === 0) {
    return null;
  }

  return (
    <section style={stripStyle}>
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          style={asset.id === activeAssetId ? { ...itemButtonStyle, ...activeItemButtonStyle } : itemButtonStyle}
          onClick={() => onSelectAsset(asset.id)}
          ref={(node) => {
            if (node) {
              thumbnailRefs.current.set(asset.id, node);
            } else {
              thumbnailRefs.current.delete(asset.id);
            }
          }}
          aria-label={`Navigate to ${asset.filename}`}
        >
          <img src={getThumbnailMediaUrl(asset.id)} alt={asset.filename} style={imageStyle} loading="lazy" />
        </button>
      ))}
    </section>
  );
}
