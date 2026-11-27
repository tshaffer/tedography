import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { EditType, EDIT_TYPE_LABELS, EDIT_TYPE_VALUES } from '@tedography/domain';

interface AddToEditQueueDialogProps {
  open: boolean;
  /** 'add' queues the current selection; 'edit' changes one existing entry. */
  mode: 'add' | 'edit';
  /** How many assets the confirm will affect (in 'add' mode, excludes already-queued). */
  assetCount: number;
  /** Filename to show when exactly one asset is targeted. */
  assetFilename: string;
  /** In 'add' mode, how many selected assets are already queued and will be skipped. */
  alreadyQueuedCount?: number;
  existingNote?: string;
  existingEditType?: EditType;
  onClose: () => void;
  onConfirm: (note: string, editType: EditType) => void;
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

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
  color: '#1f2937',
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

export function AddToEditQueueDialog({
  open,
  mode,
  assetCount,
  assetFilename,
  alreadyQueuedCount = 0,
  existingNote,
  existingEditType,
  onClose,
  onConfirm,
}: AddToEditQueueDialogProps): ReactElement | null {
  const [note, setNote] = useState(existingNote ?? '');
  const [editType, setEditType] = useState<EditType>(existingEditType ?? EditType.Unspecified);

  // The dialog stays mounted between opens (it just returns null while closed),
  // so re-seed the fields from props each time it opens.
  useEffect(() => {
    if (open) {
      setNote(existingNote ?? '');
      setEditType(existingEditType ?? EditType.Unspecified);
    }
  }, [open, existingNote, existingEditType]);

  if (!open) return null;

  const isEdit = mode === 'edit';
  const title = isEdit
    ? 'Edit Queue Note & Type'
    : assetCount === 1
      ? 'Add to Edit Queue'
      : `Add ${assetCount} Photos to Edit Queue`;
  const subtitle =
    assetCount === 1
      ? assetFilename
      : `${assetCount} photos — each gets the same edit type and note`;

  function handleConfirm(): void {
    onConfirm(note.trim(), editType);
    onClose();
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <p style={filenameStyle}>{subtitle}</p>
          {!isEdit && alreadyQueuedCount > 0 ? (
            <p style={{ ...filenameStyle, color: '#9ca3af' }}>
              {alreadyQueuedCount} already in the queue{assetCount > 0 ? ' — left unchanged' : ''}.
            </p>
          ) : null}
        </div>
        <div style={bodyStyle}>
          <label style={labelStyle}>
            Edit Type
          </label>
          <select
            style={selectStyle}
            value={editType}
            onChange={(e) => setEditType(e.target.value as EditType)}
          >
            {EDIT_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>{EDIT_TYPE_LABELS[value]}</option>
            ))}
          </select>
          <label style={labelStyle}>
            Note (optional)
          </label>
          <textarea
            style={textareaStyle}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. remove power lines, boost sky contrast, try black and white…"
            autoFocus
          />
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
            Leave blank to queue without a note.
          </p>
        </div>
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={onClose}>Cancel</button>
          <button
            type="button"
            style={{ ...confirmButtonStyle, ...(assetCount === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
            disabled={assetCount === 0}
            onClick={handleConfirm}
          >
            {isEdit ? 'Save' : assetCount > 1 ? `Add ${assetCount} to Queue` : 'Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}
