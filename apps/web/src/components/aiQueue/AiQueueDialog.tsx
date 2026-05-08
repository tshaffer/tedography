import { useState, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import type { AiQueueEntryWithFilename } from '../../api/aiQueueApi.js';

interface AiQueueDialogProps {
  open: boolean;
  entries: AiQueueEntryWithFilename[];
  loading: boolean;
  error: string | null;
  exportNotice: string | null;
  exportError: string | null;
  processNotice: string | null;
  processError: string | null;
  processing: boolean;
  onClose: () => void;
  onRemove: (assetId: string) => void;
  onExport: (assetIds: string[]) => void;
  onProcess: (assetIds: string[]) => void;
  onClear: () => void;
  onSavePrompt: (assetId: string, prompt: string) => Promise<void>;
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
  width: 'min(560px, 92vw)',
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
  padding: '12px 18px',
  overflowY: 'auto',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const selectAllRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 2px 6px',
  borderBottom: '1px solid #f3f4f6',
  marginBottom: '2px',
};

const entryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#fafafa',
  fontSize: '12px',
};

const entryHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
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

const primaryButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  backgroundColor: '#1a56db',
  color: '#fff',
  borderColor: '#1a56db',
};

const disabledButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  opacity: 0.5,
  cursor: 'default',
};

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: '14px',
  padding: '0 2px',
  flexShrink: 0,
  lineHeight: 1,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  fontSize: '12px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  padding: '6px 8px',
  resize: 'vertical',
  fontFamily: 'inherit',
  color: '#374151',
  boxSizing: 'border-box',
};

const smallButtonStyle: CSSProperties = {
  padding: '3px 10px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
};

const smallPrimaryButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  backgroundColor: '#1a56db',
  color: '#fff',
  borderColor: '#1a56db',
};

export function AiQueueDialog({
  open,
  entries,
  loading,
  error,
  exportNotice,
  exportError,
  processNotice,
  processError,
  processing,
  onClose,
  onRemove,
  onExport,
  onProcess,
  onClear,
  onSavePrompt,
}: AiQueueDialogProps): ReactElement | null {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Prune selections and close editor when entries change
  useEffect(() => {
    const validIds = new Set(entries.map((e) => e.assetId));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    if (editingAssetId !== null && !validIds.has(editingAssetId)) {
      setEditingAssetId(null);
    }
  }, [entries, editingAssetId]);

  // Indeterminate state for select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < entries.length;
    }
  }, [selectedIds.size, entries.length]);

  if (!open) return null;

  const allSelected = entries.length > 0 && selectedIds.size === entries.length;
  const selectedCount = selectedIds.size;
  const selectedAssetIds = Array.from(selectedIds);

  function toggleSelectAll(): void {
    setSelectedIds(allSelected ? new Set() : new Set(entries.map((e) => e.assetId)));
  }

  function toggleEntry(assetId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function startEdit(entry: AiQueueEntryWithFilename): void {
    setEditingAssetId(entry.assetId);
    setEditDraft(entry.prompt ?? '');
  }

  function cancelEdit(): void {
    setEditingAssetId(null);
  }

  async function saveEdit(): Promise<void> {
    if (editingAssetId === null) return;
    await onSavePrompt(editingAssetId, editDraft);
    setEditingAssetId(null);
  }

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
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
              Queue is empty.
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
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {entries.length} item{entries.length !== 1 ? 's' : ''}
                </span>
              </div>

              {entries.map((entry) => {
                const isSelected = selectedIds.has(entry.assetId);
                const isEditing = editingAssetId === entry.assetId;
                return (
                  <div
                    key={entry.assetId}
                    style={{ ...entryStyle, borderColor: isSelected ? '#1a56db' : '#e5e7eb', backgroundColor: isSelected ? '#f0f5ff' : '#fafafa' }}
                  >
                    <div style={entryHeaderStyle}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEntry(entry.assetId)}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1f2937' }}>
                        {entry.filename}
                      </span>
                      <button
                        type="button"
                        style={{ ...iconButtonStyle, color: isEditing ? '#1a56db' : '#9ca3af' }}
                        onClick={() => isEditing ? cancelEdit() : startEdit(entry)}
                        title={isEditing ? 'Cancel edit' : 'Edit prompt'}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        style={iconButtonStyle}
                        onClick={() => onRemove(entry.assetId)}
                        title="Remove from queue"
                      >
                        ×
                      </button>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '2px' }}>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          style={textareaStyle}
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" style={smallPrimaryButtonStyle} onClick={() => void saveEdit()}>
                            Save
                          </button>
                          <button type="button" style={smallButtonStyle} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : entry.prompt ? (
                      <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '11px' }}>
                        {entry.prompt}
                      </span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '11px' }}>
                        no prompt
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={footerStyle}>
          <button
            type="button"
            style={selectedCount === 0 || processing ? disabledButtonStyle : primaryButtonStyle}
            onClick={() => onProcess(selectedAssetIds)}
            disabled={selectedCount === 0 || processing}
            title="Send selected photos to Gemini and save the edited results"
          >
            {processing
              ? 'Processing…'
              : selectedCount > 0
                ? `Process with Gemini (${selectedCount})`
                : 'Process with Gemini'}
          </button>
          <button
            type="button"
            style={selectedCount === 0 ? disabledButtonStyle : actionButtonStyle}
            onClick={() => onExport(selectedAssetIds)}
            disabled={selectedCount === 0}
            title="Copy selected files to export folder and write prompts.txt"
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
          {processNotice ? (
            <span style={{ fontSize: '12px', color: '#2f6f3e' }}>{processNotice}</span>
          ) : null}
          {processError ? (
            <span style={{ fontSize: '12px', color: '#b00020' }}>{processError}</span>
          ) : null}
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
