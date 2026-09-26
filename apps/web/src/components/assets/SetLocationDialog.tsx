import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { locationDisplayModes, type AssetLocationDisplayMode, type LocationDisplayMode } from '@tedography/domain';
import { autocompletePlace, getPlaceDetails, type PlacePrediction } from '../../api/geocodeApi';
import {
  formatLocationForDisplay,
  locationDisplayModeLabels,
  type LocationDisplayFields
} from '../../utilities/locationDisplay';

type LocationMode = 'set' | 'clear';

// 'unchanged' (multi-select only) leaves each photo's own choice alone;
// 'default' follows the album / global choice.
type DisplayChoice = 'unchanged' | 'default' | AssetLocationDisplayMode;

export interface ResolvedLocationSelection {
  placeName: string | null;
  locationLabel: string;
  city: string | null;
  state: string | null;
  country: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

export interface SetLocationSaveInput {
  /** The place picked from search, or null to keep each photo's stored place. */
  place: ResolvedLocationSelection | null;
  /** Omitted to leave each photo's display choice as it is; mode null = follow the album / global default. */
  display?: { mode: AssetLocationDisplayMode | null; customLocationLabel: string | null };
}

interface SetLocationDialogProps {
  open: boolean;
  selectedAssetCount: number;
  /** Formatted display string for the current location, when editing a single asset that already has one. */
  existingLocationLabel?: string | null;
  /** Single photo only: its stored location, used to preview each display option. */
  currentLocation?: LocationDisplayFields | null;
  /** Single photo only: its own display choice (null = follows the default). */
  currentDisplayMode?: AssetLocationDisplayMode | null;
  currentCustomLabel?: string | null;
  /** What "default" means for these photos, and where it comes from (e.g. 'album "Big Sur"'). */
  inheritedDisplayMode: LocationDisplayMode;
  inheritedDisplaySource: string;
  onClose: () => void;
  onSave: (input: { clear: true } | SetLocationSaveInput) => Promise<void>;
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
  width: 'min(520px, 92vw)',
  maxHeight: 'min(760px, 92vh)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px',
  borderBottom: '1px solid #ececec'
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
  overflow: 'auto',
  display: 'grid',
  gap: '10px'
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};

const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  color: '#444'
};

const inputStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  backgroundColor: '#fff'
};

const radioGroupStyle: CSSProperties = {
  display: 'grid',
  gap: '10px'
};

const radioOptionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  fontSize: '13px',
  color: '#333'
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#666',
  lineHeight: 1.45
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1f6feb',
  borderColor: '#1f6feb',
  color: '#fff'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const suggestionsBoxStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  overflow: 'hidden'
};

const suggestionRowStyle: CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  borderBottom: '1px solid #f0f0f0'
};

const sectionTitleStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '13px',
  fontWeight: 600,
  color: '#333'
};

const displayOptionStyle: CSSProperties = {
  ...radioOptionStyle,
  alignItems: 'center'
};

const displayPreviewStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0
};

const selectedPlaceBoxStyle: CSSProperties = {
  border: '1px solid #bfdbfe',
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'grid',
  gap: '4px'
};

function joinPlace(city: string | null, state: string | null, country: string | null): string {
  return [city, state, country].filter((value): value is string => Boolean(value && value.trim())).join(', ');
}

