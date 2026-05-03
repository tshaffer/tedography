import { useState, type CSSProperties } from 'react';
import type { MediaAsset } from '@tedography/domain';

interface AiImageEditPanelProps {
  asset: MediaAsset | null;
  onEditComplete: (updatedAsset: MediaAsset, backupPath: string) => void;
  onEditRequest: (assetId: string, prompt: string) => Promise<{ asset: MediaAsset; backupPath: string }>;
}

const panelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '8px',
  backgroundColor: '#fff'
};

const titleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: '8px',
  fontSize: '14px'
};

const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '12px',
  padding: '6px 8px',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  resize: 'vertical',
  minHeight: '64px',
  fontFamily: 'inherit',
  lineHeight: 1.4,
  marginBottom: '6px',
};

const buttonStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  backgroundColor: '#f4f4f4',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px',
};

const busyButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed',
};

const statusStyle = (isError: boolean): CSSProperties => ({
  marginTop: '6px',
  fontSize: '12px',
  color: isError ? '#b00020' : '#136f2d',
  wordBreak: 'break-word',
});

const emptyStyle: CSSProperties = {
  margin: 0,
  color: '#666',
  fontSize: '13px',
};

const SUPPORTED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function AiImageEditPanel({ asset, onEditComplete, onEditRequest }: AiImageEditPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!asset) {
    return (
      <section style={panelStyle}>
        <h3 style={titleStyle}>AI Image Edit</h3>
        <p style={emptyStyle}>Select a photo to use AI editing.</p>
      </section>
    );
  }

  const fmt = asset.originalFileFormat.toLowerCase();
  const unsupported = !SUPPORTED_FORMATS.has(fmt);

  async function handleSubmit(): Promise<void> {
    if (!asset || busy || !prompt.trim()) {
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const result = await onEditRequest(asset.id, prompt.trim());
      setPrompt('');
      setStatusMessage(`Edit applied. Backup saved at: ${result.backupPath}`);
      setIsError(false);
      onEditComplete(result.asset, result.backupPath);
    } catch (error) {
      setIsError(true);
      setStatusMessage(error instanceof Error ? error.message : 'Edit failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={panelStyle}>
      <h3 style={titleStyle}>AI Image Edit</h3>
      {unsupported ? (
        <p style={{ ...emptyStyle, color: '#888' }}>
          AI editing supports JPEG, PNG, and WebP. This asset is {asset.originalFileFormat.toUpperCase()}.
        </p>
      ) : (
        <>
          <textarea
            style={textareaStyle}
            placeholder={'Describe the edit, e.g. "Remove the telephone pole in the background"'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                void handleSubmit();
              }
            }}
          />
          <button
            type="button"
            style={busy || !prompt.trim() ? busyButtonStyle : buttonStyle}
            disabled={busy || !prompt.trim()}
            onClick={() => void handleSubmit()}
          >
            {busy ? 'Editing…' : 'Edit with AI'}
          </button>
          {statusMessage ? (
            <p style={statusStyle(isError)}>{statusMessage}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
