import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import type { EditedFileCandidate, EditMethod } from '../../api/editQueueApi.js';

interface ClassifyEditedFilesDialogProps {
  open: boolean;
  candidates: EditedFileCandidate[];
  committing: boolean;
  onCancel: () => void;
  onConfirm: (files: { filename: string; editMethod: EditMethod }[]) => void;
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
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 600,
  color: '#1f2937',
};

const subtitleStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: '#6b7280',
};

const bodyStyle: CSSProperties = {
  padding: '12px 18px',
  overflowY: 'auto',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const batchRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '8px 10px',
  borderRadius: '8px',
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '6px 2px',
};

const filenameColStyle: CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
};

const filenameStyle: CSSProperties = {
  fontSize: '13px',
  color: '#1f2937',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const sourceFilenameStyle: CSSProperties = {
  fontSize: '11px',
  color: '#9ca3af',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const segStyle: CSSProperties = {
  display: 'flex',
  borderRadius: '4px',
  overflow: 'hidden',
  border: '1px solid #c8c8c8',
  flexShrink: 0,
};

function segButtonStyle(active: boolean, isFirst: boolean): CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: active ? 700 : 400,
    backgroundColor: active ? '#dbeafe' : '#f9f9f9',
    color: active ? '#1d4ed8' : '#555',
    border: 'none',
    cursor: 'pointer',
    borderRight: isFirst ? '1px solid #c8c8c8' : 'none',
  };
}

const footerStyle: CSSProperties = {
  padding: '12px 18px',
  borderTop: '1px solid #ececec',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
};

const cancelButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
};

const confirmButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 500,
};

const disabledButtonStyle: CSSProperties = {
  ...confirmButtonStyle,
  opacity: 0.5,
  cursor: 'default',
};

export function ClassifyEditedFilesDialog({
  open,
  candidates,
  committing,
  onCancel,
  onConfirm,
}: ClassifyEditedFilesDialogProps): ReactElement | null {
  const [methodByFilename, setMethodByFilename] = useState<Record<string, EditMethod>>({});

  useEffect(() => {
    if (!open) return;
    setMethodByFilename(
      Object.fromEntries(candidates.map((c) => [c.filename, 'manual' as EditMethod]))
    );
  }, [open, candidates]);

  if (!open) return null;

  function setAll(method: EditMethod): void {
    setMethodByFilename(Object.fromEntries(candidates.map((c) => [c.filename, method])));
  }

  function setOne(filename: string, method: EditMethod): void {
    setMethodByFilename((prev) => ({ ...prev, [filename]: method }));
  }

  function handleConfirm(): void {
    onConfirm(candidates.map((c) => ({ filename: c.filename, editMethod: methodByFilename[c.filename] ?? 'manual' })));
  }

  return (
    <div style={overlayStyle} onClick={committing ? undefined : onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Classify Edited Files ({candidates.length})</h2>
          <p style={subtitleStyle}>How was each edit produced? This is recorded per photo and can be changed later.</p>
        </div>
        <div style={bodyStyle}>
          <div style={batchRowStyle}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#2d3748' }}>Set all to</span>
            <div style={segStyle}>
              <button type="button" style={segButtonStyle(false, true)} onClick={() => setAll('manual')}>Manual</button>
              <button type="button" style={segButtonStyle(false, false)} onClick={() => setAll('ai')}>AI</button>
            </div>
          </div>
          {candidates.map((c) => {
            const method = methodByFilename[c.filename] ?? 'manual';
            return (
              <div key={c.filename} style={rowStyle}>
                <div style={filenameColStyle}>
                  <span style={filenameStyle}>{c.filename}</span>
                  <span style={sourceFilenameStyle}>from {c.sourceFilename}</span>
                </div>
                <div style={segStyle}>
                  <button
                    type="button"
                    style={segButtonStyle(method === 'manual', true)}
                    onClick={() => setOne(c.filename, 'manual')}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    style={segButtonStyle(method === 'ai', false)}
                    onClick={() => setOne(c.filename, 'ai')}
                  >
                    AI
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onCancel} disabled={committing}>Cancel</button>
          <button
            type="button"
            style={committing ? disabledButtonStyle : confirmButtonStyle}
            onClick={handleConfirm}
            disabled={committing}
          >
            {committing ? 'Importing…' : `Confirm Import (${candidates.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
