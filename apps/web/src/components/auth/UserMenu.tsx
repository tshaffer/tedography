import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { TedographyUser } from '@tedography/domain';

// ---------------------------------------------------------------------------
// Avatar color palette — pick by hashing the user's name
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  { bg: '#e040fb', fg: '#fff' }, // purple
  { bg: '#26a69a', fg: '#fff' }, // teal
  { bg: '#ef5350', fg: '#fff' }, // red
  { bg: '#42a5f5', fg: '#fff' }, // blue
  { bg: '#66bb6a', fg: '#fff' }, // green
  { bg: '#ffa726', fg: '#fff' }, // orange
  { bg: '#ab47bc', fg: '#fff' }, // violet
  { bg: '#26c6da', fg: '#fff' }, // cyan
];

function avatarColor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const chipStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '3px 10px 3px 3px',
  borderRadius: 24,
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'box-shadow 0.15s',
};

const avatarStyle = (bg: string): CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: '50%',
  backgroundColor: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
});

const dropdownStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  backgroundColor: '#fff',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e2e8f0',
  minWidth: 220,
  overflow: 'hidden',
};

const dropdownHeaderStyle: CSSProperties = {
  padding: '14px 16px 12px',
  borderBottom: '1px solid #f1f5f9',
};

const dropdownNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: '#0f172a',
};

const roleBadgeStyle = (roleId: string): CSSProperties => ({
  display: 'inline-block',
  marginTop: 4,
  padding: '1px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor:
    roleId === 'admin' ? '#fef3c7' :
    roleId === 'full'  ? '#e0f2fe' : '#f3f4f6',
  color:
    roleId === 'admin' ? '#92400e' :
    roleId === 'full'  ? '#075985' : '#374151',
});

const menuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  background: 'none',
  fontSize: 13,
  color: '#1e293b',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 0.1s',
};

const menuItemDangerStyle: CSSProperties = {
  ...menuItemStyle,
  color: '#dc2626',
};

const dividerStyle: CSSProperties = {
  height: 1,
  backgroundColor: '#f1f5f9',
  margin: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UserMenuProps {
  user: TedographyUser;
  onChangePinClick: () => void;
  onLogout: () => void;
}

export function UserMenu({ user, onChangePinClick, onLogout }: UserMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const chipRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const color = avatarColor(user.name);

  function openMenu(): void {
    if (!chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  }

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent): void {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        chipRef.current  && !chipRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      {/* Chip */}
      <button
        ref={chipRef}
        type="button"
        style={{ ...chipStyle, boxShadow: open ? '0 0 0 2px #c7d2fe' : 'none' }}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div style={avatarStyle(color.bg)}>
          <span style={{ color: color.fg }}>{initials(user.name)}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>{user.name}</span>
        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>{open ? '▲' : '▾'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          style={{ ...dropdownStyle, top: dropdownPos.top, right: dropdownPos.right }}
          role="menu"
        >
          {/* Header */}
          <div style={dropdownHeaderStyle}>
            <p style={dropdownNameStyle}>{user.name}</p>
            <span style={roleBadgeStyle(user.roleId)}>{user.roleId}</span>
          </div>

          {/* Change PIN */}
          <button
            type="button"
            style={{ ...menuItemStyle, backgroundColor: hovered === 'pin' ? '#f8fafc' : 'transparent' }}
            onMouseEnter={() => setHovered('pin')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { setOpen(false); onChangePinClick(); }}
            role="menuitem"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>🔑</span>
            Change PIN
          </button>

          <div style={dividerStyle} />

          {/* Log out */}
          <button
            type="button"
            style={{ ...menuItemDangerStyle, backgroundColor: hovered === 'logout' ? '#fff5f5' : 'transparent' }}
            onMouseEnter={() => setHovered('logout')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { setOpen(false); onLogout(); }}
            role="menuitem"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>⎋</span>
            Log out
          </button>
        </div>
      )}
    </>
  );
}
