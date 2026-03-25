import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { type MediaAsset } from '@tedography/domain';
import { type DuplicateResolutionVisibilitySummary } from '../duplicates/duplicateResolutionVisibility';

interface AssetDetailsPanelProps {
  asset: MediaAsset | null;
  albumLabels?: string[];
  duplicateResolutionSummary?: DuplicateResolutionVisibilitySummary | null;
  onReimportAsset?: () => void;
  onRebuildDerivedFiles?: () => void;
  assetOperationBusy?: boolean;
  assetOperationMessage?: string | null;
  assetOperationError?: boolean;
  peopleStatus?: {
    detectionsCount: number;
    reviewableCount: number;
    confirmedPeopleNames: string[];
    loading?: boolean;
    errorMessage?: string | null;
    reviewHref?: string;
  } | null;
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

const subSectionStyle: CSSProperties = {
  borderTop: '1px solid #efefef',
  marginTop: '10px',
  paddingTop: '10px'
};

const subSectionTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '13px'
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
  onReimportAsset,
  onRebuildDerivedFiles,
  assetOperationBusy = false,
  assetOperationMessage = null,
  assetOperationError = false,
  peopleStatus = null
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
    { label: 'Asset ID', value: formatValue(asset.id) },
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
      {peopleStatus ? (
        <section style={subSectionStyle}>
          <h4 style={subSectionTitleStyle}>People</h4>
          {peopleStatus.loading ? (
            <p style={{ margin: '0 0 6px', color: '#666', fontSize: '12px' }}>Loading people status...</p>
          ) : peopleStatus.errorMessage ? (
            <p style={{ margin: '0 0 6px', color: '#b00020', fontSize: '12px' }}>{peopleStatus.errorMessage}</p>
          ) : peopleStatus.detectionsCount === 0 ? (
            <p style={{ margin: '0 0 6px', color: '#666', fontSize: '12px' }}>
              No people data yet. Run People Recognition to detect faces for this asset.
            </p>
          ) : (
            <>
              {renderRow('Detections', String(peopleStatus.detectionsCount))}
              {renderRow('Reviewable', String(peopleStatus.reviewableCount))}
              {renderRow(
                'Confirmed',
                peopleStatus.confirmedPeopleNames.length > 0 ? peopleStatus.confirmedPeopleNames.join(', ') : 'None'
              )}
              <p style={{ margin: '8px 0 0', color: '#666', fontSize: '12px' }}>
                {peopleStatus.reviewableCount > 0
                  ? 'Reviewable faces still need confirmation before they become derived asset people.'
                  : peopleStatus.confirmedPeopleNames.length > 0
                    ? 'Confirmed people here come from reviewed face detections and drive derived asset metadata.'
                    : 'Detections exist, but nothing is confirmed into derived asset people yet.'}
              </p>
            </>
          )}
          {peopleStatus.reviewHref ? (
            <div style={{ marginTop: '8px' }}>
              <Link to={peopleStatus.reviewHref} style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}>
                Review Faces
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
