import { useState, type CSSProperties, type ReactElement } from 'react';

interface AddToAiQueueDialogProps {
  open: boolean;
  assetFilename: string;
  existingPrompt?: string;
  onClose: () => void;
  onConfirm: (prompt: string) => void;
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
  width: 'min(480px, 92vw)',
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

const filenameStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '13px',
  color: '#6b7280',
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '80px',
  padding: '8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

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

export function AddToAiQueueDialog({
  open,
  assetFilename,
  existingPrompt,
  onClose,
  onConfirm,
}: AddToAiQueueDialogProps): ReactElement | null {
  const [prompt, setPrompt] = useState(existingPrompt ?? '');

  if (!open) return null;

  function handleConfirm(): void {
    onConfirm(prompt.trim());
    onClose();
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Add to AI Edit Queue</h2>
          <p style={filenameStyle}>{assetFilename}</p>
        </div>
        <div style={bodyStyle}>
          <label style={labelStyle}>
            Prompt (optional)
          </label>
          <textarea
            style={textareaStyle}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. make the sky more dramatic, black and white high contrast…"
            autoFocus
          />
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
            Leave blank to queue without a specific editing prompt.
          </p>
        </div>
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onClose}>Cancel</button>
          <button type="button" style={confirmButtonStyle} onClick={handleConfirm}>Add to Queue</button>
        </div>
      </div>
    </div>
  );
}
