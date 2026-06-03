import { useState, useRef, useEffect, type CSSProperties, type ReactElement } from 'react';
import type { EditHistoryArchive } from '@tedography/domain';
import type { EditHistoryEntryWithNavigation } from '../../api/editHistoryApi.js';

interface EditHistoryDialogProps {
  open: boolean;
  entries: EditHistoryEntryWithNavigation[];
  archives: EditHistoryArchive[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onArchive: (entryIds: string[], name?: string) => Promise<void>;
  onAppendToArchive: (entryIds: string[], archiveId: string) => Promise<void>;
  onOpenArchives: () => void;
  onNavigate: (assetId: string, albumId: string | null) => void;
  onSaveNote: (entryId: string, note: string) => Promise<void>;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', zIndex: 1300,
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

const closeButtonStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9ca3af', fontSize: '20px', padding: '0 2px', lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: '12px 18px', overflowY: 'auto', flex: '1 1 auto',
  display: 'flex', flexDirection: 'column', gap: '6px',
};

const selectAllRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '4px 2px 6px', borderBottom: '1px solid #f3f4f6', marginBottom: '2px',
};

const entryStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: '20px 20px 1fr', gap: '0 8px',
  padding: '8px 10px', borderRadius: '6px',
  border: '1px solid #e5e7eb', backgroundColor: '#fafafa', fontSize: '12px',
};

const footerStyle: CSSProperties = {
  padding: '12px 18px', borderTop: '1px solid #ececec',
  display: 'flex', flexDirection: 'column', gap: '8px',
};

const footerRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
  padding: '5px 12px', fontSize: '12px', borderRadius: '6px',
  border: '1px solid #d1d5db', backgroundColor: '#f9fafb',
  cursor: 'pointer', color: '#374151',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle, backgroundColor: '#1a56db', color: '#fff', borderColor: '#1a56db',
};

const disabledButtonStyle: CSSProperties = { ...buttonStyle, opacity: 0.4, cursor: 'default' };

