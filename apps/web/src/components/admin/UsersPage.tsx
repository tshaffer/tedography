import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
  maxWidth: 640,
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

const deniedStyle: CSSProperties = {
  textAlign: 'center',
  padding: '60px 0',
  color: '#9ca3af',
  fontSize: 14,
};

export function UsersPage(): React.ReactElement {
  const { user, users } = useAuth();

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

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Link to="/" style={backLinkStyle}>← Library</Link>
        <h1 style={titleStyle}>Users</h1>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>User ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={tdStyle}>
                {u.name}
                {u.id === user.id ? (
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>(you)</span>
                ) : null}
              </td>
              <td style={tdStyle}>
                <span style={roleBadgeStyle(u.roleId)}>{u.roleId}</span>
              </td>
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>
                {u.id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
        To add or change users, run <code>pnpm users:create</code> from <code>apps/api/</code>.
      </p>
    </div>
  );
}
