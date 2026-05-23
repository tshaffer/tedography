import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { FEATURE_IDS, FEATURE_LABELS, type PermissionValue, type TedographyRole } from '@tedography/domain';
import { useAuth } from '../../context/AuthContext';
import { createRole, deleteRole, getRoles, updateRole } from '../../api/authApi';

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
};

const cardStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px 24px',
  marginBottom: 24,
};

const roleHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const roleTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: '#0f172a',
};

const roleIdStyle: CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  fontFamily: 'monospace',
  marginLeft: 8,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  color: '#1e293b',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

const permValueStyle = (val: PermissionValue): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor:
    val === 'allow'     ? '#dcfce7' :
    val === 'deny'      ? '#fee2e2' : '#fef9c3',
  color:
    val === 'allow'     ? '#166534' :
    val === 'deny'      ? '#991b1b' : '#854d0e',
});

const selectStyle: CSSProperties = {
  fontSize: 12,
  padding: '3px 6px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#0f172a',
  cursor: 'pointer',
};

const buttonStyle = (variant: 'primary' | 'danger' | 'ghost'): CSSProperties => ({
  padding: variant === 'ghost' ? '3px 8px' : '6px 14px',
  fontSize: variant === 'ghost' ? 11 : 12,
  borderRadius: 6,
  border: variant === 'primary' ? '1px solid #2563eb'
        : variant === 'danger'  ? '1px solid #dc2626'
        : '1px solid #d1d5db',
  backgroundColor: variant === 'primary' ? '#2563eb'
                 : variant === 'danger'  ? '#dc2626'
                 : '#f9fafb',
  color: variant === 'ghost' ? '#374151' : '#fff',
  cursor: 'pointer',
  fontWeight: 600,
});

const buttonDisabledStyle: CSSProperties = {
  opacity: 0.45,
  cursor: 'not-allowed',
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: '#b91c1c',
  marginTop: 8,
};

const createFormStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px 24px',
};

const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 14,
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
  width: 240,
  boxSizing: 'border-box',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PERMISSIONS = Object.fromEntries(
  FEATURE_IDS.map((f) => [f, 'allow' as PermissionValue])
) as Record<typeof FEATURE_IDS[number], PermissionValue>;

// ---------------------------------------------------------------------------
// Sub-component: permission grid for editing
// ---------------------------------------------------------------------------

