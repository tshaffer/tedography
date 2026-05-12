import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type MediaAsset, type MediaAssetPerson, type Person } from '@tedography/domain';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { listPeople } from '../../api/peoplePipelineApi';

interface AssetDetailsPanelProps {
  asset: MediaAsset | null;
  albumLabels?: string[];
  albumOrderingModeLabel?: string | null;
  onEditCaptureDate?: (() => void) | undefined;
  onReimportAsset?: () => void;
  onRebuildDerivedFiles?: () => void;
  /** undefined = hide button; null = show disabled (not in any album); fn = show enabled */
  onShowInAlbum?: (() => void) | null | undefined;
  assetOperationBusy?: boolean;
  assetOperationMessage?: string | null;
  assetOperationError?: boolean;
  peopleStatus?: {
    detectionsCount: number;
    reviewableCount: number;
    people: MediaAssetPerson[];
    recognitionRanAt?: string | null;
    recognitionBusy?: boolean;
    onRunRecognition?: () => void;
    loading?: boolean;
    errorMessage?: string | null;
    reviewHref?: string;
    onOpenReview?: () => void;
  } | null;
  onAddManualPerson?: ((personId: string) => Promise<void>) | undefined;
  onRemoveManualPerson?: ((personId: string) => Promise<void>) | undefined;
  keywordsSlot?: ReactNode;
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
  marginTop: '10px'
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

const advancedToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0 2px',
  fontSize: '12px',
  color: '#6b7280',
  width: '100%',
  textAlign: 'left',
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

function renderRow(label: string, value: string, labelFontSize?: string) {
  return (
    <div style={rowStyle} key={label}>
      <span style={labelFontSize ? { ...labelStyle, fontSize: labelFontSize } : labelStyle}>{label}</span>
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
  city?: string | null,
  state?: string | null,
  country?: string | null,
  locationLabel?: string | null,
  locationLatitude?: number | null,
  locationLongitude?: number | null
): string {
  const humanLocation = [city, state, country]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(', ');

  const fallbackLabel =
    typeof locationLabel === 'string' && locationLabel.trim().length > 0 ? locationLabel : null;

  const coordinateLabel =
    typeof locationLatitude === 'number' && typeof locationLongitude === 'number'
      ? `${locationLatitude.toFixed(5)}, ${locationLongitude.toFixed(5)}`
      : null;

  if (humanLocation.length > 0 && coordinateLabel) {
    return `${humanLocation} (${coordinateLabel})`;
  }
  if (humanLocation.length > 0) {
    return humanLocation;
  }
  if (fallbackLabel && coordinateLabel) {
    return `${fallbackLabel} (${coordinateLabel})`;
  }
  if (fallbackLabel) {
    return fallbackLabel;
  }
  if (coordinateLabel) {
    return coordinateLabel;
  }
  return '—';
}

function PersonPicker({
  assignedPersonIds,
  busy,
  onPick
}: {
  assignedPersonIds: Set<string>;
  busy: boolean;
  onPick: (personId: string) => void;
}) {
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPeople()
      .then((response) => { if (!cancelled) { setAllPeople(response.items); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(
    () => allPeople.filter((p) => !assignedPersonIds.has(p.id)),
    [allPeople, assignedPersonIds]
  );

  return (
    <div style={{ marginBottom: '8px' }}>
      <Autocomplete<Person>
        options={options}
        loading={loading}
        getOptionLabel={(p) => p.displayName}
        disabled={busy}
        size="small"
        onChange={(_e, value) => { if (value) { onPick(value.id); } }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search people…"
            inputProps={{ ...params.inputProps, style: { fontSize: '12px' } }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={14} /> : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
            sx={{
              '& .MuiInputBase-root': { paddingTop: '2px', paddingBottom: '2px' },
              '& .MuiInputBase-input': { fontSize: '12px' }
            }}
          />
        )}
      />
    </div>
  );
}

export function AssetDetailsPanel({
  asset,
  albumLabels = [],
  albumOrderingModeLabel = null,
  onEditCaptureDate,
  onReimportAsset,
  onRebuildDerivedFiles,
  onShowInAlbum,
  assetOperationBusy = false,
  assetOperationMessage = null,
  assetOperationError = false,
  peopleStatus = null,
  onAddManualPerson,
  onRemoveManualPerson,
  keywordsSlot
}: AssetDetailsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [peopleDetailsOpen, setPeopleDetailsOpen] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [personPickerBusy, setPersonPickerBusy] = useState(false);

  if (!asset) {
    return (
      <section style={panelStyle}>
        <h3 style={titleStyle}>Asset Details</h3>
        <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Select a photo to view details.</p>
      </section>
    );
  }

  const advancedRows: Array<{ label: string; value: string }> = [
    { label: 'Asset ID', value: formatValue(asset.id) },
    { label: 'Photo State', value: formatValue(asset.photoState) },
    { label: 'Dimensions', value: formatDimensions(asset.width, asset.height) },
    ...(albumOrderingModeLabel ? [{ label: 'Order in this Album', value: albumOrderingModeLabel }] : []),
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

  return (
    <section style={panelStyle}>
      <h3 style={titleStyle}>Asset Details</h3>

      {/* Albums */}
      {renderRow('Albums', formatAlbumLabels(albumLabels), '13px')}

      {/* Keywords */}
      {keywordsSlot}

      {/* People */}
      {peopleStatus ? (
        <section style={subSectionStyle}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h4 style={{ ...subSectionTitleStyle, margin: 0 }}>People</h4>
            <div style={{ display: 'flex', gap: '4px' }}>
              {onAddManualPerson ? (
                <button
                  type="button"
                  onClick={() => setPersonPickerOpen((prev) => !prev)}
                  title={personPickerOpen ? 'Cancel' : 'Tag a person'}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: personPickerOpen ? '#6b7280' : '#374151',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '1px 6px',
                  }}
                >
                  {personPickerOpen ? '×' : '+'}
                </button>
              ) : null}
              {peopleStatus.detectionsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setPeopleDetailsOpen((prev) => !prev)}
                  title={peopleDetailsOpen ? 'Hide details' : 'Show details'}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: peopleDetailsOpen ? '#6b7280' : '#374151',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '1px 6px',
                  }}
                >
                  {peopleDetailsOpen ? '×' : '⋯'}
                </button>
              ) : null}
            </div>
          </div>

          {/* Person picker */}
          {personPickerOpen && onAddManualPerson ? (
            <PersonPicker
              assignedPersonIds={new Set((peopleStatus.people ?? []).map((p) => p.personId))}
              busy={personPickerBusy}
              onPick={async (personId) => {
                setPersonPickerBusy(true);
                try {
                  await onAddManualPerson(personId);
                  setPersonPickerOpen(false);
                } finally {
                  setPersonPickerBusy(false);
                }
              }}
            />
          ) : null}

          {/* Primary view */}
          {peopleStatus.loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading people status...</p>
          ) : peopleStatus.errorMessage ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{peopleStatus.errorMessage}</p>
          ) : peopleStatus.people.length === 0 && peopleStatus.detectionsCount === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#aaa', fontSize: '12px' }}>
                {peopleStatus.recognitionRanAt ? 'No people detected.' : 'No people detected yet.'}
              </span>
              {!peopleStatus.recognitionRanAt && peopleStatus.onRunRecognition ? (
                <button
                  type="button"
                  onClick={peopleStatus.onRunRecognition}
                  disabled={peopleStatus.recognitionBusy}
                  title={peopleStatus.recognitionBusy ? 'Running people recognition…' : 'Run people recognition for this photo'}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: peopleStatus.recognitionBusy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', opacity: peopleStatus.recognitionBusy ? 0.4 : 1 }}
                >
                  <EmojiEmotionsIcon style={{ fontSize: '16px', color: '#f0a030' }} />
                </button>
              ) : null}
            </div>
          ) : peopleStatus.people.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {peopleStatus.people.map((person) => (
                <Chip
                  key={person.personId}
                  label={person.displayName}
                  size="small"
                  variant={person.source === 'manual-asset-tag' ? 'outlined' : 'filled'}
                  title={person.source === 'manual-asset-tag' ? 'Manually tagged' : 'Face detected'}
                  onDelete={
                    person.source === 'manual-asset-tag' && onRemoveManualPerson
                      ? () => void onRemoveManualPerson(person.personId)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <span style={{ color: '#aaa', fontSize: '12px' }}>None confirmed yet.</span>
          )}

          {/* Expanded details */}
          {peopleStatus.detectionsCount > 0 && peopleDetailsOpen ? (
            <div style={{ marginTop: '8px' }}>
              {renderRow('Detections', String(peopleStatus.detectionsCount))}
              {renderRow('Reviewable', String(peopleStatus.reviewableCount))}
              {renderRow(
                'Confirmed',
                peopleStatus.people.filter((p) => p.source === 'confirmed-face-detection').length > 0
                  ? peopleStatus.people.filter((p) => p.source === 'confirmed-face-detection').map((p) => p.displayName).join(', ')
                  : 'None'
              )}
              {peopleStatus.reviewableCount > 0 || peopleStatus.people.filter((p) => p.source === 'confirmed-face-detection').length === 0 ? (
                <p style={{ margin: '8px 0 0', color: '#666', fontSize: '12px' }}>
                  {peopleStatus.reviewableCount > 0
                    ? 'Reviewable faces still need confirmation before they become derived asset people.'
                    : 'Detections exist, nothing confirmed.'}
                </p>
              ) : null}
              {peopleStatus.reviewHref ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {peopleStatus.onOpenReview ? (
                    <button type="button" style={buttonStyle} onClick={peopleStatus.onOpenReview}>
                      Review Faces
                    </button>
                  ) : null}
                  <Link
                    to={peopleStatus.reviewHref}
                    style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
                  >
                    Open Full People Review
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Location */}
      <div style={subSectionStyle}>
        {renderRow('Location', formatLocation(
          asset.city,
          asset.state,
          asset.country,
          asset.locationLabel,
          asset.locationLatitude,
          asset.locationLongitude
        ), '13px')}
      </div>

      {/* Action Buttons */}
      <div style={actionsStyle}>
        <button
          type="button"
          style={assetOperationBusy ? disabledButtonStyle : buttonStyle}
          onClick={onEditCaptureDate}
          disabled={assetOperationBusy || !onEditCaptureDate}
        >
          {assetOperationBusy ? 'Working...' : 'Set Capture Date...'}
        </button>
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
        {onShowInAlbum !== undefined ? (
          <button
            type="button"
            style={onShowInAlbum ? buttonStyle : disabledButtonStyle}
            onClick={onShowInAlbum ?? undefined}
            disabled={!onShowInAlbum}
            title={
              onShowInAlbum
                ? 'Navigate to the album containing this photo'
                : 'This photo is not in any album'
            }
          >
            Show in Album
          </button>
        ) : null}
      </div>
      {assetOperationMessage ? (
        <p style={{ marginTop: '6px', color: assetOperationError ? '#b00020' : '#136f2d', fontSize: '12px' }}>
          {assetOperationMessage}
        </p>
      ) : null}

      {/* Advanced Details (collapsed by default) */}
      <div style={{ borderTop: '1px solid #efefef', marginTop: '10px' }}>
        <button
          type="button"
          style={advancedToggleStyle}
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          <span style={{ fontSize: '9px' }}>{advancedOpen ? '▼' : '▶'}</span>
          Advanced Details
        </button>
        {advancedOpen ? (
          <div style={{ marginTop: '4px' }}>
            {advancedRows.map((row) => renderRow(row.label, row.value))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
