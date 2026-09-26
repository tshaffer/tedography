import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { locationDisplayModes, type LocationDisplayMode } from '@tedography/domain';
import { locationDisplayModeLabels } from '../../utilities/locationDisplay';

interface AlbumLocationDisplayDialogProps {
  open: boolean;
  albumLabel: string;
  /** The album's own choice; null = follows the global default. */
  currentMode: LocationDisplayMode | null;
  globalMode: LocationDisplayMode;
  onClose: () => void;
  onSave: (mode: LocationDisplayMode | null) => Promise<void>;
}

const modeExamples: Record<LocationDisplayMode, string> = {
  placeName: 'Garrapata State Park',
  placeNameAndCity: 'Garrapata State Park, Carmel, California',
  address: '34500 CA-1, Carmel, CA 93923, USA',
  cityStateCountry: 'Carmel, California, United States'
};

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
  width: 'min(460px, 92vw)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = { padding: '16px 18px 12px', borderBottom: '1px solid #ececec' };
const bodyStyle: CSSProperties = { padding: '16px 18px', display: 'grid', gap: '12px' };
const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};
const optionStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#333' };
const exampleStyle: CSSProperties = { display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '2px' };
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

export function AlbumLocationDisplayDialog({
  open,
  albumLabel,
  currentMode,
  globalMode,
  onClose,
  onSave
}: AlbumLocationDisplayDialogProps): ReactElement | null {
  const [choice, setChoice] = useState<LocationDisplayMode | null>(currentMode);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChoice(currentMode);
      setSavePending(false);
      setSaveError(null);
    }
  }, [open, currentMode]);

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Location Display</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#666' }}>{albumLabel}</p>
        </div>

        <div style={bodyStyle}>
          <p style={helperTextStyle}>
            What the Location field shows for photos in this album. A photo&apos;s own choice (Set Location) still wins.
            When a photo lacks the chosen piece (e.g. no place name), the next best one is shown.
          </p>
          <label style={optionStyle}>
            <input type="radio" name="album-location-display" checked={choice === null} onChange={() => setChoice(null)} />
            <span>
              Global default ({locationDisplayModeLabels[globalMode]})
              <span style={exampleStyle}>Set in Display Options</span>
            </span>
          </label>
          {locationDisplayModes.map((mode) => (
            <label key={mode} style={optionStyle}>
              <input
                type="radio"
                name="album-location-display"
                checked={choice === mode}
                onChange={() => setChoice(mode)}
              />
              <span>
                {locationDisplayModeLabels[mode]}
                <span style={exampleStyle}>e.g. {modeExamples[mode]}</span>
              </span>
            </label>
          ))}
          {saveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{saveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={buttonStyle} onClick={onClose} disabled={savePending}>
            Cancel
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={savePending}
            onClick={() => {
              setSavePending(true);
              setSaveError(null);
              void onSave(choice)
                .catch((error: unknown) => {
                  setSaveError(error instanceof Error ? error.message : 'Failed to update location display.');
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
