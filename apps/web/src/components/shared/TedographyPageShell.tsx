import React, { lazy, Suspense, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserMenu } from '../auth/UserMenu';

const ChangePinDialog = lazy(() =>
  import('../auth/ChangePinDialog').then((m) => ({ default: m.ChangePinDialog }))
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveArea =
  | 'Library'
  | 'Search'
  | 'People'
  | 'People Review'
  | 'Admin'
  | 'Admin/Users'
  | 'Admin/Roles';

export interface TedographyPageShellProps {
  activeArea: ActiveArea;
  children: ReactNode;
  /** When provided, the Library nav item calls this handler instead of using a plain Link. */
  onLibraryClick?: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: '#f3f4f6',
  fontFamily: 'Arial, sans-serif',
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px',
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  backgroundColor: '#fbfbfb',
  margin: '8px',
  flexShrink: 0,
  flexWrap: 'nowrap',
};

const titleStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  color: '#0f172a',
  textDecoration: 'none',
};

const spacerStyle: CSSProperties = { flex: 1 };

const navBase: CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  backgroundColor: '#f9fafb',
  color: '#374151',
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const navActive: CSSProperties = {
  ...navBase,
  backgroundColor: '#1d4ed8',
  borderColor: '#1d4ed8',
  color: '#fff',
  cursor: 'default',
};

const dividerStyle: CSSProperties = {
  width: 1,
  height: 20,
  backgroundColor: '#e2e8f0',
  flexShrink: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: '0 8px 8px',
  boxSizing: 'border-box',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TedographyPageShell({ activeArea, children, onLibraryClick }: TedographyPageShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [changePinOpen, setChangePinOpen] = useState(false);

  const isAdminArea =
    activeArea === 'Admin' || activeArea === 'Admin/Users' || activeArea === 'Admin/Roles';

  return (
    <div style={shellStyle}>
      <div style={toolbarStyle}>
        <Link to="/" style={titleStyle}>Tedography</Link>
        <div style={spacerStyle} />

        {/* ── People / standard areas ── */}
        {!isAdminArea && (
          <>
            {onLibraryClick ? (
              <button
                type="button"
                style={activeArea === 'Library' ? navActive : navBase}
                onClick={() => { onLibraryClick(); navigate('/?area=Library'); }}
              >
                Library
              </button>
            ) : (
              <Link to="/?area=Library" style={activeArea === 'Library' ? navActive : navBase}>Library</Link>
            )}
            <Link to="/?area=Search"  style={activeArea === 'Search'  ? navActive : navBase}>Search</Link>
            <Link to="/people"        style={activeArea === 'People'  ? navActive : navBase}>People</Link>
            <Link to="/people/review" style={activeArea === 'People Review' ? navActive : navBase}>People Review</Link>
          </>
        )}

        {/* ── Admin areas ── */}
        {isAdminArea && (
          <>
            <Link to="/" style={navBase}>Library</Link>
            {activeArea === 'Admin' ? (
              <span style={navActive}>Admin</span>
            ) : (
              <Link to="/admin" style={navBase}>Admin</Link>
            )}
            {activeArea === 'Admin/Users' && <span style={navActive}>Users</span>}
            {activeArea === 'Admin/Roles' && <span style={navActive}>Roles</span>}
          </>
        )}

        {/* ── User menu ── */}
        {user && (
          <>
            <div style={dividerStyle} />
            <UserMenu
              user={user}
              onChangePinClick={() => setChangePinOpen(true)}
              onLogout={() => { void logout(); }}
            />
          </>
        )}
      </div>

      <div style={contentStyle}>{children}</div>

      {changePinOpen && (
        <Suspense fallback={null}>
          <ChangePinDialog onClose={() => setChangePinOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
