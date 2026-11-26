import type { CSSProperties, ReactElement } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import type { ExportItemResult } from '../../api/editQueueApi.js';

interface ExportQueueResultDialogProps {
  open: boolean;
  exporting: boolean;
  notice: string | null;
  error: string | null;
  results: ExportItemResult[] | null;
  // Re-export photos whose earlier working copy couldn't be found, after confirmation.
  onExportAnyway: (assetIds: string[]) => void;
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

const STATUS_LABELS: Record<ExportItemResult['status'], string> = {
  exported: 'Exported',
  alreadyExported: 'Already exported',
  previouslyExported: 'Exported before — working copy not found',
  conflict: 'Filename conflict — action required',
  failed: 'Export failed',
};

export function ExportQueueResultDialog({
  open,
  exporting,
  notice,
  error,
  results,
  onExportAnyway,
  onClose,
}: ExportQueueResultDialogProps): ReactElement | null {
  if (!open) return null;

  const attention = (results ?? []).filter((r) => r.status !== 'exported' && r.status !== 'alreadyExported');
  const previously = attention.filter((r) => r.status === 'previouslyExported');
  const hasProblems = attention.length > 0;

  function handleOverlayClick(): void {
    if (!exporting) onClose();
  }

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            {exporting ? 'Exporting Queue' : error ? 'Export Failed' : hasProblems ? 'Export Finished — Needs Attention' : 'Export Complete'}
          </h2>
        </div>
        {exporting ? (
          <div style={progressBodyStyle}>
            <CircularProgress size={22} thickness={4.5} />
            <p style={messageStyle}>Copying files to the export folder…</p>
          </div>
        ) : (
          <div style={bodyStyle}>
            <p style={{ ...messageStyle, color: error ? '#b00020' : hasProblems ? '#92400e' : '#2f6f3e' }}>
              {error ?? notice}
            </p>
            {hasProblems ? (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '40vh' }}>
                {attention.map((r) => (
                  <div key={r.assetId} style={{ fontSize: '12px', lineHeight: 1.4, color: r.status === 'previouslyExported' ? '#92400e' : '#b00020' }}>
                    <strong>{r.filename}</strong> — {STATUS_LABELS[r.status]}
                    <div style={{ color: '#6b7280' }}>{r.message}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <p style={{ ...messageStyle, marginTop: '10px', fontSize: '11px', color: '#6b7280' }}>
              Existing files in the export folder are never overwritten or deleted by Tedography.
            </p>
          </div>
        )}
        {!exporting ? (
          <div style={{ ...footerStyle, gap: '8px' }}>
            {previously.length > 0 ? (
              <button
                type="button"
                style={{ ...okButtonStyle, backgroundColor: '#fff', color: '#92400e', borderColor: '#d97706' }}
                onClick={() => {
                  if (window.confirm(`Create a new working copy in the export folder for ${previously.length} photo${previously.length !== 1 ? 's' : ''} that appear to have been exported before?`)) {
                    onExportAnyway(previously.map((r) => r.assetId));
                  }
                }}
              >
                Export anyway ({previously.length})
              </button>
            ) : null}
            <button type="button" style={okButtonStyle} onClick={onClose} autoFocus>OK</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
