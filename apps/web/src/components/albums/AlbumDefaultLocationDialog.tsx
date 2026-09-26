import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { autocompletePlace, getPlaceDetails, type PlacePrediction } from '../../api/geocodeApi';
import type { ResolvedLocationSelection } from '../assets/SetLocationDialog';

type LocationMode = 'set' | 'clear';

interface AlbumDefaultLocationDialogProps {
  open: boolean;
  albumLabel: string;
  existingLocationLabel?: string | null;
  onClose: () => void;
  onSave: (input: { clear: true } | ResolvedLocationSelection) => Promise<void>;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1300
};

const dialogStyle: CSSProperties = {
  width: 'min(440px, 92vw)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = { padding: '16px 18px 12px', borderBottom: '1px solid #ececec' };
const bodyStyle: CSSProperties = { padding: '16px 18px', display: 'grid', gap: '10px' };
const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};
const fieldLabelStyle: CSSProperties = { display: 'grid', gap: '6px', fontSize: '13px', color: '#444' };
const inputStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px'
};
const radioGroupStyle: CSSProperties = { display: 'grid', gap: '10px' };
const radioOptionStyle: CSSProperties = { display: 'flex', gap: '10px', fontSize: '13px', color: '#333' };
const helperTextStyle: CSSProperties = { margin: 0, fontSize: '12px', color: '#666', lineHeight: 1.45 };
const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};
const primaryButtonStyle: CSSProperties = { ...buttonStyle, backgroundColor: '#1f6feb', borderColor: '#1f6feb', color: '#fff' };
const disabledButtonStyle: CSSProperties = { ...buttonStyle, opacity: 0.55, cursor: 'not-allowed' };
const calloutStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  backgroundColor: '#f5f3ff',
  border: '1px solid #ddd6fe',
  display: 'grid',
  gap: '4px'
};
const suggestionsBoxStyle: CSSProperties = { border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' };
const suggestionRowStyle: CSSProperties = { padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' };
const selectedPlaceBoxStyle: CSSProperties = {
  border: '1px solid #bfdbfe',
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'grid',
  gap: '4px'
};

export function AlbumDefaultLocationDialog({
  open,
  albumLabel,
  existingLocationLabel = null,
  onClose,
  onSave
}: AlbumDefaultLocationDialogProps): ReactElement | null {
  const [mode, setMode] = useState<LocationMode>('set');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ResolvedLocationSelection | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sessionTokenRef = useRef('');

  useEffect(() => {
    if (!open) return;
    sessionTokenRef.current = crypto.randomUUID();
    setMode('set');
    setQuery('');
    setPredictions([]);
    setSelectedPlace(null);
    setSavePending(false);
    setSaveError(null);
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'set' || query.trim().length === 0 || selectedPlace) {
      setPredictions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void autocompletePlace(query, sessionTokenRef.current)
        .then((results) => { if (!cancelled) setPredictions(results); })
        .catch(() => { if (!cancelled) setPredictions([]); });
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, mode, query, selectedPlace]);

  if (!open) return null;

  async function handleSelectPrediction(prediction: PlacePrediction): Promise<void> {
    setSaveError(null);
    try {
      const details = await getPlaceDetails(prediction.placeId, sessionTokenRef.current);
      setSelectedPlace({
        placeName: details.placeName,
        locationLabel: details.formattedAddress ?? prediction.description,
        city: details.city,
        state: details.state,
        country: details.country,
        locationLatitude: details.latitude,
        locationLongitude: details.longitude
      });
      setQuery(prediction.description);
      setPredictions([]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to resolve place details.');
    }
  }

  const canSave = !savePending && (mode === 'clear' || selectedPlace !== null);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Album Default Location</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#666' }}>{albumLabel}</p>
        </div>

        <div style={bodyStyle}>
          {existingLocationLabel ? (
            <p style={helperTextStyle}>Current default: <strong>{existingLocationLabel}</strong></p>
          ) : null}

          <div style={radioGroupStyle}>
            <label style={radioOptionStyle}>
              <input type="radio" name="album-location-mode" checked={mode === 'set'} onChange={() => setMode('set')} />
              <span>Set default location</span>
            </label>
            <label style={radioOptionStyle}>
              <input type="radio" name="album-location-mode" checked={mode === 'clear'} onChange={() => setMode('clear')} />
              <span>Clear default location</span>
            </label>
          </div>

          {mode === 'set' ? (
            <>
              <label style={fieldLabelStyle}>
                <span>Place</span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (selectedPlace) setSelectedPlace(null);
                  }}
                  placeholder="e.g. Downieville, CA"
                  style={inputStyle}
                  autoFocus
                />
              </label>

              {selectedPlace ? (
                <div style={selectedPlaceBoxStyle}>
                  <strong style={{ fontSize: '13px', color: '#1d4ed8' }}>
                    {selectedPlace.placeName ?? selectedPlace.locationLabel}
                  </strong>
                  {selectedPlace.placeName && selectedPlace.placeName !== selectedPlace.locationLabel ? (
                    <span style={{ fontSize: '12px', color: '#374151' }}>{selectedPlace.locationLabel}</span>
                  ) : null}
                </div>
              ) : predictions.length > 0 ? (
                <div style={suggestionsBoxStyle}>
                  {predictions.map((prediction, index) => (
                    <div
                      key={prediction.placeId}
                      style={{
                        ...suggestionRowStyle,
                        borderBottom: index === predictions.length - 1 ? 'none' : suggestionRowStyle.borderBottom
                      }}
                      onClick={() => void handleSelectPrediction(prediction)}
                    >
                      <div style={{ fontSize: '13px', color: '#1f2937' }}>{prediction.mainText}</div>
                      {prediction.secondaryText ? (
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{prediction.secondaryText}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={calloutStyle}>
                <strong style={{ fontSize: '12px', color: '#6d28d9' }}>How this applies</strong>
                <span style={{ fontSize: '12px', color: '#5b21b6' }}>
                  Any photo in this album with no location of its own will show this place, labeled
                  &ldquo;From album.&rdquo; Photos with their own EXIF GPS or a manually set location are never overridden.
                </span>
              </div>
            </>
          ) : (
            <p style={helperTextStyle}>Photos in this album with no location of their own will show &ldquo;—&rdquo; again.</p>
          )}

          {saveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{saveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={buttonStyle} onClick={onClose} disabled={savePending}>Cancel</button>
          <button
            type="button"
            style={canSave ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canSave}
            onClick={() => {
              setSavePending(true);
              setSaveError(null);
              const input = mode === 'clear' ? ({ clear: true } as const) : (selectedPlace as ResolvedLocationSelection);
              void onSave(input)
                .catch((error: unknown) => setSaveError(error instanceof Error ? error.message : 'Failed to save.'))
                .finally(() => setSavePending(false));
            }}
          >
            {savePending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  );
}
