import { useEffect, useRef, type CSSProperties } from 'react';
import {
  normalizeDisplayRotationDegrees,
  type MediaAsset
} from '@tedography/domain';
import { getThumbnailMediaUrl } from '../../utilities/mediaUrls';

type AssetFilmstripProps = {
  assets: MediaAsset[];
  activeAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
};

const stripStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  overflowX: 'auto',
  padding: '6px',
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  backgroundColor: '#f7f7f7',
  marginBottom: '8px'
};

const itemButtonStyle: CSSProperties = {
  position: 'relative',
  width: '76px',
  height: '76px',
  minWidth: '76px',
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

function getRotatedImageStyle(asset: MediaAsset): CSSProperties {
  const displayRotationDegrees = normalizeDisplayRotationDegrees(asset.displayRotationDegrees);
  if (displayRotationDegrees === 0) {
    return imageStyle;
  }

  return {
    ...imageStyle,
    transform: `rotate(${displayRotationDegrees}deg)`,
    transformOrigin: 'center center'
  };
}

export function AssetFilmstrip({ assets, activeAssetId, onSelectAsset }: AssetFilmstripProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const thumbnailRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!activeAssetId) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const element = thumbnailRefs.current.get(activeAssetId);
    if (!element) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(container);
    const paddingLeft = Number.parseFloat(computedStyles.paddingLeft || '0') || 0;
    const paddingRight = Number.parseFloat(computedStyles.paddingRight || '0') || 0;
    const visibleLeft = containerRect.left + paddingLeft;
    const visibleRight = containerRect.right - paddingRight;
    const isFullyVisible =
      elementRect.left >= visibleLeft && elementRect.right <= visibleRight;

    if (isFullyVisible) {
      return;
    }

    let nextScrollLeft = container.scrollLeft;
    if (elementRect.left < visibleLeft) {
      nextScrollLeft -= visibleLeft - elementRect.left;
    } else if (elementRect.right > visibleRight) {
      nextScrollLeft += elementRect.right - visibleRight;
    }

    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
    const clampedScrollLeft = Math.min(Math.max(nextScrollLeft, 0), maxScrollLeft);
    if (Math.abs(clampedScrollLeft - container.scrollLeft) < 1) {
      return;
    }

    container.scrollTo({ left: clampedScrollLeft, behavior: 'smooth' });
  }, [activeAssetId]);

  if (assets.length === 0) {
    return null;
  }

  return (
    <section style={stripStyle} ref={containerRef}>
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          style={asset.id === activeAssetId ? { ...itemButtonStyle, ...activeItemButtonStyle } : itemButtonStyle}
          onClick={() => onSelectAsset(asset.id)}
          onMouseDown={(event) => event.preventDefault()}
          ref={(node) => {
            if (node) {
              thumbnailRefs.current.set(asset.id, node);
            } else {
              thumbnailRefs.current.delete(asset.id);
            }
          }}
          aria-label={`Navigate to ${asset.filename}`}
        >
          <img
            src={getThumbnailMediaUrl(asset.id)}
            alt={asset.filename}
            style={getRotatedImageStyle(asset)}
            loading="lazy"
          />
        </button>
      ))}
    </section>
  );
}
