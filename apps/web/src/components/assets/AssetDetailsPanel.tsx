import { type CSSProperties } from 'react';
import { type MediaAsset } from '@tedography/domain';
import type { DuplicateReconciliationListItem } from '@tedography/shared';
import { type DuplicateResolutionVisibilitySummary } from '../duplicates/duplicateResolutionVisibility';

interface AssetDetailsPanelProps {
  asset: MediaAsset | null;
  albumLabels?: string[];
  duplicateResolutionSummary?: DuplicateResolutionVisibilitySummary | null;
  duplicateReconciliation?: DuplicateReconciliationListItem | null;
  onReimportAsset?: () => void;
  onRebuildDerivedFiles?: () => void;
  assetOperationBusy?: boolean;
  assetOperationMessage?: string | null;
  assetOperationError?: boolean;
}

const panelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '8px',
  backgroundColor: '#fff'
};

const titleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: '8px',
  fontSize: '14px'
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '118px 1fr',
  gap: '8px',
  fontSize: '12px',
  padding: '3px 0',
  borderBottom: '1px solid #efefef'
};

const labelStyle: CSSProperties = {
  color: '#555',
  fontWeight: 600
};

const valueStyle: CSSProperties = {
  color: '#111',
  wordBreak: 'break-word'
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginBottom: '10px'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  backgroundColor: '#f4f4f4',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

function formatValue(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '—';
  }

  return value;
}

function formatDateTime(value: string | null | undefined): string {
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
  if (typeof width === 'number' && typeof height === 'number') {
    return `${width} × ${height}`;
  }

  return '—';
}

function renderRow(label: string, value: string) {
  return (
    <div style={rowStyle} key={label}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

function formatAlbumLabels(albumLabels: string[]): string {
  if (albumLabels.length === 0) {
    return '—';
  }

  return albumLabels.join(', ');
}

function formatLocation(
  locationLabel?: string | null,
  locationLatitude?: number | null,
  locationLongitude?: number | null
): string {
  if (typeof locationLabel === 'string' && locationLabel.trim().length > 0) {
    return locationLabel;
  }

  if (typeof locationLatitude === 'number' && typeof locationLongitude === 'number') {
    return `${locationLatitude.toFixed(5)}, ${locationLongitude.toFixed(5)}`;
  }

  return '—';
}

export function AssetDetailsPanel({
  asset,
  albumLabels = [],
  duplicateResolutionSummary = null,
  duplicateReconciliation = null,
  onReimportAsset,
  onRebuildDerivedFiles,
  assetOperationBusy = false,
  assetOperationMessage = null,
  assetOperationError = false
}: AssetDetailsPanelProps) {
  if (!asset) {
    return (
      <section style={panelStyle}>
        <h3 style={titleStyle}>Asset Details</h3>
        <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Select a photo to view details.</p>
      </section>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Filename', value: formatValue(asset.filename) },
    { label: 'Photo State', value: formatValue(asset.photoState) },
    { label: 'Media Type', value: formatValue(asset.mediaType) },
    { label: 'Captured', value: formatDateTime(asset.captureDateTime) },
    { label: 'Dimensions', value: formatDimensions(asset.width, asset.height) },
    { label: 'Albums', value: formatAlbumLabels(albumLabels) },
    {
      label: 'Location',
      value: formatLocation(asset.locationLabel, asset.locationLatitude, asset.locationLongitude)
    },
    { label: 'Original Format', value: formatValue(asset.originalFileFormat) },
    { label: 'Original Root', value: formatValue(asset.originalStorageRootId) },
    { label: 'Original Path', value: formatValue(asset.originalArchivePath) },
    { label: 'Display Storage', value: formatValue(asset.displayStorageType) },
    { label: 'Display Format', value: formatValue(asset.displayFileFormat) },
    {
      label: 'Thumbnail',
      value:
        asset.thumbnailStorageType === 'derived-root' &&
        typeof asset.thumbnailDerivedPath === 'string' &&
        asset.thumbnailDerivedPath.length > 0
          ? `Yes (${asset.thumbnailDerivedPath})`
          : 'No'
    },
    { label: 'Imported', value: formatDateTime(asset.importedAt) }
  ];

  if (duplicateResolutionSummary) {
    rows.push(
      {
        label: 'Duplicate Role',
        value: duplicateResolutionSummary.role === 'canonical' ? 'Canonical keeper' : 'Suppressed duplicate'
      },
      { label: 'Duplicate Group', value: duplicateResolutionSummary.groupKey }
    );
  }

  if (duplicateReconciliation) {
    rows.push(
      { label: 'Reconciliation', value: duplicateReconciliation.status },
      {
        label: 'Added Albums',
        value: String(
          duplicateReconciliation.entries.reduce((sum, entry) => sum + entry.addedValues.length, 0)
        )
      }
    );
  }

  return (
    <section style={panelStyle}>
      <h3 style={titleStyle}>Asset Details</h3>
      <div style={actionsStyle}>
        <button
          type="button"
          style={assetOperationBusy ? disabledButtonStyle : buttonStyle}
          onClick={onReimportAsset}
          disabled={assetOperationBusy || !onReimportAsset}
        >
          {assetOperationBusy ? 'Working...' : 'Reimport Asset'}
        </button>
        <button
          type="button"
          style={assetOperationBusy ? disabledButtonStyle : buttonStyle}
          onClick={onRebuildDerivedFiles}
          disabled={assetOperationBusy || !onRebuildDerivedFiles}
        >
          {assetOperationBusy ? 'Working...' : 'Rebuild Derived Files'}
        </button>
      </div>
      {assetOperationMessage ? (
        <p style={{ marginTop: 0, color: assetOperationError ? '#b00020' : '#136f2d', fontSize: '12px' }}>
          {assetOperationMessage}
        </p>
      ) : null}
      {rows.map((row) => renderRow(row.label, row.value))}
    </section>
  );
}
