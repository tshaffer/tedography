import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { TedographyUser } from '@tedography/domain';
import { useAuth } from '../../context/AuthContext';
import { createUser, getRoles, updateUserRole } from '../../api/authApi';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f8fafc',
  padding: '32px 40px',
  fontFamily: 'system-ui, sans-serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 28,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: '#0f172a',
};

const backLinkStyle: CSSProperties = {
  fontSize: 13,
  color: '#2563eb',
  textDecoration: 'none',
};

const tableStyle: CSSProperties = {
  width: '100%',
  maxWidth: 720,
  borderCollapse: 'collapse',
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  overflow: 'hidden',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  backgroundColor: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 13,
  color: '#1e293b',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

const roleBadgeStyle = (roleId: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor:
    roleId === 'admin' ? '#fef3c7' :
    roleId === 'full'  ? '#e0f2fe' : '#f3f4f6',
  color:
    roleId === 'admin' ? '#92400e' :
    roleId === 'full'  ? '#075985' : '#374151',
});

const selectStyle: CSSProperties = {
  fontSize: 12,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#0f172a',
  cursor: 'pointer',
};

const saveButtonStyle: CSSProperties = {
  marginLeft: 6,
  padding: '4px 10px',
  fontSize: 11,
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const deniedStyle: CSSProperties = {
  textAlign: 'center',
  padding: '60px 0',
  color: '#9ca3af',
  fontSize: 14,
};

const sectionTitleStyle: CSSProperties = {
  margin: '32px 0 12px',
  fontSize: 15,
  fontWeight: 600,
  color: '#0f172a',
  maxWidth: 720,
};

const createFormStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px 24px',
  maxWidth: 720,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'flex-end',
};

const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: CSSProperties = {
  fontSize: 13,
  padding: '6px 9px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#0f172a',
  width: 160,
  boxSizing: 'border-box',
};

const createButtonStyle: CSSProperties = {
  padding: '7px 18px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const createButtonDisabledStyle: CSSProperties = {
  ...createButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: '#b91c1c',
  marginTop: 8,
  maxWidth: 720,
};

const successStyle: CSSProperties = {
  fontSize: 12,
  color: '#15803d',
  marginTop: 8,
  maxWidth: 720,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsersPage(): React.ReactElement {
  const { user, users, refreshUsers } = useAuth();
  const [roles, setRoles] = useState<{ id: string; displayName: string }[]>([]);

  // Per-row editing state: userId → pending roleId
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Create-user form
  const [newName, setNewName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.roleId === 'admin') {
      getRoles()
        .then(({ roles: r }) => {
          setRoles(r);
          if (r.length > 0) setNewRoleId(r[0]!.id);
        })
        .catch(() => { /* ignore */ });
    }
  }, [user?.roleId]);

  if (user?.roleId !== 'admin') {
    return (
      <div style={pageStyle}>
        <div style={deniedStyle}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Access denied</p>
          <p>This page is only available to admins.</p>
          <Link to="/" style={backLinkStyle}>← Back to library</Link>
        </div>
      </div>
    );
  }

  async function handleRoleSave(targetUser: TedographyUser): Promise<void> {
    const roleId = pendingRoles[targetUser.id];
    if (!roleId || roleId === targetUser.roleId) return;
    setSavingRole(targetUser.id);
    setRowError((prev) => ({ ...prev, [targetUser.id]: '' }));
    try {
      await updateUserRole(targetUser.id, roleId);
      await refreshUsers();
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[targetUser.id];
        return next;
      });
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [targetUser.id]: e instanceof Error ? e.message : 'Failed to save role',
      }));
    } finally {
      setSavingRole(null);
    }
  }

  async function handleCreate(): Promise<void> {
    if (creating || !newName.trim() || !newRoleId || newPin.trim().length < 4) return;
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const created = await createUser({ name: newName.trim(), roleId: newRoleId, pin: newPin });
      await refreshUsers();
      setNewName('');
      setNewPin('');
      setCreateSuccess(`User "${created.name}" created successfully.`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  const canCreate = !creating && newName.trim().length > 0 && newRoleId.length > 0 && newPin.trim().length >= 4;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Link to="/" style={backLinkStyle}>← Library</Link>
        <h1 style={titleStyle}>Users</h1>
      </div>

      {/* ---- User table ---- */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>User ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === user.id;
            const pending = pendingRoles[u.id];
            const isDirty = pending !== undefined && pending !== u.roleId;
            const err = rowError[u.id];

            return (
              <tr key={u.id}>
                <td style={tdStyle}>
                  {u.name}
                  {isSelf ? (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>(you)</span>
                  ) : null}
                </td>
                <td style={tdStyle}>
                  {isSelf ? (
                    // Can't change own role — show badge only
                    <span style={roleBadgeStyle(u.roleId)}>{u.roleId}</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <select
                        style={selectStyle}
                        value={pending ?? u.roleId}
                        disabled={savingRole === u.id}
                        onChange={(e) =>
                          setPendingRoles((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>
                      {isDirty ? (
                        <button
                          type="button"
                          style={saveButtonStyle}
                          disabled={savingRole === u.id}
                          onClick={() => void handleRoleSave(u)}
                        >
                          {savingRole === u.id ? '…' : 'Save'}
                        </button>
                      ) : null}
                      {err ? (
                        <span style={{ fontSize: 11, color: '#b91c1c', marginLeft: 4 }}>{err}</span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>
                  {u.id}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---- Create user ---- */}
      <p style={sectionTitleStyle}>Create user</p>
      <div style={createFormStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="Full name"
            value={newName}
            disabled={creating}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Role</label>
          <select
            style={{ ...selectStyle, fontSize: 13, padding: '6px 8px', width: 120 }}
            value={newRoleId}
            disabled={creating}
            onChange={(e) => setNewRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Initial PIN</label>
          <input
            type="password"
            style={inputStyle}
            placeholder="Min. 4 characters"
            value={newPin}
            disabled={creating}
            onChange={(e) => setNewPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) void handleCreate(); }}
          />
        </div>
        <button
          type="button"
          style={canCreate ? createButtonStyle : createButtonDisabledStyle}
          disabled={!canCreate}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>

      {createError ? <p style={errorStyle}>{createError}</p> : null}
      {createSuccess ? <p style={successStyle}>{createSuccess}</p> : null}
    </div>
  );
}
