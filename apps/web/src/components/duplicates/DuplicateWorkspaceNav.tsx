import type { CSSProperties, ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface DuplicateWorkspaceNavProps {
  active: 'overview' | 'review' | 'groups' | 'plans' | 'reconciliations';
}

const navStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px'
};

const linkStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 14px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 600
};

const activeLinkStyle: CSSProperties = {
  ...linkStyle,
  backgroundColor: '#0f4c5c',
  borderColor: '#0f4c5c',
  color: '#ffffff'
};

const items: Array<{
  key: DuplicateWorkspaceNavProps['active'];
  label: string;
  to: string;
}> = [
  { key: 'overview', label: 'Overview', to: '/duplicates' },
  { key: 'review', label: 'Review', to: '/duplicates/review' },
  { key: 'groups', label: 'Groups', to: '/duplicates/groups' },
  { key: 'plans', label: 'Plans', to: '/duplicates/plans' },
  { key: 'reconciliations', label: 'Reconciliations', to: '/duplicates/reconciliations' }
];

export function DuplicateWorkspaceNav({
  active
}: DuplicateWorkspaceNavProps): ReactElement {
  return (
    <nav aria-label="Duplicate workspace navigation" style={navStyle}>
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          style={item.key === active ? activeLinkStyle : linkStyle}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
