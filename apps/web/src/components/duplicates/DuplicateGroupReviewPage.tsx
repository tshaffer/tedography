import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type {
  ProvisionalDuplicateGroupListItem,
  ProvisionalDuplicateGroupMember
} from '@tedography/shared';
import { getProvisionalDuplicateGroup, listProvisionalDuplicateGroups } from '../../api/duplicateCandidatePairApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';

type DuplicateGroupDisplayMode = 'grid' | 'focus';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '20px',
  boxSizing: 'border-box',
  background: '#f4f1ea',
  color: '#1e293b',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
};

const pageHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  marginBottom: '18px'
};

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '14px',
  backgroundColor: '#fffdf9',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
};

const linkStyle: CSSProperties = {
  color: '#0f4c5c',
  textDecoration: 'none',
  fontWeight: 600
};

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  gap: '18px',
  alignItems: 'start'
};

const sidebarListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  maxHeight: 'calc(100vh - 200px)',
  overflowY: 'auto'
};

const groupRowButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  backgroundColor: '#fff',
  padding: '12px',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'grid',
  gap: '6px'
};

const metadataGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '18px'
};

const summaryCardStyle: CSSProperties = {
  ...panelStyle,
  padding: '14px'
};

const controlBarStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: '18px'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 14px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer',
  fontWeight: 600
};

const selectedButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f4c5c',
  borderColor: '#0f4c5c',
  color: '#ffffff'
};

const groupGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px'
};

const memberCardStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '14px',
  overflow: 'hidden',
  background: '#fff'
};

const memberImageWrapStyle: CSSProperties = {
  height: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
};

const memberImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block'
};

const memberBodyStyle: CSSProperties = {
  padding: '12px',
  display: 'grid',
  gap: '8px'
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700,
  backgroundColor: '#e2e8f0',
  color: '#0f172a'
};

const focusLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '18px',
  alignItems: 'start'
};

const focusImageWrapStyle: CSSProperties = {
  ...panelStyle,
  padding: '12px',
  minHeight: '560px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)'
};

const focusImageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '70vh',
  objectFit: 'contain',
  display: 'block'
};

const filmstripStyle: CSSProperties = {
  display: 'grid',
  gap: '10px'
};

const filmstripButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  backgroundColor: '#fff',
  padding: '10px',
  cursor: 'pointer',
  display: 'grid',
  gap: '8px'
};

function getReviewStatusLabel(status: ProvisionalDuplicateGroupListItem['reviewStatus']): string {
  if (status === 'resolved') {
    return 'Resolved';
  }

  if (status === 'needs_rereview') {
    return 'Needs Re-review';
  }

  return 'Unresolved';
}

function getDecisionLabel(member: ProvisionalDuplicateGroupMember): string {
  if (member.currentDecision === 'keeper') {
    return 'Keeper';
  }

  if (member.currentDecision === 'duplicate') {
    return 'Duplicate';
  }

  if (member.currentDecision === 'not_in_group') {
    return 'Not In Group';
  }

  return 'Unclassified';
}

function renderHistoricalCounts(member: ProvisionalDuplicateGroupMember): ReactElement | null {
  if (!member.historicalCounts) {
    return null;
  }

  return (
    <div style={{ fontSize: '12px', color: '#475569', display: 'grid', gap: '4px' }}>
      <div>Historical keeper: {member.historicalCounts.keeperCount}</div>
      <div>Historical duplicate: {member.historicalCounts.duplicateCount}</div>
      <div>Historical not duplicate: {member.historicalCounts.notDuplicateCount}</div>
    </div>
  );
}

