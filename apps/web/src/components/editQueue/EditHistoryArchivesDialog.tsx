import { useState, type CSSProperties, type ReactElement } from 'react';
import type { EditHistoryArchive } from '@tedography/domain';

interface EditHistoryArchivesDialogProps {
  open: boolean;
  archives: EditHistoryArchive[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onView: (archiveId: string, archiveName: string) => void;
  onRename: (archiveId: string, newName: string) => Promise<void>;
  onDelete: (archiveId: string) => Promise<void>;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', zIndex: 1400,
};

const dialogStyle: CSSProperties = {
  width: 'min(560px, 92vw)', maxHeight: '80vh',
  borderRadius: '12px', border: '1px solid #d8d8d8',
  backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px', borderBottom: '1px solid #ececec',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' };

const closeButtonStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9ca3af', fontSize: '20px', padding: '0 2px', lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: '12px 18px', overflowY: 'auto', flex: '1 1 auto',
  display: 'flex', flexDirection: 'column', gap: '6px',
};

const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '8px 10px', borderRadius: '6px',
  border: '1px solid #e5e7eb', backgroundColor: '#fafafa', fontSize: '12px',
};

const actionButtonStyle: CSSProperties = {
  padding: '3px 10px', fontSize: '11px', borderRadius: '4px',
  border: '1px solid #d1d5db', backgroundColor: '#f9fafb',
  cursor: 'pointer', color: '#374151', flexShrink: 0,
};

const dangerButtonStyle: CSSProperties = {
  ...actionButtonStyle, borderColor: '#f87171', color: '#dc2626',
};

const inputStyle: CSSProperties = {
  flex: '1 1 auto', fontSize: '12px', padding: '3px 6px',
  border: '1px solid #93c5fd', borderRadius: '4px', outline: 'none',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function EditHistoryArchivesDialog({
  open,
  archives,
  loading,
  error,
  onClose,
  onView,
  onRename,
  onDelete,
}: EditHistoryArchivesDialogProps): ReactElement | null {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  async function saveRename(archiveId: string): Promise<void> {
    if (!renameDraft.trim()) return;
    setRenameSaving(true);
    try {
      await onRename(archiveId, renameDraft.trim());
      setRenamingId(null);
    } finally {
      setRenameSaving(false);
    }
  }

  async function confirmDelete(archiveId: string): Promise<void> {
    setDeleting(true);
    try {
      await onDelete(archiveId);
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            Edit History Archives{archives.length > 0 ? ` (${archives.length})` : ''}
          </h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={bodyStyle}>
          {loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading…</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{error}</p>
          ) : archives.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
              No archives yet.
            </p>
          ) : (
            archives.map((archive) => {
              const isRenaming = renamingId === archive.id;
              const isConfirmingDelete = confirmDeleteId === archive.id;
              return (
                <div key={archive.id} style={rowStyle}>
                  {/* Name / rename input */}
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    {isRenaming ? (
                      <input
                        style={inputStyle}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveRename(archive.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <div>
                        <span style={{ fontWeight: 500, color: '#1f2937' }}>{archive.name}</span>
                        <span style={{ color: '#9ca3af', marginLeft: '6px' }}>
                          {archive.itemCount} entr{archive.itemCount !== 1 ? 'ies' : 'y'} · {formatDate(archive.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isRenaming ? (
                    <>
                      <button
                        type="button"
                        style={{ ...actionButtonStyle, borderColor: '#1a56db', color: '#1a56db', opacity: renameSaving ? 0.5 : 1 }}
                        disabled={renameSaving}
                        onClick={() => void saveRename(archive.id)}
                      >
                        Save
                      </button>
                      <button type="button" style={actionButtonStyle} onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : isConfirmingDelete ? (
                    <>
                      <span style={{ fontSize: '11px', color: '#374151', flexShrink: 0 }}>Delete?</span>
                      <button
                        type="button"
                        style={{ ...dangerButtonStyle, backgroundColor: '#dc2626', color: '#fff', opacity: deleting ? 0.5 : 1 }}
                        disabled={deleting}
                        onClick={() => void confirmDelete(archive.id)}
                      >
                        Yes
                      </button>
                      <button type="button" style={actionButtonStyle} onClick={() => setConfirmDeleteId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        style={actionButtonStyle}
                        onClick={() => onView(archive.id, archive.name)}
                        title="View archived entries (read-only)"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        style={actionButtonStyle}
                        onClick={() => { setRenamingId(archive.id); setRenameDraft(archive.name); }}
                        title="Rename this archive"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        style={dangerButtonStyle}
                        onClick={() => setConfirmDeleteId(archive.id)}
                        title="Permanently delete this archive and all its entries"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
