import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';

interface CreateTopLevelGroupDialogProps {
  open: boolean;
  nodes: AlbumTreeNode[];
  onClose: () => void;
  onCreate: (input: { label: string; targetIndex: number }) => Promise<void>;
}

type PositionOption = {
  index: number;
  label: string;
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1300
};

const dialogStyle: CSSProperties = {
  width: 'min(560px, 92vw)',
  maxHeight: 'min(720px, 90vh)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px',
  borderBottom: '1px solid #ececec'
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
  overflow: 'auto',
  display: 'grid',
  gap: '14px'
};

const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  color: '#444'
};

const inputStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  backgroundColor: '#fff'
};

const chooserPanelStyle: CSSProperties = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '10px',
  maxHeight: '320px',
  overflow: 'auto',
  backgroundColor: '#fbfbfb',
  display: 'grid',
  gap: '6px'
};

const positionButtonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: '13px',
  cursor: 'pointer'
};

const selectedPositionButtonStyle: CSSProperties = {
  backgroundColor: '#eef4ff',
  boxShadow: 'inset 0 0 0 1px #c7dafd'
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1f6feb',
  borderColor: '#1f6feb',
  color: '#fff'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

function compareGroups(left: AlbumTreeNode, right: AlbumTreeNode): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const labelComparison = left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id.localeCompare(right.id);
}

function buildPositionOptions(groups: AlbumTreeNode[]): PositionOption[] {
  if (groups.length === 0) {
    return [{ index: 0, label: '1. Only item' }];
  }

  return [
    { index: 0, label: '1. Beginning' },
    ...groups.map((group, index) => ({
      index: index + 1,
      label: `${index + 2}. After ${group.label}`
    }))
  ];
}

export function CreateTopLevelGroupDialog({
  open,
  nodes,
  onClose,
  onCreate
}: CreateTopLevelGroupDialogProps): ReactElement | null {
  const [label, setLabel] = useState('');
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const topLevelGroups = useMemo(
    () => nodes.filter((node) => node.parentId === null && node.nodeType === 'Group').sort(compareGroups),
    [nodes]
  );
  const positionOptions = useMemo(() => buildPositionOptions(topLevelGroups), [topLevelGroups]);
  const trimmedLabel = label.trim();
  const canCreate = trimmedLabel.length > 0 && !createPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setLabel('');
    setSelectedTargetIndex(topLevelGroups.length);
    setCreatePending(false);
    setCreateError(null);
  }, [open, topLevelGroups.length]);

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Add Top-Level Group</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
            Create a new top-level group and choose where it should appear among sibling groups.
          </p>
        </div>

        <div style={bodyStyle}>
          <label style={fieldLabelStyle}>
            <span>Group label</span>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              style={inputStyle}
              placeholder="Enter group label"
              autoFocus
            />
          </label>

          <div style={fieldLabelStyle}>
            <span>Position</span>
            <div style={chooserPanelStyle}>
              {positionOptions.map((option) => (
                <button
                  key={option.index}
                  type="button"
                  style={{
                    ...positionButtonStyle,
                    ...(selectedTargetIndex === option.index ? selectedPositionButtonStyle : {})
                  }}
                  onClick={() => setSelectedTargetIndex(option.index)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {createError ? <p style={{ margin: 0, color: '#b00020', fontSize: '13px' }}>{createError}</p> : null}
        </div>

        <div style={footerStyle}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            Click a position in the list to place the new group.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={buttonStyle} onClick={onClose} disabled={createPending}>
              Cancel
            </button>
            <button
              type="button"
              style={canCreate ? primaryButtonStyle : disabledButtonStyle}
              onClick={() => {
                if (!canCreate) {
                  return;
                }

                setCreatePending(true);
                setCreateError(null);
                void onCreate({ label: trimmedLabel, targetIndex: selectedTargetIndex })
                  .catch((error: unknown) => {
                    setCreateError(error instanceof Error ? error.message : 'Failed to create group');
                  })
                  .finally(() => {
                    setCreatePending(false);
                  });
              }}
              disabled={!canCreate}
            >
              {createPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
