import type { CSSProperties, ReactElement } from 'react';
import type { AiQueueEntryWithFilename } from '../../api/aiQueueApi.js';

interface AiQueueDialogProps {
  open: boolean;
  entries: AiQueueEntryWithFilename[];
  loading: boolean;
  error: string | null;
  exportNotice: string | null;
  exportError: string | null;
  onClose: () => void;
  onRemove: (assetId: string) => void;
  onExport: () => void;
  onClear: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1300,
};

const dialogStyle: CSSProperties = {
  width: 'min(520px, 92vw)',
  maxHeight: '80vh',
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 600,
  color: '#1f2937',
};

const closeButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: '20px',
  padding: '0 2px',
  lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
  overflowY: 'auto',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const entryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#fafafa',
  fontSize: '12px',
};

const footerStyle: CSSProperties = {
  padding: '12px 18px',
  borderTop: '1px solid #ececec',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
};

const actionButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
};

const disabledButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  opacity: 0.5,
  cursor: 'default',
};

export function AiQueueDialog({
  open,
  entries,
  loading,
  error,
  exportNotice,
  exportError,
  onClose,
  onRemove,
  onExport,
  onClear,
}: AiQueueDialogProps): ReactElement | null {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            AI Edit Queue{entries.length > 0 ? ` (${entries.length})` : ''}
          </h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={bodyStyle}>
          {loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading...</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{error}</p>
          ) : entries.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>Queue is empty.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.assetId} style={entryStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1f2937' }}>
                    {entry.filename}
                  </span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '0 2px', flexShrink: 0 }}
                    onClick={() => onRemove(entry.assetId)}
                    title="Remove from queue"
                  >
                    ×
                  </button>
                </div>
                {entry.prompt ? (
                  <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '11px' }}>{entry.prompt}</span>
                ) : (
                  <span style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '11px' }}>no prompt</span>
                )}
              </div>
            ))
          )}
        </div>
        <div style={footerStyle}>
          <button
            type="button"
            style={entries.length === 0 ? disabledButtonStyle : actionButtonStyle}
            onClick={onExport}
            disabled={entries.length === 0}
            title="Copy files to export folder and write prompts.txt"
          >
            Export Queue
          </button>
          <button
            type="button"
            style={entries.length === 0 ? disabledButtonStyle : actionButtonStyle}
            onClick={onClear}
            disabled={entries.length === 0}
          >
            Clear
          </button>
          {exportNotice ? (
            <span style={{ fontSize: '12px', color: '#2f6f3e' }}>{exportNotice}</span>
          ) : null}
          {exportError ? (
            <span style={{ fontSize: '12px', color: '#b00020' }}>{exportError}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
