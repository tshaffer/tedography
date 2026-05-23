import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import ShieldIcon from '@mui/icons-material/Shield';
import { useAuth } from '../../context/AuthContext';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f8fafc',
  padding: '48px 40px',
  fontFamily: 'system-ui, sans-serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 40,
};

const backLinkStyle: CSSProperties = {
  fontSize: 13,
  color: '#2563eb',
  textDecoration: 'none',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 700,
  color: '#0f172a',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 20,
  maxWidth: 560,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 10,
  padding: '24px 20px',
  backgroundColor: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e2e8f0',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'box-shadow 0.15s, border-color 0.15s',
};

const iconCircleStyle = (color: string): CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: '#0f172a',
};

const cardDescStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#64748b',
  lineHeight: 1.5,
};

const deniedStyle: CSSProperties = {
  textAlign: 'center',
  padding: '60px 0',
  color: '#9ca3af',
  fontSize: 14,
};

export function AdminPage(): React.ReactElement {
  const { user } = useAuth();

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
        <h1 style={titleStyle}>Admin</h1>
      </div>

      <div style={gridStyle}>
        <Link
          to="/admin/users"
          style={cardStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = '#c7d2fe';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e2e8f0';
          }}
        >
          <div style={iconCircleStyle('#e0f2fe')}>
            <PeopleIcon sx={{ fontSize: 22, color: '#0369a1' }} />
          </div>
          <p style={cardTitleStyle}>Users</p>
          <p style={cardDescStyle}>Create accounts, change roles, and remove users.</p>
        </Link>

        <Link
          to="/admin/roles"
          style={cardStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = '#c7d2fe';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e2e8f0';
          }}
        >
          <div style={iconCircleStyle('#fef9c3')}>
            <ShieldIcon sx={{ fontSize: 22, color: '#a16207' }} />
          </div>
          <p style={cardTitleStyle}>Roles</p>
          <p style={cardDescStyle}>Define what each role can do with per-feature permissions.</p>
        </Link>
      </div>
    </div>
  );
}
