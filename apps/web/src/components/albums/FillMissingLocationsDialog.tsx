import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { getAlbumLocationSuggestions, type AlbumLocationSuggestionResult } from '../../api/locationSuggestionApi';
import { updateAssetsLocation, type SetAssetsLocationRequest } from '../../api/assetApi';

interface FillMissingLocationsDialogProps {
  open: boolean;
  albumId: string;
  albumLabel: string;
  onClose: () => void;
  onApplied: (assetIds: string[]) => void;
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
  width: 'min(560px, 92vw)',
  maxHeight: 'min(640px, 90vh)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = { padding: '16px 18px 12px', borderBottom: '1px solid #ececec' };
const bodyStyle: CSSProperties = { padding: '4px 18px', overflow: 'auto', flex: 1 };
const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 0',
  borderBottom: '1px solid #f0f0f0'
};
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
const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1d4ed8',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0
};

function suggestionPlace(suggestion: AlbumLocationSuggestionResult['suggestion']): string {
  if (!suggestion) return '';
  const parts = [suggestion.city, suggestion.state, suggestion.country].filter(
    (value): value is string => Boolean(value && value.trim())
  );
  return parts.length > 0 ? parts.join(', ') : (suggestion.locationLabel ?? '');
}

export function FillMissingLocationsDialog({
  open,
  albumId,
  albumLabel,
  onClose,
  onApplied
}: FillMissingLocationsDialogProps): ReactElement | null {
  const [results, setResults] = useState<AlbumLocationSuggestionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingAssetIds, setApplyingAssetIds] = useState<Set<string>>(new Set());
  const [appliedAssetIds, setAppliedAssetIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoading(true);
    setError(null);
    setAppliedAssetIds(new Set());
    void getAlbumLocationSuggestions(albumId)
      .then(setResults)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to scan album for missing locations.'))
      .finally(() => setLoading(false));
  }, [open, albumId]);

  if (!open) {
    return null;
  }

  const matched = results.filter((result) => result.suggestion !== null && !appliedAssetIds.has(result.assetId));
  const unmatched = results.filter((result) => result.suggestion === null);

  function buildRequest(result: AlbumLocationSuggestionResult): SetAssetsLocationRequest | null {
    if (!result.suggestion) return null;
    return {
      assetIds: [result.assetId],
      locationLabel: result.suggestion.locationLabel,
      city: result.suggestion.city,
      state: result.suggestion.state,
      country: result.suggestion.country,
      locationLatitude: result.suggestion.locationLatitude,
      locationLongitude: result.suggestion.locationLongitude,
      source: 'inherited'
    };
  }

  async function applyOne(result: AlbumLocationSuggestionResult): Promise<void> {
    const request = buildRequest(result);
    if (!request) return;
    setApplyingAssetIds((prev) => new Set(prev).add(result.assetId));
    setError(null);
    try {
      await updateAssetsLocation(request);
      setAppliedAssetIds((prev) => new Set(prev).add(result.assetId));
      onApplied([result.assetId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply location.');
    } finally {
      setApplyingAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(result.assetId);
        return next;
      });
    }
  }

  async function applyAll(): Promise<void> {
    setError(null);
    const toApply = matched;
    setApplyingAssetIds(new Set(toApply.map((result) => result.assetId)));
    const succeeded: string[] = [];
    for (const result of toApply) {
      const request = buildRequest(result);
      if (!request) continue;
      try {
        await updateAssetsLocation(request);
        succeeded.push(result.assetId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Some locations failed to apply — see remaining rows.');
      }
    }
    setAppliedAssetIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.add(id));
      return next;
    });
    setApplyingAssetIds(new Set());
    if (succeeded.length > 0) {
      onApplied(succeeded);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Fill Missing Locations</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#666' }}>
            {loading
              ? `Scanning ${albumLabel}…`
              : `${albumLabel} — ${results.length} photo${results.length === 1 ? '' : 's'} have no location, ${matched.length} have a nearby match within this album`}
          </p>
        </div>

        <div style={bodyStyle}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#666', padding: '12px 0' }}>Scanning…</p>
          ) : results.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666', padding: '12px 0' }}>
              Every photo in this album already has a location.
            </p>
          ) : (
            <>
              {results.map((result) => {
                const applied = appliedAssetIds.has(result.assetId);
                const applying = applyingAssetIds.has(result.assetId);
                return (
                  <div key={result.assetId} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{result.filename}</div>
                      {result.suggestion ? (
                        <>
                          <div style={{ fontSize: '12px', color: applied ? '#059669' : '#059669' }}>
                            ● {suggestionPlace(result.suggestion)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                            from {result.suggestion.sourceFilename}
                            {result.suggestion.minutesApart != null ? ` — ${result.suggestion.minutesApart} min apart` : ''}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>No nearby match found</div>
                      )}
                    </div>
                    {result.suggestion ? (
                      <button
                        type="button"
                        style={linkButtonStyle}
                        disabled={applied || applying}
                        onClick={() => void applyOne(result)}
                      >
                        {applied ? 'Applied' : applying ? 'Applying…' : 'Apply'}
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {unmatched.length > 0 ? (
                <p style={{ fontSize: '11px', color: '#9ca3af', padding: '8px 0 4px' }}>
                  {unmatched.length} photo{unmatched.length === 1 ? '' : 's'} with no nearby match — set a location manually instead.
                </p>
              ) : null}
            </>
          )}
          {error ? <p style={{ margin: '8px 0', color: '#b00020', fontSize: '12px' }}>{error}</p> : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            style={matched.length > 0 ? primaryButtonStyle : disabledButtonStyle}
            disabled={matched.length === 0 || applyingAssetIds.size > 0}
            onClick={() => void applyAll()}
          >
            {applyingAssetIds.size > 0 ? 'Applying…' : `Apply All Matches (${matched.length})`}
          </button>
        </div>
      </section>
    </div>
  );
}
