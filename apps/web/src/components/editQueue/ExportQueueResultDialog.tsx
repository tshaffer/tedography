import type { CSSProperties, ReactElement } from 'react';
import CircularProgress from '@mui/material/CircularProgress';

interface ExportQueueResultDialogProps {
  open: boolean;
  exporting: boolean;
  notice: string | null;
  error: string | null;
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1400,
};

const dialogStyle: CSSProperties = {
  width: 'min(420px, 92vw)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px',
  borderBottom: '1px solid #ececec',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 600,
  color: '#1f2937',
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
};

const progressBodyStyle: CSSProperties = {
  ...bodyStyle,
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.5,
};

const footerStyle: CSSProperties = {
  padding: '12px 18px',
  borderTop: '1px solid #ececec',
  display: 'flex',
  justifyContent: 'flex-end',
};

const okButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 500,
};

export function ExportQueueResultDialog({
  open,
  exporting,
  notice,
  error,
  onClose,
}: ExportQueueResultDialogProps): ReactElement | null {
  if (!open) return null;

  function handleOverlayClick(): void {
    if (!exporting) onClose();
  }

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            {exporting ? 'Exporting Queue' : error ? 'Export Failed' : 'Export Complete'}
          </h2>
        </div>
        {exporting ? (
          <div style={progressBodyStyle}>
            <CircularProgress size={22} thickness={4.5} />
            <p style={messageStyle}>Copying files to the edit folder…</p>
          </div>
        ) : (
          <div style={bodyStyle}>
            <p style={{ ...messageStyle, color: error ? '#b00020' : '#2f6f3e' }}>
              {error ?? notice}
            </p>
          </div>
        )}
        {!exporting ? (
          <div style={footerStyle}>
            <button type="button" style={okButtonStyle} onClick={onClose} autoFocus>OK</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
