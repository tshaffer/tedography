import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import {
  disconnectGooglePhotos,
  getGooglePhotosAuthUrl,
  getGooglePhotosStatus,
  publishToGooglePhotos,
  type PublishResult,
} from '../../api/googlePhotosApi';

export interface PublishToGooglePhotosDialogProps {
  open: boolean;
  selectedAssetIds: string[];
  visibleAssetIds: string[];
  onClose: () => void;
}

type Phase =
  | 'loading'
  | 'not-configured'
  | 'not-connected'
  | 'ready'
  | 'publishing'
  | 'done'
  | 'error';

type Source = 'selected' | 'view';
type UploadVersion = 'original' | 'display';

// ─── Styles ──────────────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1300,
};

const dialogStyle: CSSProperties = {
  width: 'min(520px, 94vw)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  maxHeight: '90vh',
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
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  overflowY: 'auto',
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  display: 'block',
  marginBottom: '4px',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const radioGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const radioLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#374151',
  cursor: 'pointer',
};

const footerStyle: CSSProperties = {
  padding: '12px 18px',
  borderTop: '1px solid #ececec',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  alignItems: 'center',
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

const primaryButtonStyle: CSSProperties = {
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
  ...primaryButtonStyle,
  opacity: 0.5,
  cursor: 'default',
};

const infoBoxStyle: CSSProperties = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  color: '#0c4a6e',
  lineHeight: 1.5,
};

const errorBoxStyle: CSSProperties = {
  ...infoBoxStyle,
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#7f1d1d',
};

