import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { PeopleBrowseSort, PeopleBrowseSummaryItem } from '@tedography/shared';
import { listPeopleBrowse } from '../../api/peoplePipelineApi';
import { getThumbnailMediaUrl } from '../../utilities/mediaUrls';

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '0 auto',
  padding: '16px',
  maxWidth: '1500px',
  backgroundColor: '#f3f4f6',
  minHeight: '100vh',
  boxSizing: 'border-box'
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px'
};

const linkStyle: CSSProperties = {
  color: '#0f5f73',
  fontWeight: 700,
  textDecoration: 'none'
};

const panelStyle: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #d7dce2',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '14px',
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)'
};

const controlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  alignItems: 'end'
};

const inputStyle: CSSProperties = {
  border: '1px solid #c8d0d9',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  minWidth: '0'
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#556677',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '6px'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '16px'
};

const cardStyle: CSSProperties = {
  ...panelStyle,
  marginBottom: 0,
  padding: '14px',
  display: 'grid',
  gap: '10px'
};

const previewFrameStyle: CSSProperties = {
  borderRadius: '14px',
  overflow: 'hidden',
  border: '1px solid #d7dce2',
  backgroundColor: '#edf2f7'
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  backgroundColor: '#d8e1ea'
};

const placeholderStyle: CSSProperties = {
  ...previewImageStyle,
  display: 'grid',
  placeItems: 'center',
  color: '#516273',
  fontSize: '38px',
  fontWeight: 700
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const warningBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#fff7e8',
  borderColor: '#e7c77d',
  color: '#805a00'
};

const buttonLinkStyle: CSSProperties = {
  display: 'inline-block',
  border: '1px solid #c6d0da',
  borderRadius: '8px',
  backgroundColor: '#f7f9fb',
  color: '#163246',
  fontSize: '13px',
  fontWeight: 700,
  padding: '8px 12px',
  textDecoration: 'none'
};

const sortOptions: Array<{ value: PeopleBrowseSort; label: string }> = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'mostAssets', label: 'Most Assets' },
  { value: 'mostRecentlySeen', label: 'Most Recently Seen' },
  { value: 'needsReview', label: 'Needs Review' }
];

function formatRelativeAssetCount(count: number): string {
  return `${count} asset${count === 1 ? '' : 's'}`;
}

function formatSeenAt(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

export function PeopleBrowsePage() {
  const [items, setItems] = useState<PeopleBrowseSummaryItem[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [sortBy, setSortBy] = useState<PeopleBrowseSort>('alphabetical');
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await listPeopleBrowse();
        setItems(response.items);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load people');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const visibleItems = useMemo(() => {
    const normalizedQuery = nameQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (!showArchived && item.person.isArchived) {
        return false;
      }

      if (!showHidden && item.person.isHidden) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return item.person.displayName.toLowerCase().includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === 'mostAssets') {
        return right.assetCount - left.assetCount || left.person.displayName.localeCompare(right.person.displayName);
      }

      if (sortBy === 'mostRecentlySeen') {
        const leftSeen = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
        const rightSeen = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
        return rightSeen - leftSeen || left.person.displayName.localeCompare(right.person.displayName);
      }

      if (sortBy === 'needsReview') {
        return (
          right.reviewableAssetCount - left.reviewableAssetCount ||
          right.assetCount - left.assetCount ||
          left.person.displayName.localeCompare(right.person.displayName)
        );
      }

      return left.person.displayName.localeCompare(right.person.displayName);
    });
  }, [items, nameQuery, showArchived, showHidden, sortBy]);

  return (
    <div style={pageStyle}>
      <div style={linkRowStyle}>
        <Link to="/" style={linkStyle}>
          Back to Library
        </Link>
        <Link to="/people/review" style={linkStyle}>
          People Review
        </Link>
        <Link to="/people/dev" style={linkStyle}>
          People Dev Harness
        </Link>
      </div>

      <section style={panelStyle}>
        <h1 style={{ margin: '0 0 10px', fontSize: '32px' }}>People</h1>
        <p style={{ margin: '0 0 14px', color: '#5b6673' }}>
          Browse known people by confirmed asset presence. Click a person to open their tedography detail page and jump from there into Search or review work.
        </p>

        <div style={controlsGridStyle}>
          <div>
            <span style={labelStyle}>Find Person</span>
            <input
              type="text"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="Search by display name"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div>
            <span style={labelStyle}>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as PeopleBrowseSort)}
              style={{ ...inputStyle, width: '100%' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label style={{ fontSize: '13px', color: '#223447', display: 'grid', gap: '6px' }}>
            <span style={labelStyle}>Visibility</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived people
            </span>
          </label>
          <label style={{ fontSize: '13px', color: '#223447', display: 'grid', gap: '6px' }}>
            <span style={labelStyle}>Hidden</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(event) => setShowHidden(event.target.checked)}
              />
              Show hidden people
            </span>
          </label>
        </div>
      </section>

      {loading ? <section style={panelStyle}>Loading people...</section> : null}
      {errorMessage ? <section style={panelStyle}>Unable to load people: {errorMessage}</section> : null}
      {!loading && !errorMessage && items.length === 0 ? (
        <section style={panelStyle}>No people yet.</section>
      ) : null}
      {!loading && !errorMessage && items.length > 0 && visibleItems.length === 0 ? (
        <section style={panelStyle}>No people match this filter.</section>
      ) : null}

      {!loading && !errorMessage && visibleItems.length > 0 ? (
        <section style={gridStyle}>
          {visibleItems.map((item) => {
            const personHref = `/people/${encodeURIComponent(item.person.id)}`;
            const personInitial = item.person.displayName.trim().charAt(0).toUpperCase() || '?';

            return (
              <article key={item.person.id} style={cardStyle}>
                <div style={previewFrameStyle}>
                  {item.representativeAssetId ? (
                    <img
                      src={getThumbnailMediaUrl(item.representativeAssetId)}
                      alt={item.person.displayName}
                      style={previewImageStyle}
                    />
                  ) : (
                    <div style={placeholderStyle}>{personInitial}</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#142736' }}>
                    {item.person.displayName}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#5b6673' }}>
                    Confirmed in {formatRelativeAssetCount(item.assetCount)}
                  </div>
                </div>

                <div style={badgeRowStyle}>
                  <span style={badgeStyle}>{formatRelativeAssetCount(item.assetCount)}</span>
                  <span style={item.exampleCount < 3 ? warningBadgeStyle : badgeStyle}>
                    {item.exampleCount === 0 ? 'Not enrolled' : `${item.exampleCount} examples`}
                  </span>
                  {item.reviewableAssetCount > 0 ? (
                    <span style={warningBadgeStyle}>
                      {item.reviewableAssetCount} asset{item.reviewableAssetCount === 1 ? '' : 's'} need review
                    </span>
                  ) : null}
                  {item.person.isArchived ? <span style={badgeStyle}>Archived</span> : null}
                  {item.person.isHidden ? <span style={badgeStyle}>Hidden</span> : null}
                </div>

                <div style={{ fontSize: '12px', color: '#566577' }}>
                  Last seen: {formatSeenAt(item.lastSeenAt)}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link to={personHref} style={buttonLinkStyle}>
                    Open Person
                  </Link>
                  <Link to="/people/review" style={buttonLinkStyle}>
                    Open Review Queue
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
