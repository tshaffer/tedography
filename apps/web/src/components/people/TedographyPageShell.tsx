import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface TedographyPageShellProps {
  activeArea: 'Library' | 'Search' | 'People' | 'People Review';
  children: ReactNode;
}

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


const spacerStyle: CSSProperties = {
  flex: 1,
};

const areaButtonBase: CSSProperties = {
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

const areaButtonActive: CSSProperties = {
  ...areaButtonBase,
  backgroundColor: '#1d4ed8',
  borderColor: '#1d4ed8',
  color: '#fff',
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: '0 8px 8px',
  boxSizing: 'border-box',
};

export function TedographyPageShell({ activeArea, children }: TedographyPageShellProps) {
  return (
    <div style={shellStyle}>
      <div style={toolbarStyle}>
        <Link to="/" style={titleStyle}>Tedography</Link>
        <div style={spacerStyle} />
        <Link to="/?area=Library" style={activeArea === 'Library' ? areaButtonActive : areaButtonBase}>
          Library
        </Link>
        <Link to="/?area=Search" style={activeArea === 'Search' ? areaButtonActive : areaButtonBase}>
          Search
        </Link>
        <Link to="/people" style={activeArea === 'People' ? areaButtonActive : areaButtonBase}>
          People
        </Link>
        <Link to="/people/review" style={activeArea === 'People Review' ? areaButtonActive : areaButtonBase}>
          People Review
        </Link>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}