export function SetLocationDialog({
  open,
  selectedAssetCount,
  existingLocationLabel = null,
  currentLocation = null,
  currentDisplayMode = null,
  currentCustomLabel = null,
  inheritedDisplayMode,
  inheritedDisplaySource,
  onClose,
  onSave
}: SetLocationDialogProps): ReactElement | null {
  const [mode, setMode] = useState<LocationMode>('set');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<ResolvedLocationSelection | null>(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [displayChoice, setDisplayChoice] = useState<DisplayChoice>('default');
  const [customText, setCustomText] = useState('');
  const sessionTokenRef = useRef<string>('');

  const isMultiSelect = selectedAssetCount > 1;
  const initialDisplayChoice: DisplayChoice = isMultiSelect ? 'unchanged' : (currentDisplayMode ?? 'default');
  const initialCustomText = isMultiSelect ? '' : (currentCustomLabel ?? '');

  useEffect(() => {
    if (!open) {
      return;
    }

    sessionTokenRef.current = crypto.randomUUID();
    setMode('set');
    setQuery('');
    setPredictions([]);
    setSelectedPlace(null);
    setSavePending(false);
    setSaveError(null);
    setDisplayChoice(initialDisplayChoice);
    setCustomText(initialCustomText);
    // Reset only when the dialog opens; the initial values are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced autocomplete search as the user types.
  useEffect(() => {
    if (!open || mode !== 'set' || query.trim().length === 0 || selectedPlace) {
      setPredictions([]);
      return;
    }

    let cancelled = false;
    setPredictionsLoading(true);
    const timer = setTimeout(() => {
      void autocompletePlace(query, sessionTokenRef.current)
        .then((results) => {
          if (!cancelled) {
            setPredictions(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPredictions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPredictionsLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, mode, query, selectedPlace]);

  const helperText = useMemo(() => {
    if (selectedAssetCount === 1) {
      return 'Search for a place, choose what the Location field shows, or both.';
    }

    return `Search for a place, choose what the Location field shows, or both — applies to all ${selectedAssetCount} selected photos.`;
  }, [selectedAssetCount]);

  if (!open) {
    return null;
  }

  async function handleSelectPrediction(prediction: PlacePrediction): Promise<void> {
    setResolvingPlace(true);
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
    } finally {
      setResolvingPlace(false);
    }
  }

  function handleQueryChange(value: string): void {
    setQuery(value);
    if (selectedPlace) {
      // Typing again after a selection starts a new search.
      setSelectedPlace(null);
    }
  }

  const previewFields: LocationDisplayFields | null = selectedPlace ?? currentLocation;
  const previewFor = (displayMode: LocationDisplayMode): string | null =>
    previewFields ? formatLocationForDisplay(previewFields, displayMode) : null;

  function handleChooseCustom(): void {
    setDisplayChoice('custom');
    if (customText.trim().length === 0) {
      // Start from the text picked in search (or what's shown now) so it can be edited.
      setCustomText(selectedPlace ? query : (existingLocationLabel ?? ''));
    }
  }

  const displayChanged =
    displayChoice !== initialDisplayChoice ||
    (displayChoice === 'custom' && customText.trim() !== initialCustomText.trim());
  const customTextValid = displayChoice !== 'custom' || customText.trim().length > 0;
  const canSave =
    !savePending && (mode === 'clear' || ((selectedPlace !== null || displayChanged) && customTextValid));

  function renderDisplayOption(choice: DisplayChoice, label: string, preview: string | null): ReactElement {
    return (
      <label key={choice} style={displayOptionStyle}>
        <input
          type="radio"
          name="location-display"
          checked={displayChoice === choice}
          onChange={() => setDisplayChoice(choice)}
        />
        <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
        {preview ? <span style={displayPreviewStyle}>{preview}</span> : null}
      </label>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Set Location</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>{helperText}</p>
        </div>

        <div style={bodyStyle}>
          {existingLocationLabel ? (
            <p style={helperTextStyle}>
              Current: <strong>{existingLocationLabel}</strong>
            </p>
          ) : null}

          <div style={radioGroupStyle}>
            <label style={radioOptionStyle}>
              <input
                type="radio"
                name="location-mode"
                checked={mode === 'set'}
                onChange={() => setMode('set')}
              />
              <span>Set location</span>
            </label>
            <label style={radioOptionStyle}>
              <input
                type="radio"
                name="location-mode"
                checked={mode === 'clear'}
                onChange={() => setMode('clear')}
              />
              <span>Clear location</span>
            </label>
          </div>

          {mode === 'set' ? (
            <>
              <label style={fieldLabelStyle}>
                <span>Place</span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
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
                  {joinPlace(selectedPlace.city, selectedPlace.state, selectedPlace.country) ? (
                    <span style={{ fontSize: '12px', color: '#374151' }}>
                      {joinPlace(selectedPlace.city, selectedPlace.state, selectedPlace.country)}
                    </span>
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
              ) : predictionsLoading || resolvingPlace ? (
                <p style={helperTextStyle}>{resolvingPlace ? 'Resolving place…' : 'Searching…'}</p>
              ) : null}

              {isMultiSelect && selectedPlace ? (
                <p style={helperTextStyle}>
                  Applies to all {selectedAssetCount} selected photos. Each photo gets the same place.
                </p>
              ) : null}

              <p style={sectionTitleStyle}>Show in Location field</p>
              <div style={radioGroupStyle}>
                {isMultiSelect ? renderDisplayOption('unchanged', 'Leave each photo as it is', null) : null}
                {renderDisplayOption(
                  'default',
                  `Default (${inheritedDisplaySource}: ${locationDisplayModeLabels[inheritedDisplayMode]})`,
                  null
                )}
                {locationDisplayModes.map((displayMode) =>
                  renderDisplayOption(displayMode, locationDisplayModeLabels[displayMode], previewFor(displayMode))
                )}
                <label style={displayOptionStyle}>
                  <input
                    type="radio"
                    name="location-display"
                    checked={displayChoice === 'custom'}
                    onChange={handleChooseCustom}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>Custom text</span>
                </label>
                {displayChoice === 'custom' ? (
                  <input
                    type="text"
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value)}
                    placeholder="e.g. Garrapata State Park, Carmel, CA"
                    style={inputStyle}
                    autoFocus
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              <p style={helperTextStyle}>The selected photo{isMultiSelect ? 's' : ''} will have no location.</p>
              <p style={helperTextStyle}>They will show &ldquo;Location: —&rdquo; in the Inspector.</p>
            </div>
          )}

          {saveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{saveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={buttonStyle} onClick={onClose} disabled={savePending}>
            Cancel
          </button>
          <button
            type="button"
            style={canSave ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canSave}
            onClick={() => {
              setSavePending(true);
              setSaveError(null);
              const input: { clear: true } | SetLocationSaveInput =
                mode === 'clear'
                  ? { clear: true }
                  : {
                      place: selectedPlace,
                      ...(displayChanged && displayChoice !== 'unchanged'
                        ? {
                            display: {
                              mode: displayChoice === 'default' ? null : displayChoice,
                              customLocationLabel: displayChoice === 'custom' ? customText.trim() : null
                            }
                          }
                        : {})
                    };
              void onSave(input)
                .catch((error: unknown) => {
                  setSaveError(error instanceof Error ? error.message : 'Failed to update location.');
                })
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
