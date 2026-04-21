import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';

type CaptureDateMode = 'set' | 'clear';

interface SetCaptureDateDialogProps {
  open: boolean;
  selectedAssetCount: number;
  initialCaptureDateTime?: string | null;
  onClose: () => void;
  onSave: (input: { captureDateTime?: string | null; captureDate?: string }) => Promise<void>;
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
  maxHeight: 'min(640px, 90vh)',
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
  gap: '14px'
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

const formRowStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: '1fr 1fr'
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

function toLocalInputParts(value: string | null | undefined): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
}

function combineLocalDateAndTime(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }

  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function SetCaptureDateDialog({
  open,
  selectedAssetCount,
  initialCaptureDateTime = null,
  onClose,
  onSave
}: SetCaptureDateDialogProps): ReactElement | null {
  const [mode, setMode] = useState<CaptureDateMode>('set');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isMultiSelect = selectedAssetCount > 1;

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextParts = toLocalInputParts(initialCaptureDateTime);
    setMode('set');
    setDateValue(nextParts.date);
    setTimeValue(nextParts.time);
    setSavePending(false);
    setSaveError(null);
  }, [initialCaptureDateTime, open]);

  const helperText = useMemo(() => {
    if (selectedAssetCount === 1) {
      return 'Update the capture date/time for the selected asset.';
    }

    return `Update the capture date for the ${selectedAssetCount} selected assets. Existing capture times will be preserved when available.`;
  }, [selectedAssetCount]);

  const nextCaptureDateTime =
    mode === 'clear'
      ? null
      : isMultiSelect
        ? null
        : combineLocalDateAndTime(dateValue, timeValue);
  const canSave = !savePending && (mode === 'clear' || (isMultiSelect ? dateValue.length > 0 : nextCaptureDateTime !== null));

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Set Capture Date</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>{helperText}</p>
        </div>

        <div style={bodyStyle}>
          <div style={radioGroupStyle}>
            <label style={radioOptionStyle}>
              <input
                type="radio"
                name="capture-date-mode"
                checked={mode === 'set'}
                onChange={() => setMode('set')}
              />
              <span>{isMultiSelect ? 'Set capture date' : 'Set capture date/time'}</span>
            </label>
            <label style={radioOptionStyle}>
              <input
                type="radio"
                name="capture-date-mode"
                checked={mode === 'clear'}
                onChange={() => setMode('clear')}
              />
              <span>Clear capture date/time</span>
            </label>
          </div>

          {mode === 'set' ? (
            <div style={isMultiSelect ? { display: 'grid', gap: '12px' } : formRowStyle}>
              <label style={fieldLabelStyle}>
                <span>Date</span>
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  style={inputStyle}
                />
              </label>
              {!isMultiSelect ? (
                <label style={fieldLabelStyle}>
                  <span>Time</span>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(event) => setTimeValue(event.target.value)}
                    style={inputStyle}
                  />
                </label>
              ) : (
                <p style={helperTextStyle}>
                  The time for each selected asset will stay the same when available. Assets without a current capture time will use 12:00 AM.
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              <p style={helperTextStyle}>The selected asset(s) will have no capture date/time.</p>
              <p style={helperTextStyle}>
                They will appear as &ldquo;Captured: Unknown&rdquo; and will no longer use capture-time ordering.
              </p>
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
              if (mode === 'set' && isMultiSelect && dateValue.length === 0) {
                setSaveError('Enter a date.');
                return;
              }

              const captureDateTime = mode === 'clear' ? null : nextCaptureDateTime;
              if (mode === 'set' && !isMultiSelect && captureDateTime === null) {
                setSaveError('Enter both a date and time.');
                return;
              }

              setSavePending(true);
              setSaveError(null);
              void onSave(
                mode === 'clear'
                  ? { captureDateTime: null }
                  : isMultiSelect
                    ? { captureDate: dateValue }
                    : { captureDateTime }
              )
                .catch((error: unknown) => {
                  setSaveError(error instanceof Error ? error.message : 'Failed to update capture date.');
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