const inputStyle: CSSProperties = {
  flex: '1 1 auto', minWidth: '140px', maxWidth: '260px',
  fontSize: '12px', padding: '4px 8px',
  border: '1px solid #93c5fd', borderRadius: '6px', outline: 'none',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export function EditHistoryDialog({
  open,
  entries,
  archives,
  loading,
  error,
  onClose,
  onArchive,
  onAppendToArchive,
  onOpenArchives,
  onNavigate,
  onSaveNote,
}: EditHistoryDialogProps): ReactElement | null {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveMode, setArchiveMode] = useState<'none' | 'create' | 'append'>('none');
  const [archiveNameDraft, setArchiveNameDraft] = useState('');
  const [appendTargetId, setAppendTargetId] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Keep selection valid when entries change
  useEffect(() => {
    const validIds = new Set(entries.map((e) => e.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < entries.length;
    }
  }, [selectedIds.size, entries.length]);

  // Reset archive mode and note edit when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setArchiveMode('none');
      setArchiveNameDraft('');
      setEditingNoteId(null);
    }
  }, [open]);

  if (!open) return null;

  function startEditNote(entry: EditHistoryEntryWithNavigation): void {
    setEditingNoteId(entry.id);
    setNoteDraft(entry.note ?? '');
  }

  function cancelEditNote(): void {
    setEditingNoteId(null);
  }

  async function saveNote(): Promise<void> {
    if (!editingNoteId) return;
    setNoteSaving(true);
    try {
      await onSaveNote(editingNoteId, noteDraft);
      setEditingNoteId(null);
    } finally {
      setNoteSaving(false);
    }
  }

  const allSelected = entries.length > 0 && selectedIds.size === entries.length;
  const selectedEntryIds = Array.from(selectedIds);
  const hasSelection = selectedIds.size > 0;
  const hasArchives = archives.length > 0;

  function toggleSelectAll(): void {
    setSelectedIds(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  function toggleEntry(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startCreate(): void {
    setArchiveMode('create');
    setArchiveNameDraft('');
    setAppendTargetId('');
  }

  function startAppend(): void {
    setArchiveMode('append');
    setAppendTargetId(archives[0]?.id ?? '');
    setArchiveNameDraft('');
  }

  function cancelArchiveMode(): void {
    setArchiveMode('none');
  }

  async function confirmCreate(): Promise<void> {
    setArchiving(true);
    try {
      await onArchive(selectedEntryIds, archiveNameDraft.trim() || undefined);
      setSelectedIds(new Set());
      setArchiveMode('none');
    } finally {
      setArchiving(false);
    }
  }

  async function confirmAppend(): Promise<void> {
    if (!appendTargetId) return;
    setArchiving(true);
    try {
      await onAppendToArchive(selectedEntryIds, appendTargetId);
      setSelectedIds(new Set());
      setArchiveMode('none');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            Edit History{entries.length > 0 ? ` (${entries.length})` : ''}
          </h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={bodyStyle}>
          {loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading…</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{error}</p>
          ) : entries.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
              No history yet.
            </p>
          ) : (
            <>
              <div style={selectAllRowStyle}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                  Select all
                </label>
                {selectedIds.size > 0 && (
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    {selectedIds.size} selected
                  </span>
                )}
              </div>

              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    ...entryStyle,
                    borderColor: selectedIds.has(entry.id) ? '#1a56db' : '#e5e7eb',
                    backgroundColor: selectedIds.has(entry.id) ? '#f0f5ff' : '#fafafa',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ paddingTop: '1px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleEntry(entry.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>

                  {/* Status icon */}
                  <div style={{ paddingTop: '1px', fontSize: '13px' }}>
                    {entry.status === 'succeeded'
                      ? <span style={{ color: '#2f6f3e' }}>✓</span>
                      : <span style={{ color: '#b00020' }}>✗</span>}
                  </div>

                  {/* Content */}
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
                      {/* Edit note button */}
                      <button
                        type="button"
                        title={editingNoteId === entry.id ? 'Cancel edit' : 'Edit note'}
                        onClick={() => editingNoteId === entry.id ? cancelEditNote() : startEditNote(entry)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: editingNoteId === entry.id ? '#1a56db' : '#9ca3af', fontSize: '13px', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginLeft: 'auto' }}
                      >
                        ✎
                      </button>
                    </div>
                    {entry.albumPath ? (
                      <span style={{ color: '#6b7280', fontSize: '10px' }}>{entry.albumPath}</span>
                    ) : null}
                    {editingNoteId === entry.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          rows={2}
                          style={{ width: '100%', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 6px', resize: 'vertical', fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box' }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEditNote(); }}
                        />
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            type="button"
                            style={{ ...buttonStyle, backgroundColor: '#1a56db', color: '#fff', borderColor: '#1a56db', padding: '2px 8px', fontSize: '11px', opacity: noteSaving ? 0.5 : 1, cursor: noteSaving ? 'default' : 'pointer' }}
                            disabled={noteSaving}
                            onClick={() => void saveNote()}
                          >
                            {noteSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" style={{ ...buttonStyle, padding: '2px 8px', fontSize: '11px' }} onClick={cancelEditNote}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : entry.note ? (
                      <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.note}>
                        {entry.note}
                      </span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '11px' }}>no note</span>
                    )}
                    {entry.errorMessage ? (
                      <span style={{ color: '#b00020', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.errorMessage}>
                        {entry.errorMessage}
                      </span>
                    ) : null}
                    <span style={{ color: '#9ca3af', fontSize: '10px' }}>{formatDate(entry.processedAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={footerStyle}>
          {/* Archive action row — shown when items are selected */}
          {hasSelection && archiveMode === 'none' && (
            <div style={footerRowStyle}>
              <span style={{ fontSize: '12px', color: '#374151' }}>
                {selectedIds.size} selected:
              </span>
              <button type="button" style={primaryButtonStyle} onClick={startCreate}>
                Create Archive
              </button>
              {hasArchives && (
                <button type="button" style={buttonStyle} onClick={startAppend}>
                  Append to Archive…
                </button>
              )}
            </div>
          )}

          {/* Create archive inline form */}
          {archiveMode === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#1e40af' }}>
                Archive {selectedIds.size} entr{selectedIds.size !== 1 ? 'ies' : 'y'}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  style={inputStyle}
                  value={archiveNameDraft}
                  onChange={(e) => setArchiveNameDraft(e.target.value)}
                  placeholder="Name (optional — defaults to date/time)"
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmCreate(); if (e.key === 'Escape') cancelArchiveMode(); }}
                  autoFocus
                />
                <button
                  type="button"
                  style={archiving ? disabledButtonStyle : primaryButtonStyle}
                  disabled={archiving}
                  onClick={() => void confirmCreate()}
                >
                  {archiving ? 'Archiving…' : 'Confirm'}
                </button>
                <button type="button" style={buttonStyle} onClick={cancelArchiveMode}>Cancel</button>
              </div>
            </div>
          )}

          {/* Append to archive form */}
          {archiveMode === 'append' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#1e40af' }}>
                Append {selectedIds.size} entr{selectedIds.size !== 1 ? 'ies' : 'y'} to:
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  style={{ ...inputStyle, maxWidth: '260px', padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: '6px', backgroundColor: '#fff' }}
                  value={appendTargetId}
                  onChange={(e) => setAppendTargetId(e.target.value)}
                >
                  {archives.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  style={archiving ? disabledButtonStyle : primaryButtonStyle}
                  disabled={archiving || !appendTargetId}
                  onClick={() => void confirmAppend()}
                >
                  {archiving ? 'Appending…' : 'Confirm'}
                </button>
                <button type="button" style={buttonStyle} onClick={cancelArchiveMode}>Cancel</button>
              </div>
            </div>
          )}

          {/* Bottom row — Archives button */}
          <div style={footerRowStyle}>
            <button type="button" style={buttonStyle} onClick={onOpenArchives}>
              Archives{archives.length > 0 ? ` (${archives.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