function renderMemberCard(input: {
  member: ProvisionalDuplicateGroupMember;
  selected?: boolean;
  onClick?: () => void;
}): ReactElement {
  const { member, selected = false, onClick } = input;
  const cardStyle = selected
    ? { ...memberCardStyle, borderColor: '#0f4c5c', boxShadow: '0 0 0 2px rgba(15, 76, 92, 0.14)' }
    : memberCardStyle;

  const inner = (
    <>
      <div style={memberImageWrapStyle}>
        <img
          src={getDisplayMediaUrl(member.asset.id)}
          alt={member.asset.filename}
          style={memberImageStyle}
          loading="lazy"
        />
      </div>
      <div style={memberBodyStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
          <strong style={{ fontSize: '14px', wordBreak: 'break-word' }}>{member.asset.filename}</strong>
          <span style={badgeStyle}>{getDecisionLabel(member)}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-word' }}>{member.asset.id}</div>
        {renderHistoricalCounts(member)}
      </div>
    </>
  );

  if (!onClick) {
    return <article style={cardStyle}>{inner}</article>;
  }

  return (
    <button type="button" onClick={onClick} style={{ ...cardStyle, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
      {inner}
    </button>
  );
}

export function DuplicateGroupReviewPage(): ReactElement {
  const [groups, setGroups] = useState<ProvisionalDuplicateGroupListItem[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ProvisionalDuplicateGroupListItem | null>(null);
  const [displayMode, setDisplayMode] = useState<DuplicateGroupDisplayMode>('grid');
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await listProvisionalDuplicateGroups();
        if (cancelled) {
          return;
        }

        setGroups(response.groups);
        const firstGroupKey = response.groups[0]?.groupKey ?? null;
        setSelectedGroupKey((current) => current ?? firstGroupKey);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load provisional duplicate groups');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGroupKey) {
      setSelectedGroup(null);
      return;
    }

    let cancelled = false;

    async function loadDetail(): Promise<void> {
      setDetailLoading(true);
      try {
        const response = await getProvisionalDuplicateGroup(selectedGroupKey as string);
        if (cancelled) {
          return;
        }

        setSelectedGroup(response.group);
        setFocusedAssetId((current) => current ?? response.group.members[0]?.asset.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load provisional duplicate group');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupKey]);

  const focusedMember = useMemo(
    () => selectedGroup?.members.find((member) => member.asset.id === focusedAssetId) ?? selectedGroup?.members[0] ?? null,
    [focusedAssetId, selectedGroup]
  );

  useEffect(() => {
    if (!focusedMember && selectedGroup?.members[0]) {
      setFocusedAssetId(selectedGroup.members[0].asset.id);
    }
  }, [focusedMember, selectedGroup]);

  return (
    <main style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>Duplicate Group Review</h1>
          <p style={{ margin: '8px 0 0 0', color: '#475569', maxWidth: '760px' }}>
            Review provisional duplicate groups as groups, not only as pairs. This phase is read-only and shows the
            current candidate grouping, current resolved role if any, and best-effort historical hints.
          </p>
        </div>
        <div style={headerActionsStyle}>
          <Link to="/duplicates/review" style={linkStyle}>
            Open Pair Review
          </Link>
          <Link to="/" style={linkStyle}>
            Back To Library
          </Link>
        </div>
      </header>

      {error ? <section style={panelStyle}>Failed to load duplicate groups: {error}</section> : null}

      <section style={layoutStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Provisional Groups</h2>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            {loading ? 'Loading groups...' : `${groups.length} groups`}
          </div>
          <div style={sidebarListStyle}>
            {groups.map((group) => {
              const isSelected = group.groupKey === selectedGroupKey;
              return (
                <button
                  key={group.groupKey}
                  type="button"
                  style={{
                    ...groupRowButtonStyle,
                    borderColor: isSelected ? '#0f4c5c' : '#cbd5e1',
                    boxShadow: isSelected ? '0 0 0 2px rgba(15, 76, 92, 0.14)' : 'none'
                  }}
                  onClick={() => {
                    setSelectedGroupKey(group.groupKey);
                    setFocusedAssetId(group.members[0]?.asset.id ?? null);
                  }}
                >
                  <strong>{group.assetCount} assets</strong>
                  <span>{getReviewStatusLabel(group.reviewStatus)}</span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{group.groupKey}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={panelStyle}>
          {!selectedGroup ? (
            <div>{loading ? 'Loading selected group...' : 'No provisional duplicate groups found.'}</div>
          ) : (
            <>
              <div style={metadataGridStyle}>
                <article style={summaryCardStyle}>
                  <strong>Review Status</strong>
                  <div style={{ marginTop: '6px' }}>{getReviewStatusLabel(selectedGroup.reviewStatus)}</div>
                </article>
                <article style={summaryCardStyle}>
                  <strong>Assets</strong>
                  <div style={{ marginTop: '6px' }}>{selectedGroup.assetCount}</div>
                </article>
                <article style={summaryCardStyle}>
                  <strong>Candidate Pair Links</strong>
                  <div style={{ marginTop: '6px' }}>{selectedGroup.candidatePairCount}</div>
                </article>
                <article style={summaryCardStyle}>
                  <strong>Current Canonical</strong>
                  <div style={{ marginTop: '6px' }}>{selectedGroup.selectedCanonicalAssetId ?? 'None resolved yet'}</div>
                </article>
              </div>

              <div style={controlBarStyle}>
                <button
                  type="button"
                  style={displayMode === 'grid' ? selectedButtonStyle : buttonStyle}
                  onClick={() => setDisplayMode('grid')}
                >
                  Grid Mode
                </button>
                <button
                  type="button"
                  style={displayMode === 'focus' ? selectedButtonStyle : buttonStyle}
                  onClick={() => setDisplayMode('focus')}
                >
                  Focus Mode
                </button>
                {detailLoading ? <span style={{ color: '#64748b' }}>Refreshing group...</span> : null}
              </div>

              {displayMode === 'grid' ? (
                <div style={groupGridStyle}>
                  {selectedGroup.members.map((member) => (
                    <div key={member.asset.id}>
                      {renderMemberCard({
                        member,
                        selected: member.asset.id === focusedMember?.asset.id,
                        onClick: () => setFocusedAssetId(member.asset.id)
                      })}
                    </div>
                  ))}
                </div>
              ) : focusedMember ? (
                <div style={focusLayoutStyle}>
                  <div style={focusImageWrapStyle}>
                    <img
                      src={getDisplayMediaUrl(focusedMember.asset.id)}
                      alt={focusedMember.asset.filename}
                      style={focusImageStyle}
                    />
                  </div>
                  <div style={filmstripStyle}>
                    <section style={summaryCardStyle}>
                      <strong>{focusedMember.asset.filename}</strong>
                      <div style={{ marginTop: '8px' }}>
                        <span style={badgeStyle}>{getDecisionLabel(focusedMember)}</span>
                      </div>
                      <div style={{ marginTop: '10px', color: '#64748b', fontSize: '12px', wordBreak: 'break-word' }}>
                        {focusedMember.asset.id}
                      </div>
                      <div style={{ marginTop: '12px' }}>{renderHistoricalCounts(focusedMember)}</div>
                    </section>
                    {selectedGroup.members.map((member) => (
                      <button
                        key={member.asset.id}
                        type="button"
                        style={{
                          ...filmstripButtonStyle,
                          borderColor: member.asset.id === focusedMember.asset.id ? '#0f4c5c' : '#cbd5e1'
                        }}
                        onClick={() => setFocusedAssetId(member.asset.id)}
                      >
                        <strong style={{ textAlign: 'left' }}>{member.asset.filename}</strong>
                        <span style={{ ...badgeStyle, width: 'fit-content' }}>{getDecisionLabel(member)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default DuplicateGroupReviewPage;