function PermissionGrid({
  permissions,
  readOnly,
  onChange,
}: {
  permissions: Record<string, PermissionValue>;
  readOnly: boolean;
  onChange?: (featureId: string, value: PermissionValue) => void;
}): React.ReactElement {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Feature</th>
          <th style={{ ...thStyle, width: 150 }}>Permission</th>
        </tr>
      </thead>
      <tbody>
        {FEATURE_IDS.map((featureId) => {
          const val = (permissions[featureId] ?? 'allow') as PermissionValue;
          return (
            <tr key={featureId}>
              <td style={tdStyle}>{FEATURE_LABELS[featureId]}</td>
              <td style={tdStyle}>
                {readOnly ? (
                  <span style={permValueStyle(val)}>{val}</span>
                ) : (
                  <select
                    style={selectStyle}
                    value={val}
                    onChange={(e) => onChange?.(featureId, e.target.value as PermissionValue)}
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                    <option value="per-album">per-album</option>
                  </select>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single role card
// ---------------------------------------------------------------------------

function RoleCard({
  role,
  onSaved,
  onDeleted,
}: {
  role: TedographyRole;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, PermissionValue>>({ ...role.permissions });
  const [pendingDisplayName, setPendingDisplayName] = useState(role.displayName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuiltIn = role.id === 'admin' || role.id === 'full' || role.id === 'limited';

  function handleEditStart(): void {
    setPendingPermissions({ ...role.permissions });
    setPendingDisplayName(role.displayName);
    setError(null);
    setEditing(true);
  }

  function handleEditCancel(): void {
    setEditing(false);
    setError(null);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await updateRole(role.id, {
        displayName: pendingDisplayName,
        permissions: pendingPermissions as TedographyRole['permissions'],
      });
      setEditing(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    setError(null);
    try {
      await deleteRole(role.id);
      await onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={roleHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          {editing ? (
            <input
              type="text"
              style={{ ...inputStyle, width: 200, fontSize: 15, fontWeight: 700 }}
              value={pendingDisplayName}
              onChange={(e) => setPendingDisplayName(e.target.value)}
              disabled={saving}
            />
          ) : (
            <h3 style={roleTitleStyle}>{role.displayName}</h3>
          )}
          <span style={roleIdStyle}>{role.id}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {editing ? (
            <>
              <button
                type="button"
                style={{ ...buttonStyle('primary'), ...(saving ? buttonDisabledStyle : {}) }}
                disabled={saving || pendingDisplayName.trim().length === 0}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                style={buttonStyle('ghost')}
                disabled={saving}
                onClick={handleEditCancel}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                style={buttonStyle('ghost')}
                onClick={handleEditStart}
              >
                Edit
              </button>
              {!isBuiltIn && (
                confirmDelete ? (
                  <>
                    <button
                      type="button"
                      style={{ ...buttonStyle('danger'), ...(deleting ? buttonDisabledStyle : {}) }}
                      disabled={deleting}
                      onClick={() => void handleDelete()}
                    >
                      {deleting ? '…' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      style={buttonStyle('ghost')}
                      disabled={deleting}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    style={{ ...buttonStyle('ghost'), color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>

      <PermissionGrid
        permissions={editing ? pendingPermissions : role.permissions}
        readOnly={!editing}
        onChange={(f, v) => setPendingPermissions((prev) => ({ ...prev, [f]: v }))}
      />

      {error ? <p style={errorStyle}>{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RolesPage(): React.ReactElement {
  const { user } = useAuth();
  const [roles, setRoles] = useState<TedographyRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Create-role form
  const [newId, setNewId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPermissions, setNewPermissions] = useState<Record<string, PermissionValue>>({ ...DEFAULT_PERMISSIONS });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadRoles(): Promise<void> {
    try {
      const { roles: r } = await getRoles();
      setRoles(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.roleId === 'admin') {
      void loadRoles();
    } else {
      setLoading(false);
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

  async function handleCreate(): Promise<void> {
    if (creating) return;
    if (!newId.trim() || !newDisplayName.trim()) return;

    // Validate id — alphanumeric + hyphens only
    if (!/^[a-z0-9-]+$/.test(newId.trim())) {
      setCreateError('Role ID must be lowercase letters, numbers, and hyphens only');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await createRole({
        id: newId.trim(),
        displayName: newDisplayName.trim(),
        permissions: newPermissions as TedographyRole['permissions'],
      });
      setNewId('');
      setNewDisplayName('');
      setNewPermissions({ ...DEFAULT_PERMISSIONS });
      await loadRoles();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create role');
    } finally {
      setCreating(false);
    }
  }

  const canCreate = !creating && newId.trim().length > 0 && newDisplayName.trim().length > 0;

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Link to="/admin" style={backLinkStyle}>← Admin</Link>
        <h1 style={titleStyle}>Roles</h1>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', maxWidth: 640 }}>
        Roles define what each user can do. The three built-in roles (admin, full, limited) can be
        edited but not deleted. Custom roles can be deleted as long as no users are assigned to them.
      </p>

      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          onSaved={loadRoles}
          onDeleted={loadRoles}
        />
      ))}

      {/* ---- Create role ---- */}
      <p style={sectionTitleStyle}>Create role</p>
      <div style={createFormStyle}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Role ID</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. viewer"
              value={newId}
              disabled={creating}
              onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Lowercase letters, numbers, hyphens</span>
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Display name</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Viewer"
              value={newDisplayName}
              disabled={creating}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
          </div>
        </div>

        <p style={{ ...labelStyle, marginBottom: 8 }}>Permissions</p>
        <div style={{ maxWidth: 480, marginBottom: 16 }}>
          <PermissionGrid
            permissions={newPermissions}
            readOnly={false}
            onChange={(f, v) => setNewPermissions((prev) => ({ ...prev, [f]: v }))}
          />
        </div>

        <button
          type="button"
          style={{ ...buttonStyle('primary'), ...(canCreate ? {} : buttonDisabledStyle) }}
          disabled={!canCreate}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Creating…' : 'Create role'}
        </button>

        {createError ? <p style={errorStyle}>{createError}</p> : null}
      </div>
    </div>
  );
}
