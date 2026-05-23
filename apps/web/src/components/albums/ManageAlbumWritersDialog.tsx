import { useState, type CSSProperties } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';
import type { TedographyUser } from '@tedography/domain';
import { addAlbumWriter, removeAlbumWriter } from '../../api/albumTreeApi';

interface ManageAlbumWritersDialogProps {
  album: AlbumTreeNode | null;
  users: TedographyUser[];
  onClose: () => void;
  onAlbumUpdated: (album: AlbumTreeNode) => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1200,
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  padding: '24px 28px',
  minWidth: 340,
  maxWidth: 480,
  width: '100%',
};

const titleStyle: CSSProperties = {
  margin: '0 0 4px',
  fontSize: 16,
  fontWeight: 600,
  color: '#0f172a',
};

const subtitleStyle: CSSProperties = {
  margin: '0 0 18px',
  fontSize: 12,
  color: '#6b7280',
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const writerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  borderRadius: 6,
  backgroundColor: '#f8fafc',
  marginBottom: 6,
  fontSize: 13,
  color: '#1e293b',
};

const removeButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: 16,
  lineHeight: 1,
  padding: '0 2px',
};

const addRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 14,
};

const selectStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#0f172a',
};

const addButtonStyle: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const addButtonDisabledStyle: CSSProperties = {
  ...addButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: '#b91c1c',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 22,
  borderTop: '1px solid #e5e7eb',
  paddingTop: 14,
};

const closeButtonStyle: CSSProperties = {
  padding: '6px 18px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  cursor: 'pointer',
  color: '#374151',
};

export function ManageAlbumWritersDialog({
  album,
  users,
  onClose,
  onAlbumUpdated,
}: ManageAlbumWritersDialogProps): React.ReactElement | null {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  if (!album) return null;

  const writerIdSet = new Set(album.writerUserIds ?? []);
  const writers = users.filter((u) => writerIdSet.has(u.id));
  const candidates = users.filter((u) => !writerIdSet.has(u.id));

  async function handleAdd(): Promise<void> {
    if (!selectedUserId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await addAlbumWriter(album!.id, selectedUserId);
      onAlbumUpdated(updated);
      setSelectedUserId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add writer');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await removeAlbumWriter(album!.id, userId);
      onAlbumUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove writer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>Manage Writers</h3>
        <p style={subtitleStyle}>{album.label}</p>

        <div style={sectionLabelStyle}>Current writers</div>
        {writers.length === 0 ? (
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#9ca3af' }}>
            No writers — only admin can edit this album.
          </p>
        ) : (
          writers.map((u) => (
            <div key={u.id} style={writerRowStyle}>
              <span>
                {u.name}
                <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>{u.roleId}</span>
              </span>
              <button
                type="button"
                style={removeButtonStyle}
                title={`Remove ${u.name} as writer`}
                disabled={busy}
                onClick={() => void handleRemove(u.id)}
              >
                ×
              </button>
            </div>
          ))
        )}

        {candidates.length > 0 ? (
          <div style={addRowStyle}>
            <select
              style={selectStyle}
              value={selectedUserId}
              disabled={busy}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Add a writer…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleId})
                </option>
              ))}
            </select>
            <button
              type="button"
              style={!selectedUserId || busy ? addButtonDisabledStyle : addButtonStyle}
              disabled={!selectedUserId || busy}
              onClick={() => void handleAdd()}
            >
              Add
            </button>
          </div>
        ) : null}

        {error ? <p style={errorStyle}>{error}</p> : null}

        <div style={footerStyle}>
          <button type="button" style={closeButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
