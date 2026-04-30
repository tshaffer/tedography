import { type CSSProperties } from 'react';
import { KeywordHierarchySection } from './KeywordHierarchySection';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1200
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  width: 'min(1100px, 96vw)',
  height: 'min(88vh, 760px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '16px'
};

const footerStyle: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  alignItems: 'center'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
};

interface KeywordManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onKeywordsChanged?: () => void;
}

export function KeywordManagementDialog({ open, onClose, onKeywordsChanged }: KeywordManagementDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Keyword Management</h2>
        <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
          Organize keywords into a parent-child hierarchy, create new keywords, and delete unused ones.
        </p>
        <div style={bodyStyle}>
          <KeywordHierarchySection open={open} onKeywordsChanged={onKeywordsChanged} />
        </div>
        <div style={footerStyle}>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
