import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type {
  DuplicateProvisionalGroupMemberDecision,
  ProvisionalDuplicateGroupListItem,
  ProvisionalDuplicateGroupMember
} from '@tedography/shared';
import {
  getProvisionalDuplicateGroup,
  listProvisionalDuplicateGroups,
  reopenProvisionalDuplicateGroup,
  resolveProvisionalDuplicateGroup
} from '../../api/duplicateCandidatePairApi';
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

const actionButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: '#0f4c5c',
  color: '#0f4c5c'
};

const primaryButtonStyle: CSSProperties = {
  ...selectedButtonStyle
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const groupGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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

const messageStyle: CSSProperties = {
  borderRadius: '12px',
  padding: '12px 14px',
  marginBottom: '18px',
  fontSize: '14px'
};

const decisionControlGroupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  marginTop: '4px'
};

const decisionButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '8px 10px',
  backgroundColor: '#fff',
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 700
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

function getDecisionLabel(decision: DuplicateProvisionalGroupMemberDecision): string {
  if (decision === 'keeper') {
    return 'Keeper';
  }

  if (decision === 'duplicate') {
    return 'Duplicate';
  }

  if (decision === 'not_in_group') {
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

function renderDecisionControls(input: {
  decision: DuplicateProvisionalGroupMemberDecision;
  disabled?: boolean;
  onChange: (decision: DuplicateProvisionalGroupMemberDecision) => void;
}): ReactElement {
  const { decision, disabled = false, onChange } = input;

  function getStyle(targetDecision: Exclude<DuplicateProvisionalGroupMemberDecision, 'unclassified'>): CSSProperties {
    if (decision === targetDecision) {
      return {
        ...decisionButtonStyle,
        backgroundColor: '#0f4c5c',
        borderColor: '#0f4c5c',
        color: '#fff'
      };
    }

    return disabled ? { ...decisionButtonStyle, opacity: 0.55, cursor: 'not-allowed' } : decisionButtonStyle;
  }

  return (
    <div style={decisionControlGroupStyle}>
      <button
        type="button"
        style={getStyle('keeper')}
        disabled={disabled}
        onClick={() => onChange('keeper')}
      >
        Keeper
      </button>
      <button
        type="button"
        style={getStyle('duplicate')}
        disabled={disabled}
        onClick={() => onChange('duplicate')}
      >
        Duplicate
      </button>
      <button
        type="button"
        style={getStyle('not_in_group')}
        disabled={disabled}
        onClick={() => onChange('not_in_group')}
      >
        Not In Group
      </button>
    </div>
  );
}

function renderMemberCard(input: {
  member: ProvisionalDuplicateGroupMember;
  decision: DuplicateProvisionalGroupMemberDecision;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onDecisionChange: (decision: DuplicateProvisionalGroupMemberDecision) => void;
}): ReactElement {
  const { member, decision, selected = false, disabled = false, onSelect, onDecisionChange } = input;
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
          <span style={badgeStyle}>{getDecisionLabel(decision)}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-word' }}>{member.asset.id}</div>
        {renderHistoricalCounts(member)}
        {renderDecisionControls({ decision, disabled, onChange: onDecisionChange })}
      </div>
    </>
  );

  if (!onSelect) {
    return <article style={cardStyle}>{inner}</article>;
  }

  return (
    <button type="button" onClick={onSelect} style={{ ...cardStyle, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
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
  const [draftDecisions, setDraftDecisions] = useState<Record<string, DuplicateProvisionalGroupMemberDecision>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        setSelectedGroupKey((current) => {
          if (current && response.groups.some((group) => group.groupKey === current)) {
            return current;
          }

          return response.groups[0]?.groupKey ?? null;
        });
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
      setDraftDecisions({});
      return;
    }

    let cancelled = false;
    const groupKey = selectedGroupKey;

    async function loadDetail(): Promise<void> {
      setDetailLoading(true);
      setError(null);

      try {
        const response = await getProvisionalDuplicateGroup(groupKey);
        if (cancelled) {
          return;
        }

        setSelectedGroup(response.group);
        setFocusedAssetId((current) => current ?? response.group.members[0]?.asset.id ?? null);
        setDraftDecisions(
          Object.fromEntries(
            response.group.members.map((member) => [member.asset.id, member.currentDecision ?? 'unclassified'])
          )
        );
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

  const selectedGroupKeySet = useMemo(
    () => new Set(selectedGroup?.members.map((member) => member.asset.id) ?? []),
    [selectedGroup]
  );

  const decisionSummary = useMemo(() => {
    const assetIds = Array.from(selectedGroupKeySet);
    const keeperAssetIds = assetIds.filter((assetId) => draftDecisions[assetId] === 'keeper');
    const duplicateAssetIds = assetIds.filter((assetId) => draftDecisions[assetId] === 'duplicate');
    const excludedAssetIds = assetIds.filter((assetId) => draftDecisions[assetId] === 'not_in_group');
    const unclassifiedCount = assetIds.filter((assetId) => {
      const decision = draftDecisions[assetId] ?? 'unclassified';
      return decision === 'unclassified';
    }).length;

    return {
      keeperAssetIds,
      duplicateAssetIds,
      excludedAssetIds,
      unclassifiedCount,
      isValid: keeperAssetIds.length === 1 && unclassifiedCount === 0
    };
  }, [draftDecisions, selectedGroupKeySet]);

  const focusedMember = useMemo(
    () => selectedGroup?.members.find((member) => member.asset.id === focusedAssetId) ?? selectedGroup?.members[0] ?? null,
    [focusedAssetId, selectedGroup]
  );

  useEffect(() => {
    if (!focusedMember && selectedGroup?.members[0]) {
      setFocusedAssetId(selectedGroup.members[0].asset.id);
    }
  }, [focusedMember, selectedGroup]);

  async function refreshGroups(preferredGroupKey?: string | null): Promise<void> {
    const response = await listProvisionalDuplicateGroups();
    setGroups(response.groups);
    const nextGroupKey =
      (preferredGroupKey && response.groups.some((group) => group.groupKey === preferredGroupKey)
        ? preferredGroupKey
        : null) ?? response.groups[0]?.groupKey ?? null;
    setSelectedGroupKey(nextGroupKey);
  }

  function updateDecision(assetId: string, nextDecision: DuplicateProvisionalGroupMemberDecision): void {
    setDraftDecisions((current) => {
      const next = { ...current };

      if (nextDecision === 'keeper') {
        for (const key of Object.keys(next)) {
          if (next[key] === 'keeper') {
            next[key] = 'duplicate';
          }
        }
      }

      next[assetId] = nextDecision;
      return next;
    });
    setNotice(null);
  }

  async function handleSave(): Promise<void> {
    if (!selectedGroup || !decisionSummary.isValid || decisionSummary.keeperAssetIds.length !== 1) {
      return;
    }

    const keeperAssetId = decisionSummary.keeperAssetIds[0];
    if (!keeperAssetId) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await resolveProvisionalDuplicateGroup(selectedGroup.groupKey, {
        keeperAssetId,
        duplicateAssetIds: decisionSummary.duplicateAssetIds,
        excludedAssetIds: decisionSummary.excludedAssetIds
      });

      await refreshGroups(response.resolvedGroupKey ?? selectedGroup.groupKey);
      setNotice(
        response.resolvedGroupKey
          ? `Saved group resolution for ${decisionSummary.duplicateAssetIds.length + 1} included assets.`
          : 'Saved group resolution. No duplicate set remains after this review.'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save duplicate group resolution');
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen(): Promise<void> {
    if (!selectedGroup) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await reopenProvisionalDuplicateGroup(selectedGroup.groupKey);
      await refreshGroups(selectedGroup.groupKey);
      setNotice('Reopened duplicate group for review.');
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : 'Failed to reopen duplicate group');
    } finally {
      setSaving(false);
    }
  }

  function getDecisionForMember(member: ProvisionalDuplicateGroupMember): DuplicateProvisionalGroupMemberDecision {
    return draftDecisions[member.asset.id] ?? member.currentDecision ?? 'unclassified';
  }

  const canReopen = selectedGroup?.resolutionStatus === 'confirmed';

  return (
    <main style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>Duplicate Group Review</h1>
          <p style={{ margin: '8px 0 0 0', color: '#475569', maxWidth: '760px' }}>
            Resolve provisional duplicate groups as groups, not only as pairs. Choose one keeper, mark the remaining
            assets as duplicates or not in this group, and keep historical pair review only as context.
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

      {error ? (
        <section style={{ ...messageStyle, backgroundColor: '#fee2e2', color: '#991b1b' }}>
          {error}
        </section>
      ) : null}

      {notice ? (
        <section style={{ ...messageStyle, backgroundColor: '#dcfce7', color: '#166534' }}>
          {notice}
        </section>
      ) : null}

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
                    setFocusedAssetId(null);
                    setNotice(null);
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
                <button
                  type="button"
                  style={decisionSummary.isValid && !saving ? primaryButtonStyle : disabledButtonStyle}
                  disabled={!decisionSummary.isValid || saving}
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {saving ? 'Saving...' : 'Save Group Resolution'}
                </button>
                {canReopen ? (
                  <button
                    type="button"
                    style={saving ? disabledButtonStyle : actionButtonStyle}
                    disabled={saving}
                    onClick={() => {
                      void handleReopen();
                    }}
                  >
                    Reopen Group
                  </button>
                ) : null}
                {detailLoading ? <span style={{ color: '#64748b' }}>Refreshing group...</span> : null}
              </div>

              <section style={{ ...summaryCardStyle, marginBottom: '18px' }}>
                <strong>Resolution Rules</strong>
                <div style={{ marginTop: '8px', color: '#475569', fontSize: '14px', display: 'grid', gap: '4px' }}>
                  <div>Keeper chosen: {decisionSummary.keeperAssetIds.length} / 1</div>
                  <div>Duplicates: {decisionSummary.duplicateAssetIds.length}</div>
                  <div>Not in group: {decisionSummary.excludedAssetIds.length}</div>
                  <div>Unclassified: {decisionSummary.unclassifiedCount}</div>
                </div>
              </section>

              {displayMode === 'grid' ? (
                <div style={groupGridStyle}>
                  {selectedGroup.members.map((member) => (
                    <div key={member.asset.id}>
                      {renderMemberCard({
                        member,
                        decision: getDecisionForMember(member),
                        selected: member.asset.id === focusedMember?.asset.id,
                        disabled: saving,
                        onSelect: () => setFocusedAssetId(member.asset.id),
                        onDecisionChange: (decision) => updateDecision(member.asset.id, decision)
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
                        <span style={badgeStyle}>{getDecisionLabel(getDecisionForMember(focusedMember))}</span>
                      </div>
                      <div style={{ marginTop: '10px', color: '#64748b', fontSize: '12px', wordBreak: 'break-word' }}>
                        {focusedMember.asset.id}
                      </div>
                      <div style={{ marginTop: '12px' }}>{renderHistoricalCounts(focusedMember)}</div>
                      <div style={{ marginTop: '12px' }}>
                        {renderDecisionControls({
                          decision: getDecisionForMember(focusedMember),
                          disabled: saving,
                          onChange: (decision) => updateDecision(focusedMember.asset.id, decision)
                        })}
                      </div>
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
                        <span style={{ ...badgeStyle, width: 'fit-content' }}>
                          {getDecisionLabel(getDecisionForMember(member))}
                        </span>
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
