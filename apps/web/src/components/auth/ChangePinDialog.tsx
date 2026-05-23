import { useState, type CSSProperties } from 'react';
import { changePin } from '../../api/authApi';

interface ChangePinDialogProps {
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1300,
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  padding: '24px 28px',
  minWidth: 320,
  maxWidth: 400,
  width: '100%',
};

const titleStyle: CSSProperties = {
  margin: '0 0 18px',
  fontSize: 16,
  fontWeight: 600,
  color: '#0f172a',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
};

const inputStyle: CSSProperties = {
  fontSize: 14,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#0f172a',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const errorStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: '#b91c1c',
};

const successStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: '#15803d',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 20,
  borderTop: '1px solid #e5e7eb',
  paddingTop: 14,
};

const cancelButtonStyle: CSSProperties = {
  padding: '6px 18px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
};

const saveButtonStyle: CSSProperties = {
  padding: '6px 18px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const saveButtonDisabledStyle: CSSProperties = {
  ...saveButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};

export function ChangePinDialog({ onClose }: ChangePinDialogProps): React.ReactElement {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mismatch = confirmPin.length > 0 && newPin !== confirmPin;
  const tooShort = newPin.length > 0 && newPin.length < 4;
  const canSubmit = !busy && currentPin.trim().length > 0 && newPin.length >= 4 && newPin === confirmPin;

  async function handleSave(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await changePin(currentPin, newPin);
      setSuccess(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change PIN');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>Change PIN</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Current PIN</label>
          <input
            type="password"
            style={inputStyle}
            value={currentPin}
            disabled={busy}
            autoFocus
            onChange={(e) => setCurrentPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void handleSave(); }}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>New PIN</label>
          <input
            type="password"
            style={inputStyle}
            value={newPin}
            disabled={busy}
            onChange={(e) => setNewPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void handleSave(); }}
          />
          {tooShort ? <span style={errorStyle}>PIN must be at least 4 characters</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm New PIN</label>
          <input
            type="password"
            style={inputStyle}
            value={confirmPin}
            disabled={busy}
            onChange={(e) => setConfirmPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void handleSave(); }}
          />
          {mismatch ? <span style={errorStyle}>PINs do not match</span> : null}
        </div>

        {error ? <p style={errorStyle}>{error}</p> : null}
        {success ? <p style={successStyle}>PIN changed successfully.</p> : null}

        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onClose}>
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success ? (
            <button
              type="button"
              style={canSubmit ? saveButtonStyle : saveButtonDisabledStyle}
              disabled={!canSubmit}
              onClick={() => void handleSave()}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
