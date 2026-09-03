import { useState, useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { EditType, EDIT_TYPE_LABELS, EDIT_TYPE_VALUES } from '@tedography/domain';
import type {
  EditQueueEntryWithFilename,
  ImportEditedResult,
  EditedFileCandidate,
  EditMethod,
  EditFolderFile,
} from '../../api/editQueueApi.js';
import { getThumbnailMediaUrl } from '../../utilities/mediaUrls';

interface EditQueueDialogProps {
  open: boolean;
  entries: EditQueueEntryWithFilename[];
  loading: boolean;
  error: string | null;
  exporting: boolean;
  importResults: ImportEditedResult[] | null;
  importError: string | null;
  importing: boolean;
  clearFolderNotice: string | null;
  clearFolderError: string | null;
  editFolderFiles: EditFolderFile[];
  editFolderFilesLoading: boolean;
  editFolderFilesError: string | null;
  importCandidateCount: number;
  classifyCandidates: EditedFileCandidate[];
  classifyCommitting: boolean;
  onClose: () => void;
  onRemove: (assetId: string) => void;
  onExport: (assetIds: string[]) => void;
  onImport: () => void;
  onClearQueue: () => void;
  onClearFolder: () => void;
  onDeleteEditFolderFile: (filename: string) => void;
  onSaveNote: (assetId: string, note: string) => Promise<void>;
  onSaveEditType: (assetId: string, editType: EditType) => void;
  onNavigate: (assetId: string, albumId: string | null) => void;
  onCancelClassify: () => void;
  onConfirmClassify: (files: { filename: string; editMethod: EditMethod }[]) => void;
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

const entryRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#fafafa',
  fontSize: '12px',
};

const entryThumbnailStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '4px',
  objectFit: 'cover',
  flexShrink: 0,
  backgroundColor: '#e5e7eb',
};

const entryContentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  flex: '1 1 auto',
  minWidth: 0,
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
  flexDirection: 'column',
  gap: '8px',
};

const footerButtonRowStyle: CSSProperties = {
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

const filterSelectStyle: CSSProperties = {
  fontSize: '12px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  padding: '3px 6px',
  fontFamily: 'inherit',
  color: '#374151',
  backgroundColor: '#fff',
};

const rowEditTypeSelectStyle: CSSProperties = {
  fontSize: '11px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  padding: '2px 4px',
  fontFamily: 'inherit',
  color: '#374151',
  backgroundColor: '#fff',
  flexShrink: 0,
  maxWidth: '140px',
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

const dangerButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  borderColor: '#f87171',
  color: '#dc2626',
};

const editFolderFileListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  maxHeight: '120px',
  overflowY: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '4px 6px',
};

const editFolderFileRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 2px',
  fontSize: '11px',
  color: '#374151',
};

const classifySubtitleStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: '12px',
  color: '#6b7280',
};

const classifyBatchRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '8px 10px',
  borderRadius: '8px',
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  marginBottom: '4px',
};

const classifyRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '6px 2px',
};

const classifyFilenameColStyle: CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
};

const classifySegStyle: CSSProperties = {
  display: 'flex',
  borderRadius: '4px',
  overflow: 'hidden',
  border: '1px solid #c8c8c8',
  flexShrink: 0,
};

