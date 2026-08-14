import { useState, type CSSProperties, type ReactElement } from 'react';
import { MediaType, type MediaAsset } from '@tedography/domain';
import { fetchExportedAssetBlob } from '../../api/assetApi';

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface ExportPhotosDialogProps {
  open: boolean;
  assetIds: string[];
  assetsById: Map<string, MediaAsset>;
  onClose: () => void;
}

type ExportFormat = 'jpeg' | 'png' | 'original';
type ExportStatus = 'exported' | 'skipped' | 'failed';

interface ExportResult {
  assetId: string;
  filename: string;
  status: ExportStatus;
  message?: string;
}

type Phase = 'idle' | 'exporting' | 'done';

// ─── Styles (mirrors PublishToGooglePhotosDialog.tsx) ────────────────────────

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

const summaryGridStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '12px',
  display: 'grid',
  gap: '4px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '10px 0 0 0',
  padding: 0,
  maxHeight: '280px',
  overflow: 'auto',
  border: '1px solid #ececec',
  borderRadius: '8px',
};

const listRowStyle: CSSProperties = {
  borderBottom: '1px solid #ececec',
  padding: '8px 10px',
  fontSize: '13px',
};

const statusColors: Record<ExportStatus, string> = {
  exported: '#166534',
  skipped: '#92400e',
  failed: '#b91c1c',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function extensionForExport(format: ExportFormat, asset: MediaAsset): string {
  if (format === 'jpeg') return 'jpg';
  if (format === 'png') return 'png';
  return (asset.originalFileFormat || 'jpg').toLowerCase();
}

function dedupeFilename(originalFilename: string, extension: string, usedCounts: Map<string, number>): string {
  const base = originalFilename.replace(/\.[^./]+$/, '');
  const key = `${base}.${extension}`;
  const count = usedCounts.get(key) ?? 0;
  usedCounts.set(key, count + 1);
  return count === 0 ? key : `${base} (${count + 1}).${extension}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExportPhotosDialog({ open, assetIds, assetsById, onClose }: ExportPhotosDialogProps): ReactElement | null {
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<ExportResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const supportsDirectoryPicker = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

  function handleClose(): void {
    setPhase('idle');
    setResults([]);
    setError(null);
    onClose();
  }

  async function handleChooseFolderAndExport(): Promise<void> {
    if (!window.showDirectoryPicker) return;

    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    setError(null);
    setPhase('exporting');
    const usedNames = new Map<string, number>();
    const nextResults: ExportResult[] = [];

    for (const assetId of assetIds) {
      const asset = assetsById.get(assetId);
      if (!asset || asset.mediaType !== MediaType.Photo) {
        nextResults.push({ assetId, filename: asset?.filename ?? assetId, status: 'skipped', message: 'Not a photo' });
        setResults([...nextResults]);
        continue;
      }

      try {
        const blob = await fetchExportedAssetBlob(assetId, format);
        const filename = dedupeFilename(asset.filename, extensionForExport(format, asset), usedNames);
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        nextResults.push({ assetId, filename, status: 'exported' });
      } catch (err) {
        nextResults.push({
          assetId,
          filename: asset.filename,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      setResults([...nextResults]);
    }

    setPhase('done');
  }

  const exportedCount = results.filter((r) => r.status === 'exported').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  function renderResultsList(): ReactElement {
    return (
      <>
        <div style={summaryGridStyle}>
          <span>Exported: {exportedCount}</span>
          <span>Skipped: {skippedCount}</span>
          <span>Failed: {failedCount}</span>
        </div>
        <ul style={listStyle}>
          {results.map((result) => (
            <li key={result.assetId} style={listRowStyle}>
              <strong>{result.filename}</strong>
              {' — '}
              <span style={{ color: statusColors[result.status] }}>{result.status}</span>
              {result.message ? <span style={{ color: '#6b7280' }}> ({result.message})</span> : null}
            </li>
          ))}
        </ul>
      </>
    );
  }

  function renderBody(): ReactElement {
    if (phase === 'exporting' || phase === 'done') {
      return (
        <>
          {phase === 'exporting' ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
              Exporting {assetIds.length} photo{assetIds.length !== 1 ? 's' : ''}…
            </p>
          ) : (
            <div style={infoBoxStyle}>Done.</div>
          )}
          {renderResultsList()}
        </>
      );
    }

    // idle
    return (
      <>
        {!supportsDirectoryPicker ? (
          <div style={errorBoxStyle}>Choosing a folder requires Chrome or Edge.</div>
        ) : null}
        {error ? <div style={errorBoxStyle}>{error}</div> : null}
        <div>
          <span style={labelStyle}>Format</span>
          <div style={radioGroupStyle}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="export-format"
                value="jpeg"
                checked={format === 'jpeg'}
                onChange={() => setFormat('jpeg')}
              />
              JPEG
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="export-format"
                value="png"
                checked={format === 'png'}
                onChange={() => setFormat('png')}
              />
              PNG
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="export-format"
                value="original"
                checked={format === 'original'}
                onChange={() => setFormat('original')}
              />
              Keep Original Format
            </label>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
          {assetIds.length} photo{assetIds.length !== 1 ? 's' : ''} selected. You'll be asked to choose a
          destination folder — files are converted and saved there directly.
        </p>
      </>
    );
  }

  function renderFooter(): ReactElement {
    if (phase === 'exporting') {
      return (
        <div style={footerStyle}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Please wait…</span>
        </div>
      );
    }

    if (phase === 'done') {
      return (
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={handleClose}>Close</button>
        </div>
      );
    }

    // idle
    return (
      <div style={footerStyle}>
        <button type="button" style={cancelButtonStyle} onClick={handleClose}>Cancel</button>
        <button
          type="button"
          style={supportsDirectoryPicker ? primaryButtonStyle : disabledButtonStyle}
          disabled={!supportsDirectoryPicker}
          onClick={() => void handleChooseFolderAndExport()}
        >
          Choose Folder &amp; Export
        </button>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={phase === 'exporting' ? undefined : handleClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Export Selected Photos</h2>
        </div>
        <div style={bodyStyle}>{renderBody()}</div>
        {renderFooter()}
      </div>
    </div>
  );
}