const successBoxStyle: CSSProperties = {
  ...infoBoxStyle,
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#14532d',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PublishToGooglePhotosDialog({
  open,
  selectedAssetIds,
  visibleAssetIds,
  onClose,
}: PublishToGooglePhotosDialogProps): ReactElement | null {
  const [phase, setPhase] = useState<Phase>('loading');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [source, setSource] = useState<Source>('selected');
  const [uploadVersion, setUploadVersion] = useState<UploadVersion>('original');
  const [result, setResult] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase('loading');
    setStatusError(null);
    setResult(null);
    setPublishError(null);
    getGooglePhotosStatus()
      .then((status) => {
        if (!status.configured) {
          setPhase('not-configured');
        } else if (!status.connected) {
          setPhase('not-connected');
        } else {
          setConnectedEmail(status.email);
          setPhase('ready');
        }
      })
      .catch((err: unknown) => {
        setStatusError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      });
  }, [open]);

  // Default source when selected count changes
  useEffect(() => {
    if (selectedAssetIds.length === 0 && source === 'selected') {
      setSource('view');
    }
  }, [selectedAssetIds.length, source]);

  if (!open) return null;

  const assetIdsForPublish = source === 'selected' ? selectedAssetIds : visibleAssetIds;
  const canPublish =
    phase === 'ready' &&
    albumTitle.trim().length > 0 &&
    assetIdsForPublish.length > 0;

  async function handleConnect(): Promise<void> {
    try {
      const { authUrl } = await getGooglePhotosAuthUrl();
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  async function handleCheckConnection(): Promise<void> {
    setPhase('loading');
    try {
      const status = await getGooglePhotosStatus();
      if (status.connected) {
        setConnectedEmail(status.email);
        setPhase('ready');
      } else {
        setPhase('not-connected');
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  async function handleDisconnect(): Promise<void> {
    await disconnectGooglePhotos();
    setPhase('not-connected');
  }

  async function handlePublish(): Promise<void> {
    setPhase('publishing');
    setPublishError(null);
    try {
      const res = await publishToGooglePhotos({
        assetIds: assetIdsForPublish,
        albumTitle: albumTitle.trim(),
        uploadVersion,
      });
      setResult(res);
      setPhase('done');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function renderBody(): ReactElement {
    if (phase === 'loading') {
      return <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Checking connection…</p>;
    }

    if (phase === 'not-configured') {
      return (
        <div style={infoBoxStyle}>
          <strong>Google Photos credentials are not configured.</strong>
          <br />
          Add <code>GOOGLE_PHOTOS_CLIENT_ID</code> and <code>GOOGLE_PHOTOS_CLIENT_SECRET</code> to{' '}
          <code>apps/api/.env</code>, then restart the API.
        </div>
      );
    }

    if (phase === 'not-connected') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
            Connect your Google account to publish photos to Google Photos.
          </p>
          <div>
            <button type="button" style={primaryButtonStyle} onClick={() => void handleConnect()}>
              Connect Google Photos…
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
            A browser window will open for Google sign-in. After authorizing, click{' '}
            <strong>Check Connection</strong> below.
          </p>
          <div>
            <button type="button" style={cancelButtonStyle} onClick={() => void handleCheckConnection()}>
              Check Connection
            </button>
          </div>
        </div>
      );
    }

    if (phase === 'publishing') {
      return (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          Uploading {assetIdsForPublish.length} photo{assetIdsForPublish.length !== 1 ? 's' : ''}…
        </p>
      );
    }

    if (phase === 'done' && result) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={successBoxStyle}>
            <strong>{result.uploadedCount}</strong> photo{result.uploadedCount !== 1 ? 's' : ''} published to{' '}
            <strong>{result.albumTitle}</strong>.
            {result.errorCount > 0 && (
              <> ({result.errorCount} error{result.errorCount !== 1 ? 's' : ''}.)</>
            )}
          </div>
          {result.albumUrl && (
            <div>
              <a href={result.albumUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563eb' }}>
                Open album in Google Photos ↗
              </a>
            </div>
          )}
          <div style={infoBoxStyle}>
            To share this album, open it in Google Photos and use the Share button there.
          </div>
          {result.errors.length > 0 && (
            <details style={{ fontSize: '12px', color: '#6b7280' }}>
              <summary style={{ cursor: 'pointer' }}>Show errors ({result.errors.length})</summary>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {result.errors.map((e, i) => (
                  <li key={i}>{e.filename}: {e.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    }

    if (phase === 'error') {
      return (
        <div style={errorBoxStyle}>
          {statusError ?? publishError ?? 'An unknown error occurred.'}
        </div>
      );
    }

    // phase === 'ready'
    return (
      <>
        <div>
          <label style={labelStyle} htmlFor="gp-album-title">Album title</label>
          <input
            id="gp-album-title"
            style={inputStyle}
            type="text"
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder="e.g. Australia 2025"
            autoFocus
          />
        </div>

        <div>
          <span style={labelStyle}>Source</span>
          <div style={radioGroupStyle}>
            <label style={{
              ...radioLabelStyle,
              opacity: selectedAssetIds.length === 0 ? 0.4 : 1,
              cursor: selectedAssetIds.length === 0 ? 'not-allowed' : 'pointer',
            }}>
              <input
                type="radio"
                name="gp-source"
                value="selected"
                checked={source === 'selected'}
                disabled={selectedAssetIds.length === 0}
                onChange={() => setSource('selected')}
              />
              Selected assets ({selectedAssetIds.length})
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="gp-source"
                value="view"
                checked={source === 'view'}
                onChange={() => setSource('view')}
              />
              Current view ({visibleAssetIds.length})
            </label>
          </div>
        </div>

        <div>
          <span style={labelStyle}>Upload version</span>
          <div style={radioGroupStyle}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="gp-version"
                value="original"
                checked={uploadVersion === 'original'}
                onChange={() => setUploadVersion('original')}
              />
              Original (HEIC originals fall back to display JPEG)
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="gp-version"
                value="display"
                checked={uploadVersion === 'display'}
                onChange={() => setUploadVersion('display')}
              />
              Display JPEG (always)
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#374151' }}>
              Connected as <strong>{connectedEmail ?? 'Google account'}</strong>
            </span>
          </div>
          <button
            type="button"
            style={{ ...cancelButtonStyle, padding: '4px 10px', fontSize: '12px' }}
            onClick={() => void handleDisconnect()}
          >
            Switch account
          </button>
        </div>
      </>
    );
  }

  function renderFooter(): ReactElement {
    if (phase === 'done' || phase === 'not-configured' || phase === 'not-connected') {
      return (
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onClose}>Close</button>
        </div>
      );
    }

    if (phase === 'error') {
      return (
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onClose}>Close</button>
        </div>
      );
    }

    if (phase === 'publishing' || phase === 'loading') {
      return (
        <div style={footerStyle}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Please wait…</span>
        </div>
      );
    }

    // ready
    return (
      <div style={footerStyle}>
        <button type="button" style={cancelButtonStyle} onClick={onClose}>Cancel</button>
        <button
          type="button"
          style={canPublish ? primaryButtonStyle : disabledButtonStyle}
          disabled={!canPublish}
          onClick={() => void handlePublish()}
        >
          Publish
        </button>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Publish to Google Photos</h2>
        </div>
        <div style={bodyStyle}>{renderBody()}</div>
        {renderFooter()}
      </div>
    </div>
  );
}