function classifySegButtonStyle(active: boolean, isFirst: boolean): CSSProperties {
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

export function EditQueueDialog({
  open,
  entries,
  loading,
  error,
  exporting,
  importResults,
  importError,
  importing,
  clearFolderNotice,
  clearFolderError,
  editFolderFiles,
  editFolderFilesLoading,
  editFolderFilesError,
  importCandidateCount,
  classifyCandidates,
  classifyCommitting,
  onClose,
  onRemove,
  onExport,
  onImport,
  onClearQueue,
  onClearFolder,
  onDeleteEditFolderFile,
  onSaveNote,
  onSaveEditType,
  onNavigate,
  onCancelClassify,
  onConfirmClassify,
}: EditQueueDialogProps): ReactElement | null {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmClearFolder, setConfirmClearFolder] = useState(false);
  const [confirmClearQueue, setConfirmClearQueue] = useState(false);
  const [classifyMethodByFilename, setClassifyMethodByFilename] = useState<Record<string, EditMethod>>({});
  const [classifySelected, setClassifySelected] = useState<Set<string>>(new Set());
  const [editTypeFilter, setEditTypeFilter] = useState<EditType | 'All'>('All');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const isClassifying = classifyCandidates.length > 0;
  const visibleEntries =
    editTypeFilter === 'All' ? entries : entries.filter((e) => e.editType === editTypeFilter);

  useEffect(() => {
    if (classifyCandidates.length === 0) return;
    setClassifyMethodByFilename(
      Object.fromEntries(classifyCandidates.map((c) => [c.filename, 'manual' as EditMethod]))
    );
    setClassifySelected(new Set(classifyCandidates.map((c) => c.filename)));
  }, [classifyCandidates]);

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

  useEffect(() => {
    if (selectAllRef.current) {
      const visibleSelectedCount = visibleEntries.filter((e) => selectedIds.has(e.assetId)).length;
      selectAllRef.current.indeterminate =
        visibleSelectedCount > 0 && visibleSelectedCount < visibleEntries.length;
    }
  }, [selectedIds, visibleEntries]);

  if (!open) return null;

  const allSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selectedIds.has(e.assetId));
  const selectedCount = selectedIds.size;
  const selectedAssetIds = Array.from(selectedIds);

  function toggleSelectAll(): void {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const e of visibleEntries) next.delete(e.assetId);
        return next;
      }
      return new Set([...prev, ...visibleEntries.map((e) => e.assetId)]);
    });
  }

  function toggleEntry(assetId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function startEdit(entry: EditQueueEntryWithFilename): void {
    setEditingAssetId(entry.assetId);
    setEditDraft(entry.note ?? '');
  }

  function cancelEdit(): void {
    setEditingAssetId(null);
  }

  async function saveEdit(): Promise<void> {
    if (editingAssetId === null) return;
    await onSaveNote(editingAssetId, editDraft);
    setEditingAssetId(null);
  }

  function setAllClassifyMethods(method: EditMethod): void {
    setClassifyMethodByFilename(Object.fromEntries(classifyCandidates.map((c) => [c.filename, method])));
  }

  function setOneClassifyMethod(filename: string, method: EditMethod): void {
    setClassifyMethodByFilename((prev) => ({ ...prev, [filename]: method }));
  }

  function toggleClassifySelected(filename: string): void {
    setClassifySelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }

  function toggleClassifySelectAll(): void {
    setClassifySelected((prev) =>
      prev.size === classifyCandidates.length ? new Set() : new Set(classifyCandidates.map((c) => c.filename))
    );
  }

  function handleConfirmClassify(): void {
    onConfirmClassify(
      classifyCandidates
        .filter((c) => classifySelected.has(c.filename))
        .map((c) => ({ filename: c.filename, editMethod: classifyMethodByFilename[c.filename] ?? 'manual' }))
    );
  }

  const importedResults = importResults?.filter((r) => r.status === 'imported') ?? [];
  const skippedResults = importResults?.filter((r) => r.status === 'skipped') ?? [];
  const errorResults = importResults?.filter((r) => r.status === 'error') ?? [];
  const importedCount = importedResults.length;
  const importErrorCount = errorResults.length;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>

        <div style={headerStyle}>
          <h2 style={titleStyle}>
            {isClassifying
              ? `Classify Edited Files (${classifyCandidates.length})`
              : `Edit Queue${entries.length > 0 ? ` (${entries.length})` : ''}`}
          </h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={bodyStyle}>
          {isClassifying ? (
            <>
              <p style={classifySubtitleStyle}>Choose which files to import and how each edit was produced. This is recorded per photo and can be changed later.</p>
              <div style={classifyBatchRowStyle}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={classifySelected.size === classifyCandidates.length}
                    onChange={toggleClassifySelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                  Select all
                </label>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#2d3748' }}>Set all to</span>
                <div style={classifySegStyle}>
                  <button type="button" style={classifySegButtonStyle(false, true)} onClick={() => setAllClassifyMethods('manual')}>Manual</button>
                  <button type="button" style={classifySegButtonStyle(false, false)} onClick={() => setAllClassifyMethods('ai')}>AI</button>
                </div>
              </div>
              {classifyCandidates.map((c) => {
                const method = classifyMethodByFilename[c.filename] ?? 'manual';
                const isSelected = classifySelected.has(c.filename);
                return (
                  <div key={c.filename} style={{ ...classifyRowStyle, opacity: isSelected ? 1 : 0.45 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClassifySelected(c.filename)}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={classifyFilenameColStyle}>
                      <span style={{ fontSize: '13px', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.filename}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from {c.sourceFilename}</span>
                    </div>
                    <div style={classifySegStyle}>
                      <button
                        type="button"
                        style={classifySegButtonStyle(method === 'manual', true)}
                        onClick={() => setOneClassifyMethod(c.filename, 'manual')}
                        disabled={!isSelected}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        style={classifySegButtonStyle(method === 'ai', false)}
                        onClick={() => setOneClassifyMethod(c.filename, 'ai')}
                        disabled={!isSelected}
                      >
                        AI
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          ) : loading ? (
            <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>Loading...</p>
          ) : error ? (
            <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{error}</p>
          ) : entries.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
              Queue is empty.
            </p>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151' }}>
                Filter by edit type
                <select
                  style={{ ...filterSelectStyle, flex: 1 }}
                  value={editTypeFilter}
                  onChange={(e) => setEditTypeFilter(e.target.value as EditType | 'All')}
                >
                  <option value="All">All</option>
                  {EDIT_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>{EDIT_TYPE_LABELS[value]}</option>
                  ))}
                </select>
              </label>

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
                  {visibleEntries.length} item{visibleEntries.length !== 1 ? 's' : ''}
                  {visibleEntries.length !== entries.length ? ` of ${entries.length}` : ''}
                </span>
              </div>

              {visibleEntries.length === 0 ? (
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
                  No items match this filter.
                </p>
              ) : null}

              {visibleEntries.map((entry) => {
                const isSelected = selectedIds.has(entry.assetId);
                const isEditing = editingAssetId === entry.assetId;
                const hasOrphanedEdit = entry.orphanedEditFilenames.length > 0;
                return (
                  <div
                    key={entry.assetId}
                    style={{ ...entryRowStyle, borderColor: isSelected ? '#1a56db' : '#e5e7eb', backgroundColor: isSelected ? '#f0f5ff' : '#fafafa' }}
                  >
                    <img
                      src={getThumbnailMediaUrl(entry.assetId)}
                      alt=""
                      style={entryThumbnailStyle}
                      loading="lazy"
                    />
                    <div style={entryContentStyle}>
                    <div style={entryHeaderStyle}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEntry(entry.assetId)}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                      />
                      <button
                        type="button"
                        style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: hasOrphanedEdit ? '#b45309' : '#1a56db', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 'inherit' }}
                        title={
                          hasOrphanedEdit
                            ? `Navigate to this photo — edited file waiting but not linked (${entry.orphanedEditFilenames.join(', ')}). Re-export to import it.`
                            : 'Navigate to this photo'
                        }
                        onClick={() => { onNavigate(entry.assetId, entry.albumId); }}
                      >
                        {entry.filename}
                      </button>
                      {entry.isExported ? (
                        <span
                          style={{ color: '#16a34a', fontSize: '13px', flexShrink: 0, lineHeight: 1 }}
                          title="Exported — currently linked in manifest.json"
                        >
                          ✓
                        </span>
                      ) : null}
                      <select
                        style={rowEditTypeSelectStyle}
                        value={entry.editType}
                        onChange={(e) => onSaveEditType(entry.assetId, e.target.value as EditType)}
                        title="Edit type"
                      >
                        {EDIT_TYPE_VALUES.map((value) => (
                          <option key={value} value={value}>{EDIT_TYPE_LABELS[value]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={{ ...iconButtonStyle, color: isEditing ? '#1a56db' : '#9ca3af' }}
                        onClick={() => isEditing ? cancelEdit() : startEdit(entry)}
                        title={isEditing ? 'Cancel edit' : 'Edit note'}
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

                    {entry.albumPath ? (
                      <span style={{ color: '#6b7280', fontSize: '10px' }}>{entry.albumPath}</span>
                    ) : null}

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '2px' }}>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          style={textareaStyle}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" style={smallPrimaryButtonStyle} onClick={() => void saveEdit()}>Save</button>
                          <button type="button" style={smallButtonStyle} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : entry.note ? (
                      <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '11px' }}>{entry.note}</span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '11px' }}>no note</span>
                    )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={footerStyle}>
          {isClassifying ? (
          <div style={footerButtonRowStyle}>
            <button type="button" style={actionButtonStyle} onClick={onCancelClassify} disabled={classifyCommitting}>
              Cancel
            </button>
            <button
              type="button"
              style={classifyCommitting || classifySelected.size === 0 ? disabledButtonStyle : primaryButtonStyle}
              onClick={handleConfirmClassify}
              disabled={classifyCommitting || classifySelected.size === 0}
            >
              {classifyCommitting ? 'Importing…' : `Confirm Import (${classifySelected.size})`}
            </button>
          </div>
          ) : (
          <>
          {/* Primary action row */}
          <div style={footerButtonRowStyle}>
            <button
              type="button"
              style={selectedCount === 0 || exporting ? disabledButtonStyle : primaryButtonStyle}
              onClick={() => onExport(selectedAssetIds)}
              disabled={selectedCount === 0 || exporting}
              title="Copy selected files and write manifest.json to edit folder"
            >
              {exporting ? 'Exporting…' : selectedCount > 0 ? `Export (${selectedCount})` : 'Export'}
            </button>
            <button
              type="button"
              style={importing || importCandidateCount === 0 ? disabledButtonStyle : actionButtonStyle}
              onClick={onImport}
              disabled={importing || importCandidateCount === 0}
              title={importCandidateCount === 0 ? 'No _edited files found in edit folder' : 'Scan edit folder for _edited files and import them'}
            >
              {importing
                ? 'Importing…'
                : importCandidateCount > 0
                  ? `Import Edited Files (${importCandidateCount})`
                  : 'Import Edited Files'}
            </button>
            {confirmClearQueue ? (
              <>
                <span style={{ fontSize: '12px', color: '#374151' }}>Clear entire queue?</span>
                <button
                  type="button"
                  style={{ ...dangerButtonStyle, backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                  onClick={() => { setConfirmClearQueue(false); onClearQueue(); }}
                >
                  Yes, clear
                </button>
                <button type="button" style={smallButtonStyle} onClick={() => setConfirmClearQueue(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                style={entries.length === 0 ? disabledButtonStyle : actionButtonStyle}
                onClick={() => setConfirmClearQueue(true)}
                disabled={entries.length === 0}
              >
                Clear Queue
              </button>
            )}
          </div>

          {/* Edit folder file list — per-file delete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
              Edit Folder Files{editFolderFilesLoading ? '' : ` (${editFolderFiles.length})`}
            </span>
            {editFolderFilesLoading ? (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Loading…</span>
            ) : editFolderFilesError ? (
              <span style={{ fontSize: '11px', color: '#b00020' }}>{editFolderFilesError}</span>
            ) : editFolderFiles.length === 0 ? (
              <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No files in edit folder.</span>
            ) : (
              <div style={editFolderFileListStyle}>
                {editFolderFiles.map((file) => (
                  <div key={file.filename} style={editFolderFileRowStyle}>
                    <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.filename}
                    </span>
                    <button
                      type="button"
                      style={iconButtonStyle}
                      onClick={() => {
                        if (window.confirm(`Delete "${file.filename}" from the edit folder? This cannot be undone.`)) {
                          onDeleteEditFolderFile(file.filename);
                        }
                      }}
                      title="Delete this file from the edit folder"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear folder — two-step confirm */}
          <div style={footerButtonRowStyle}>
            {confirmClearFolder ? (
              <>
                <span style={{ fontSize: '12px', color: '#374151' }}>Delete all files in edit folder?</span>
                <button
                  type="button"
                  style={{ ...dangerButtonStyle, backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                  onClick={() => { setConfirmClearFolder(false); onClearFolder(); }}
                >
                  Yes, delete
                </button>
                <button type="button" style={smallButtonStyle} onClick={() => setConfirmClearFolder(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" style={dangerButtonStyle} onClick={() => setConfirmClearFolder(true)}>
                Clear Edit Folder
              </button>
            )}
          </div>

          {/* Status messages */}
          {importResults && !importError ? (
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {importedCount === 0 && importErrorCount === 0 ? (
                <span style={{ color: '#6b7280' }}>No _edited files found in edit folder.</span>
              ) : null}
              {importedResults.length > 0 ? (
                <div>
                  <span style={{ fontWeight: 600, color: '#2f6f3e' }}>
                    Imported ({importedCount}):
                  </span>
                  {importedResults.map((r) => (
                    <div key={r.filename} style={{ marginTop: '3px', paddingLeft: '10px' }}>
                      <span style={{ color: '#1f2937' }}>{r.filename}</span>
                      {r.destPath ? (
                        <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', marginTop: '1px' }}>
                          → {r.destPath}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {skippedResults.length > 0 ? (
                <div>
                  <span style={{ fontWeight: 600, color: '#6b7280' }}>
                    Skipped ({skippedResults.length}):
                  </span>
                  {skippedResults.map((r) => (
                    <div key={r.filename} style={{ marginTop: '3px', paddingLeft: '10px', color: '#6b7280' }}>
                      {r.filename}{r.message ? ` — ${r.message}` : ''}
                    </div>
                  ))}
                </div>
              ) : null}
              {errorResults.length > 0 ? (
                <div>
                  <span style={{ fontWeight: 600, color: '#b00020' }}>
                    Errors ({errorResults.length}):
                  </span>
                  {errorResults.map((r) => (
                    <div key={r.filename} style={{ marginTop: '3px', paddingLeft: '10px', color: '#b00020' }}>
                      {r.filename}{r.message ? ` — ${r.message}` : ''}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {importError ? <span style={{ fontSize: '12px', color: '#b00020' }}>{importError}</span> : null}
          {clearFolderNotice ? <span style={{ fontSize: '12px', color: '#2f6f3e' }}>{clearFolderNotice}</span> : null}
          {clearFolderError ? <span style={{ fontSize: '12px', color: '#b00020' }}>{clearFolderError}</span> : null}
          </>
          )}
        </div>

      </div>
    </div>
  );
}
