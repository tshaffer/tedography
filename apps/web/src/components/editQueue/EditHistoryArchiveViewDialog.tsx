import type { CSSProperties, ReactElement } from 'react';
import type { EditHistoryEntryWithNavigation } from '../../api/editHistoryApi.js';

interface EditHistoryArchiveViewDialogProps {
  open: boolean;
  archiveName: string;
  entries: EditHistoryEntryWithNavigation[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onNavigate: (assetId: string, albumId: string | null) => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', zIndex: 1400,
};

const dialogStyle: CSSProperties = {
  width: 'min(640px, 92vw)', maxHeight: '80vh',
  borderRadius: '12px', border: '1px solid #d8d8d8',
  backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px', borderBottom: '1px solid #ececec',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' };
const subtitleStyle: CSSProperties = { margin: '2px 0 0', fontSize: '12px', color: '#6b7280' };

const closeButtonStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9ca3af', fontSize: '20px', padding: '0 2px', lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: '12px 18px', overflowY: 'auto', flex: '1 1 auto',
  display: 'flex', flexDirection: 'column', gap: '6px',
};

const entryStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: '20px 1fr', gap: '0 10px',
  padding: '8px 10px', borderRadius: '6px',
  border: '1px solid #e5e7eb', backgroundColor: '#fafafa', fontSize: '12px',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export function EditHistoryArchiveViewDialog({
  open,
  archiveName,
  entries,
  loading,
  error,
  onClose,
  onNavigate,
}: EditHistoryArchiveViewDialogProps): ReactElement | null {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Archive — {archiveName}</h2>
            <p style={subtitleStyle}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} · read-only</p>
          </div>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={bodyStyle}>
          {loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading…</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{error}</p>
          ) : entries.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>No entries.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} style={entryStyle}>
                <div style={{ paddingTop: '1px', fontSize: '13px' }}>
                  {entry.status === 'succeeded'
                    ? <span style={{ color: '#2f6f3e' }}>✓</span>
                    : <span style={{ color: '#b00020' }}>✗</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      style={{ fontWeight: 500, color: '#1a56db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 'inherit', maxWidth: '200px' }}
                      title="Navigate to source photo"
                      onClick={() => { onNavigate(entry.sourceAssetId, entry.albumId); }}
                    >
                      {entry.sourceFilename}
                    </button>
                    <span style={{ color: '#9ca3af', flexShrink: 0 }}>→</span>
                    {entry.editedAssetId ? (
                      <button
                        type="button"
                        style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 'inherit', maxWidth: '200px' }}
                        title="Navigate to edited photo"
                        onClick={() => { onNavigate(entry.editedAssetId!, entry.albumId); }}
                      >
                        {entry.editedFilename || '—'}
                      </button>
                    ) : (
                      <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.editedFilename || '—'}
                      </span>
                    )}
                    {entry.editedAssetId ? (
                      <span style={{ flexShrink: 0, fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '4px', padding: '1px 5px' }}>
                        imported
                      </span>
                    ) : null}
                  </div>
                  {entry.albumPath ? (
                    <span style={{ color: '#6b7280', fontSize: '10px' }}>{entry.albumPath}</span>
                  ) : null}
                  {entry.note ? (
                    <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.note}>
                      {entry.note}
                    </span>
                  ) : null}
                  {entry.errorMessage ? (
                    <span style={{ color: '#b00020', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.errorMessage}>
                      {entry.errorMessage}
                    </span>
                  ) : null}
                  <span style={{ color: '#9ca3af', fontSize: '10px' }}>{formatDate(entry.processedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
