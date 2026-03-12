import { type CSSProperties } from 'react';
import { type MediaAsset } from '@tedography/domain';

type AssetQuickBarProps = {
  asset: MediaAsset | null;
  currentIndex?: number | null;
  totalCount?: number | null;
};

const quickBarStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  backgroundColor: '#f7f7f7',
  padding: '8px 10px',
  marginBottom: '10px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px 14px',
  alignItems: 'center',
  fontSize: '12px'
};

const metaItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px'
};

const labelStyle: CSSProperties = {
  color: '#555',
  fontWeight: 600
};

function formatMissing(value?: string | null): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '—';
  }

  return value;
}

function formatDateTime(value?: string | null): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatDimensions(width?: number | null, height?: number | null): string {
  if (typeof width !== 'number' || typeof height !== 'number') {
    return '—';
  }

  return `${width} × ${height}`;
}

function formatPosition(currentIndex?: number | null, totalCount?: number | null): string {
  if (
    typeof currentIndex !== 'number' ||
    Number.isNaN(currentIndex) ||
    currentIndex < 0 ||
    typeof totalCount !== 'number' ||
    Number.isNaN(totalCount) ||
    totalCount <= 0
  ) {
    return '—';
  }

  return `${currentIndex + 1} / ${totalCount}`;
}

export function AssetQuickBar({ asset, currentIndex, totalCount }: AssetQuickBarProps) {
  if (!asset) {
    return null;
  }

  const formatHint =
    typeof asset.originalFileFormat === 'string' &&
    asset.originalFileFormat.length > 0 &&
    typeof asset.displayFileFormat === 'string' &&
    asset.displayFileFormat.length > 0
      ? `${asset.originalFileFormat.toUpperCase()} → ${asset.displayFileFormat.toUpperCase()}`
      : '—';

  return (
    <section style={quickBarStyle}>
      <span style={metaItemStyle}>
        <span style={labelStyle}>File:</span>
        <strong>{asset.filename}</strong>
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Position:</span>
        {formatPosition(currentIndex, totalCount)}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>State:</span>
        {asset.photoState}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Type:</span>
        {asset.mediaType}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Size:</span>
        {formatDimensions(asset.width, asset.height)}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Captured:</span>
        {formatDateTime(asset.captureDateTime)}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Original:</span>
        {formatMissing(asset.originalFileFormat)}
      </span>
      <span style={metaItemStyle}>
        <span style={labelStyle}>Display:</span>
        {formatHint}
      </span>
    </section>
  );
}
