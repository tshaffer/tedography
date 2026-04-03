import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AlbumTreeNode } from '@tedography/domain';
import type {
  DuplicateProvisionalGroupMemberDecision,
  ProvisionalDuplicateGroupListItem,
  ProvisionalDuplicateGroupMember
} from '@tedography/shared';
import { listAlbumTreeNodes } from '../../api/albumTreeApi';
import {
  acceptProvisionalDuplicateGroupAsFinal,
  getProvisionalDuplicateGroup,
  listProvisionalDuplicateGroups,
  reopenProvisionalDuplicateGroup,
  resolveLargerProvisionalDuplicateGroupAsFinal,
  resolveProvisionalDuplicateGroup
} from '../../api/duplicateCandidatePairApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';
import { applyOptimisticDuplicateGroupVisibilityUpdate } from './duplicateVisibilityRefresh';

type DuplicateGroupDisplayMode = 'grid' | 'focus';
const provisionalGroupPageSize = 50;
const duplicateGroupMinScoreStorageKey = 'tedography.duplicates.groups.minScore';

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
  gap: '8px',
  outline: 'none',
  boxShadow: 'none'
};

const messageStyle: CSSProperties = {
  borderRadius: '12px',
  padding: '12px 14px',
  marginBottom: '18px',
  fontSize: '14px'
};

const inputStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  backgroundColor: '#fff',
  width: '100%',
  boxSizing: 'border-box'
};

const focusDetailCardStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  backgroundColor: '#fff',
  padding: '14px'
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
  albumLabel: string;
  decision: DuplicateProvisionalGroupMemberDecision;
  selected?: boolean;
  disabled?: boolean;
  inCompareSet?: boolean;
  onSelect?: () => void;
  onToggleCompare?: () => void;
  mirroredAction?: {
    label: string;
    disabled: boolean;
    style: CSSProperties;
    onClick: () => void;
  };
  onDecisionChange: (decision: DuplicateProvisionalGroupMemberDecision) => void;
}): ReactElement {
  const {
    member,
    albumLabel,
    decision,
    selected = false,
    disabled = false,
    inCompareSet = false,
    onSelect,
    onToggleCompare,
    mirroredAction,
    onDecisionChange
  } = input;
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
        <div style={{ fontSize: '12px', color: '#475569', wordBreak: 'break-word' }}>
          <strong>Albums:</strong> {albumLabel}
        </div>
        {renderHistoricalCounts(member)}
        {renderDecisionControls({ decision, disabled, onChange: onDecisionChange })}
        {onToggleCompare ? (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={disabled ? disabledButtonStyle : actionButtonStyle} disabled={disabled} onClick={onToggleCompare}>
              {inCompareSet ? 'Remove From Compare' : 'Add To Compare'}
            </button>
            {mirroredAction ? (
              <button
                type="button"
                style={mirroredAction.style}
                disabled={mirroredAction.disabled}
                onClick={mirroredAction.onClick}
              >
                {mirroredAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
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
  const location = useLocation();
  const [draftMinScore, setDraftMinScore] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(duplicateGroupMinScoreStorageKey) ?? '';
  });
  const [appliedMinScore, setAppliedMinScore] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem(duplicateGroupMinScoreStorageKey) ?? '';
  });
  const [groups, setGroups] = useState<ProvisionalDuplicateGroupListItem[]>([]);
  const [totalGroupCount, setTotalGroupCount] = useState(0);
  const [groupSummary, setGroupSummary] = useState({
    needs_rereview: 0,
    unresolved: 0,
    resolved: 0
  });
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ProvisionalDuplicateGroupListItem | null>(null);
  const [displayMode, setDisplayMode] = useState<DuplicateGroupDisplayMode>('grid');
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
  const [compareAssetIds, setCompareAssetIds] = useState<string[]>([]);
  const [focusScope, setFocusScope] = useState<'all' | 'compare'>('all');
  const [draftDecisions, setDraftDecisions] = useState<Record<string, DuplicateProvisionalGroupMemberDecision>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMoreGroups, setLoadingMoreGroups] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailReloadToken, setDetailReloadToken] = useState(0);
  const [albumNodesById, setAlbumNodesById] = useState<Map<string, AlbumTreeNode>>(new Map());
  const parsedAppliedMinScore = Number.parseFloat(appliedMinScore);
  const normalizedAppliedMinScore =
    Number.isFinite(parsedAppliedMinScore) && parsedAppliedMinScore > 0 ? parsedAppliedMinScore : undefined;
  const previewOnly = normalizedAppliedMinScore !== undefined;
  const requestedGroupKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('groupKey');
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }, [location.search]);

  function buildSpecificGroupPlaceholder(
    groupKey: string,
    selectedCanonicalAssetId: string | null = null
  ): ProvisionalDuplicateGroupListItem {
    const assetIds = groupKey.split('__').filter(Boolean);
    return {
      groupKey,
      assetIds,
      assetCount: assetIds.length,
      candidatePairCount: 0,
      reviewStatus: 'resolved',
      selectedCanonicalAssetId,
      resolutionStatus: 'confirmed',
      members: []
    };
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nodes = await listAlbumTreeNodes();
        if (cancelled) {
          return;
        }

        setAlbumNodesById(new Map(nodes.map((node) => [node.id, node])));
      } catch {
        if (!cancelled) {
          setAlbumNodesById(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await listProvisionalDuplicateGroups({
          limit: provisionalGroupPageSize,
          offset: 0,
          ...(normalizedAppliedMinScore !== undefined ? { minScore: normalizedAppliedMinScore } : {}),
          ...(previewOnly ? { previewOnly: true } : {})
        });
        if (cancelled) {
          return;
        }

        const nextGroups =
          requestedGroupKey && !response.groups.some((group) => group.groupKey === requestedGroupKey)
            ? [buildSpecificGroupPlaceholder(requestedGroupKey), ...response.groups]
            : response.groups;

        setGroups(nextGroups);
        setTotalGroupCount(response.totalGroups);
        setGroupSummary(response.summary);
        setGroupsHasMore(response.hasMore);
        setSelectedGroupKey((current) =>
          current && nextGroups.some((group) => group.groupKey === current)
            ? current
            : requestedGroupKey ?? null
        );
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
  }, [normalizedAppliedMinScore, previewOnly, requestedGroupKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(duplicateGroupMinScoreStorageKey, appliedMinScore);
  }, [appliedMinScore]);

  useEffect(() => {
    if (!selectedGroupKey) {
      setSelectedGroup(null);
      setDraftDecisions({});
      setFocusedAssetId(null);
      setCompareAssetIds([]);
      setFocusScope('all');
      return;
    }

    let cancelled = false;
    const groupKey = selectedGroupKey;

    async function loadDetail(): Promise<void> {
      setDetailLoading(true);
      setError(null);
      setCompareAssetIds([]);
      setFocusScope('all');

      try {
        const response = await getProvisionalDuplicateGroup(groupKey, {
          ...(normalizedAppliedMinScore !== undefined ? { minScore: normalizedAppliedMinScore } : {}),
          ...(previewOnly ? { previewOnly: true } : {})
        });
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
  }, [detailReloadToken, normalizedAppliedMinScore, previewOnly, selectedGroupKey]);

  const selectedGroupKeySet = useMemo(
    () => new Set(selectedGroup?.members.map((member) => member.asset.id) ?? []),
    [selectedGroup]
  );
  const compareAssetIdSet = useMemo(() => new Set(compareAssetIds), [compareAssetIds]);
  const effectiveFocusScope = focusScope === 'compare' && compareAssetIds.length > 0 ? 'compare' : 'all';

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

  const focusMembers = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    if (effectiveFocusScope !== 'compare') {
      return selectedGroup.members;
    }

    return selectedGroup.members.filter((member) => compareAssetIdSet.has(member.asset.id));
  }, [compareAssetIdSet, effectiveFocusScope, selectedGroup]);

  function getAlbumLabelForMember(member: ProvisionalDuplicateGroupMember): string {
    const albumLabels = (member.asset.albumIds ?? [])
      .map((albumId) => albumNodesById.get(albumId))
      .filter((node): node is AlbumTreeNode => node?.nodeType === 'Album')
      .map((node) => node.label);

    return albumLabels.length > 0 ? albumLabels.join(', ') : 'No Album';
  }

  const focusedMember = useMemo(
    () => focusMembers.find((member) => member.asset.id === focusedAssetId) ?? focusMembers[0] ?? null,
    [focusMembers, focusedAssetId]
  );

  useEffect(() => {
    if (!focusedMember && focusMembers[0]) {
      setFocusedAssetId(focusMembers[0].asset.id);
    }
  }, [focusMembers, focusedMember]);

  useEffect(() => {
    if (displayMode !== 'focus' || focusMembers.length === 0) {
      return;
    }

    const focusMemberIds = focusMembers.map((member) => member.asset.id);

    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement
      ) {
        return;
      }

      if (focusMemberIds.length === 0) {
        return;
      }

      const currentIndex = focusMemberIds.findIndex((assetId) => assetId === focusedAssetId);
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const delta = event.key === 'ArrowUp' ? -1 : 1;
      const nextIndex = (safeCurrentIndex + delta + focusMemberIds.length) % focusMemberIds.length;

      event.preventDefault();
      setFocusedAssetId(focusMemberIds[nextIndex] ?? null);
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [displayMode, focusMembers, focusedAssetId]);

  async function refreshGroups(preferredGroupKey?: string | null): Promise<void> {
    const reloadLimit = Math.max(groups.length, provisionalGroupPageSize);
    const response = await listProvisionalDuplicateGroups({
      limit: reloadLimit,
      offset: 0,
      ...(normalizedAppliedMinScore !== undefined ? { minScore: normalizedAppliedMinScore } : {}),
      ...(previewOnly ? { previewOnly: true } : {})
    });
    setGroups(response.groups);
    setTotalGroupCount(response.totalGroups);
    setGroupSummary(response.summary);
    setGroupsHasMore(response.hasMore);
    const nextGroupKey =
      (preferredGroupKey && response.groups.some((group) => group.groupKey === preferredGroupKey)
        ? preferredGroupKey
        : null) ?? null;
    setSelectedGroupKey(nextGroupKey);
    setDetailReloadToken((current) => current + 1);
  }

  function findPreviousNonResolvedGroupKey(groupKey: string): string | null {
    const currentIndex = groups.findIndex((group) => group.groupKey === groupKey);
    if (currentIndex <= 0) {
      return null;
    }

    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const candidate = groups[index];
      if (candidate && candidate.reviewStatus !== 'resolved') {
        return candidate.groupKey;
      }
    }

    return null;
  }

  function removeSelectedGroupFromLoadedSidebar(): void {
    if (!selectedGroup) {
      return;
    }

    setGroups((current) => current.filter((group) => group.groupKey !== selectedGroup.groupKey));
    setTotalGroupCount((current) => Math.max(0, current - 1));
    setSelectedGroupKey(null);
    setSelectedGroup(null);
    setFocusedAssetId(null);
    setDraftDecisions({});
  }

  function applyOptimisticResolvedGroupState(input: {
    resolvedGroupKey: string;
    keeperAssetId: string;
  }): void {
    if (!selectedGroup) {
      return;
    }

    const includedAssetIds = [input.keeperAssetId, ...decisionSummary.duplicateAssetIds];
    const includedAssetIdSet = new Set(includedAssetIds);
    const nextMembers = selectedGroup.members
      .filter((member) => includedAssetIdSet.has(member.asset.id))
      .map((member) => ({
        ...member,
        currentDecision:
          member.asset.id === input.keeperAssetId ? 'keeper' : ('duplicate' as DuplicateProvisionalGroupMemberDecision)
      }));

    const nextGroup: ProvisionalDuplicateGroupListItem = {
      ...selectedGroup,
      groupKey: input.resolvedGroupKey,
      assetIds: includedAssetIds,
      assetCount: includedAssetIds.length,
      reviewStatus: 'resolved',
      selectedCanonicalAssetId: input.keeperAssetId,
      resolutionStatus: 'confirmed',
      members: nextMembers
    };

    setSelectedGroup(nextGroup);
    setSelectedGroupKey(input.resolvedGroupKey);
    setDraftDecisions(
      Object.fromEntries(
        nextMembers.map((member) => [
          member.asset.id,
          member.asset.id === input.keeperAssetId ? 'keeper' : 'duplicate'
        ])
      )
    );
    setGroups((current) =>
      current.map((group) =>
        group.groupKey === selectedGroup.groupKey
          ? {
              ...group,
              groupKey: input.resolvedGroupKey,
              assetIds: includedAssetIds,
              assetCount: includedAssetIds.length,
              reviewStatus: 'resolved',
              selectedCanonicalAssetId: input.keeperAssetId,
              resolutionStatus: 'confirmed'
            }
          : group
      )
    );
  }

  function applyOptimisticReopenedGroupState(): void {
    if (!selectedGroup) {
      return;
    }

    const nextGroup: ProvisionalDuplicateGroupListItem = {
      ...selectedGroup,
      reviewStatus: 'unresolved',
      selectedCanonicalAssetId: null,
      resolutionStatus: null,
      members: selectedGroup.members.map((member) => ({
        ...member,
        currentDecision: 'unclassified'
      }))
    };

    setSelectedGroup(nextGroup);
    setDraftDecisions(
      Object.fromEntries(nextGroup.members.map((member) => [member.asset.id, 'unclassified']))
    );
    setGroups((current) =>
      current.map((group) =>
        group.groupKey === selectedGroup.groupKey
          ? {
              ...group,
              reviewStatus: 'unresolved',
              selectedCanonicalAssetId: null,
              resolutionStatus: null
            }
          : group
      )
    );
  }

  async function handleLoadHistoricalHints(): Promise<void> {
    if (!selectedGroupKey) {
      return;
    }

    setHistoryLoading(true);
    setError(null);

    try {
      const response = await getProvisionalDuplicateGroup(selectedGroupKey, {
        includeHistoricalCounts: true,
        ...(normalizedAppliedMinScore !== undefined ? { minScore: normalizedAppliedMinScore } : {}),
        ...(previewOnly ? { previewOnly: true } : {})
      });

      setSelectedGroup(response.group);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load historical hints');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleLoadMoreGroups(): Promise<void> {
    setLoadingMoreGroups(true);
    setError(null);

    try {
      const response = await listProvisionalDuplicateGroups({
        limit: provisionalGroupPageSize,
        offset: groups.length,
        ...(normalizedAppliedMinScore !== undefined ? { minScore: normalizedAppliedMinScore } : {}),
        ...(previewOnly ? { previewOnly: true } : {})
      });

      setGroups((current) => {
        const seen = new Set(current.map((group) => group.groupKey));
        return current.concat(response.groups.filter((group) => !seen.has(group.groupKey)));
      });
      setTotalGroupCount(response.totalGroups);
      setGroupSummary(response.summary);
      setGroupsHasMore(response.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more provisional duplicate groups');
    } finally {
      setLoadingMoreGroups(false);
    }
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

        if (selectedGroup) {
          for (const member of selectedGroup.members) {
            if (member.asset.id === assetId) {
              continue;
            }

            const currentDecision = current[member.asset.id] ?? member.currentDecision ?? 'unclassified';
            if (currentDecision === 'unclassified') {
              next[member.asset.id] = 'duplicate';
            }
          }
        }
      }

      next[assetId] = nextDecision;
      return next;
    });
    setNotice(null);
  }

  function setAllUnclassifiedToDuplicates(): void {
    if (!selectedGroup) {
      return;
    }

    setDraftDecisions((current) => {
      const next = { ...current };

      for (const member of selectedGroup.members) {
        const currentDecision = current[member.asset.id] ?? member.currentDecision ?? 'unclassified';
        if (currentDecision === 'unclassified') {
          next[member.asset.id] = 'duplicate';
        }
      }

      return next;
    });
    setNotice(null);
  }

  function toggleCompareAsset(assetId: string): void {
    setCompareAssetIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((currentAssetId) => currentAssetId !== assetId);
      }

      return current.concat(assetId);
    });
    setNotice(null);
  }

  function openSpecificGroup(input: {
    groupKey: string;
    assetCount: number;
    selectedCanonicalAssetId?: string | null;
  }): void {
    setGroups((current) => {
      if (current.some((group) => group.groupKey === input.groupKey)) {
        return current;
      }

      return [
        {
          ...buildSpecificGroupPlaceholder(input.groupKey, input.selectedCanonicalAssetId ?? null),
          assetCount: input.assetCount,
        },
        ...current
      ];
    });
    setSelectedGroupKey(input.groupKey);
    setFocusedAssetId(null);
    setNotice(null);
  }

  function handleApplyMinScorePreview(): void {
    const trimmed = draftMinScore.trim();
    const parsed = Number.parseFloat(trimmed);
    const normalized = Number.isFinite(parsed) && parsed > 0 ? trimmed : '';
    setAppliedMinScore(normalized);
    setSelectedGroupKey(null);
    setSelectedGroup(null);
    setNotice(
      normalized.length > 0
        ? `Previewing provisional groups with min score ${normalized}. This only affects the current derived view until you explicitly save group resolutions.`
        : 'Previewing provisional groups without a minimum score filter.'
    );
  }

  function handleResetMinScorePreview(): void {
    setDraftMinScore('');
    setAppliedMinScore('');
    setSelectedGroupKey(null);
    setSelectedGroup(null);
    setNotice('Previewing provisional groups without a minimum score filter.');
  }

  async function handleSave(): Promise<void> {
    if (!selectedGroup || !decisionSummary.isValid || decisionSummary.keeperAssetIds.length !== 1) {
      return;
    }

    const previousNonResolvedGroupKey = findPreviousNonResolvedGroupKey(selectedGroup.groupKey);
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

      applyOptimisticDuplicateGroupVisibilityUpdate({
        groupKey: response.resolvedGroupKey ?? selectedGroup.groupKey,
        keeperAssetId: response.resolvedGroupKey ? keeperAssetId : null,
        includedAssetIds: response.resolvedGroupKey
          ? [keeperAssetId, ...decisionSummary.duplicateAssetIds]
          : [],
        clearedAssetIds: selectedGroup.assetIds
      });
      if (response.noOp) {
        setNotice('Group resolution already matches the current confirmed result. Nothing changed.');
      } else if (response.resolvedGroupKey) {
        applyOptimisticResolvedGroupState({
          resolvedGroupKey: response.resolvedGroupKey,
          keeperAssetId
        });
        setSelectedGroupKey(previousNonResolvedGroupKey);
        setSelectedGroup(null);
        setFocusedAssetId(null);
        setDraftDecisions({});
        setNotice(
          `Saved group resolution for ${decisionSummary.duplicateAssetIds.length + 1} included assets.`
        );
      } else {
        removeSelectedGroupFromLoadedSidebar();
        setSelectedGroupKey(previousNonResolvedGroupKey);
        setNotice('Saved group resolution. No duplicate set remains after this review.');
      }
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
      applyOptimisticDuplicateGroupVisibilityUpdate({
        groupKey: selectedGroup.groupKey,
        keeperAssetId: null,
        includedAssetIds: [],
        clearedAssetIds: selectedGroup.assetIds
      });
      applyOptimisticReopenedGroupState();
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
  const canAcceptCurrentAsFinal =
    selectedGroup?.reviewStatus === 'needs_rereview' &&
    selectedGroup.resolutionStatus === 'confirmed' &&
    (selectedGroup.rereviewCause?.canAcceptCurrentGroupAsFinal ?? false);
  const hasOverlappingConfirmedGroups =
    (selectedGroup?.rereviewCause?.overlappingConfirmedGroups.length ?? 0) > 0;
  const hasHistoricalHints =
    selectedGroup?.members.some((member) => member.historicalCounts !== undefined) ?? false;
  const currentResolutionMatchesDraft =
    selectedGroup?.resolutionStatus === 'confirmed' &&
    selectedGroup.selectedCanonicalAssetId !== undefined &&
    selectedGroup.selectedCanonicalAssetId !== null &&
    decisionSummary.excludedAssetIds.length === 0 &&
    decisionSummary.unclassifiedCount === 0 &&
    decisionSummary.keeperAssetIds.length === 1 &&
    decisionSummary.keeperAssetIds[0] === selectedGroup.selectedCanonicalAssetId &&
    selectedGroup.assetIds.length === decisionSummary.keeperAssetIds.length + decisionSummary.duplicateAssetIds.length &&
    selectedGroup.assetIds.every(
      (assetId) =>
        assetId === selectedGroup.selectedCanonicalAssetId ||
        decisionSummary.duplicateAssetIds.includes(assetId)
    );
  const saveWouldBeNoOp = Boolean(currentResolutionMatchesDraft);
  const canSaveGroupResolution =
    decisionSummary.isValid && !saving && !saveWouldBeNoOp && !hasOverlappingConfirmedGroups;
  const canResolveLargerGroupAsFinal =
    decisionSummary.isValid && !saving && hasOverlappingConfirmedGroups;

  const mirroredMemberAction = canSaveGroupResolution
    ? {
        label: saving ? 'Saving...' : saveWouldBeNoOp ? 'Already Saved' : 'Save Group Resolution',
        disabled: !canSaveGroupResolution,
        style: canSaveGroupResolution ? primaryButtonStyle : disabledButtonStyle,
        onClick: () => {
          void handleSave();
        }
      }
    : canResolveLargerGroupAsFinal
      ? {
          label: 'Resolve Larger Group As Final',
          disabled: saving,
          style: saving ? disabledButtonStyle : primaryButtonStyle,
          onClick: () => {
            void handleResolveLargerGroupAsFinal();
          }
        }
      : canAcceptCurrentAsFinal
        ? {
            label: 'Accept Current Group As Final',
            disabled: saving,
            style: saving ? disabledButtonStyle : actionButtonStyle,
            onClick: () => {
              void handleAcceptCurrentAsFinal();
            }
          }
        : canReopen
          ? {
              label: 'Reopen Group',
              disabled: saving,
              style: saving ? disabledButtonStyle : actionButtonStyle,
              onClick: () => {
                void handleReopen();
              }
            }
          : null;

  async function handleAcceptCurrentAsFinal(): Promise<void> {
    if (!selectedGroup || !canAcceptCurrentAsFinal) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await acceptProvisionalDuplicateGroupAsFinal(selectedGroup.groupKey);
      setSelectedGroup((current) => {
        if (!current) {
          return current;
        }

        const { rereviewCause: _ignoredRereviewCause, ...rest } = current;
        return {
          ...rest,
          reviewStatus: 'resolved'
        };
      });
      setGroups((current) =>
        current.map((group) =>
          group.groupKey === selectedGroup.groupKey
            ? (() => {
                const { rereviewCause: _ignoredRereviewCause, ...rest } = group;
                return {
                  ...rest,
                  reviewStatus: 'resolved' as const
                };
              })()
            : group
        )
      );
      setGroupSummary((current) => ({
        needs_rereview: Math.max(0, current.needs_rereview - 1),
        unresolved: current.unresolved,
        resolved: current.resolved + 1
      }));
      setNotice('Accepted the current confirmed group as final and cleared the rereview marker.');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept current group as final');
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveLargerGroupAsFinal(): Promise<void> {
    if (!selectedGroup || !decisionSummary.isValid || decisionSummary.keeperAssetIds.length !== 1) {
      return;
    }

    const previousNonResolvedGroupKey = findPreviousNonResolvedGroupKey(selectedGroup.groupKey);
    const keeperAssetId = decisionSummary.keeperAssetIds[0];
    if (!keeperAssetId) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await resolveLargerProvisionalDuplicateGroupAsFinal(selectedGroup.groupKey, {
        keeperAssetId,
        duplicateAssetIds: decisionSummary.duplicateAssetIds,
        excludedAssetIds: decisionSummary.excludedAssetIds
      });

      applyOptimisticDuplicateGroupVisibilityUpdate({
        groupKey: response.resolvedGroupKey ?? selectedGroup.groupKey,
        keeperAssetId: response.resolvedGroupKey ? keeperAssetId : null,
        includedAssetIds: response.resolvedGroupKey
          ? [keeperAssetId, ...decisionSummary.duplicateAssetIds]
          : [],
        clearedAssetIds: selectedGroup.assetIds
      });

      if (response.resolvedGroupKey) {
        applyOptimisticResolvedGroupState({
          resolvedGroupKey: response.resolvedGroupKey,
          keeperAssetId
        });
        setSelectedGroupKey(previousNonResolvedGroupKey);
        setSelectedGroup(null);
        setFocusedAssetId(null);
        setDraftDecisions({});
        setNotice(
          `Resolved the larger overlapping group as final for ${decisionSummary.duplicateAssetIds.length + 1} included assets.`
        );
      } else {
        removeSelectedGroupFromLoadedSidebar();
        setSelectedGroupKey(previousNonResolvedGroupKey);
        setNotice('Resolved the larger overlapping group. No duplicate set remains after this review.');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to resolve larger overlapping duplicate group');
    } finally {
      setSaving(false);
    }
  }

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

      <section style={metadataGridStyle}>
        <article style={summaryCardStyle}>
          <strong>Needs Re-review</strong>
          <div style={{ marginTop: '6px' }}>{groupSummary.needs_rereview}</div>
        </article>
        <article style={summaryCardStyle}>
          <strong>Unresolved</strong>
          <div style={{ marginTop: '6px' }}>{groupSummary.unresolved}</div>
        </article>
        <article style={summaryCardStyle}>
          <strong>Resolved</strong>
          <div style={{ marginTop: '6px' }}>{groupSummary.resolved}</div>
        </article>
      </section>

      <section style={layoutStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Provisional Groups</h2>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
              <span>Min Score Preview</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftMinScore}
                onChange={(event) => setDraftMinScore(event.target.value)}
                placeholder="Any score"
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={loading || saving ? disabledButtonStyle : actionButtonStyle}
                disabled={loading || saving}
                onClick={handleApplyMinScorePreview}
              >
                Preview Groups
              </button>
              <button
                type="button"
                style={loading || saving ? disabledButtonStyle : buttonStyle}
                disabled={loading || saving}
                onClick={handleResetMinScorePreview}
              >
                Clear Preview
              </button>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              {normalizedAppliedMinScore !== undefined
                ? `Current preview threshold: score >= ${normalizedAppliedMinScore.toFixed(2)}`
                : 'Current preview threshold: any score'}
            </div>
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            {loading ? 'Loading groups...' : `${groups.length} loaded${totalGroupCount > 0 ? ` of ${totalGroupCount}` : ''}`}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button"
              style={loading || saving ? disabledButtonStyle : actionButtonStyle}
              disabled={loading || saving}
              onClick={() => {
                void refreshGroups(selectedGroupKey);
              }}
            >
              Refresh Groups
            </button>
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
            {groupsHasMore ? (
              <button
                type="button"
                style={loadingMoreGroups ? disabledButtonStyle : actionButtonStyle}
                disabled={loadingMoreGroups}
                onClick={() => {
                  void handleLoadMoreGroups();
                }}
              >
                {loadingMoreGroups ? 'Loading More…' : 'Load More Groups'}
              </button>
            ) : null}
          </div>
        </aside>

        <section style={panelStyle}>
          {!selectedGroup ? (
            <div>
              {detailLoading && selectedGroupKey
                ? 'Loading selected provisional group...'
                : loading
                ? 'Loading provisional groups...'
                : groups.length === 0
                  ? 'No provisional duplicate groups found.'
                  : 'Select a provisional group to load its detail.'}
            </div>
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
                {displayMode === 'focus' ? (
                  <>
                    <button
                      type="button"
                      style={effectiveFocusScope === 'all' ? selectedButtonStyle : buttonStyle}
                      onClick={() => setFocusScope('all')}
                    >
                      View All
                    </button>
                    <button
                      type="button"
                      style={
                        compareAssetIds.length === 0
                          ? disabledButtonStyle
                          : effectiveFocusScope === 'compare'
                            ? selectedButtonStyle
                            : buttonStyle
                      }
                      disabled={compareAssetIds.length === 0}
                      onClick={() => setFocusScope('compare')}
                    >
                      {compareAssetIds.length > 0 ? `Compare Set (${compareAssetIds.length})` : 'Compare Set'}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  style={canSaveGroupResolution ? primaryButtonStyle : disabledButtonStyle}
                  disabled={!canSaveGroupResolution}
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {saving ? 'Saving...' : saveWouldBeNoOp ? 'Already Saved' : 'Save Group Resolution'}
                </button>
                {canResolveLargerGroupAsFinal ? (
                  <button
                    type="button"
                    style={saving ? disabledButtonStyle : primaryButtonStyle}
                    disabled={saving}
                    onClick={() => {
                      void handleResolveLargerGroupAsFinal();
                    }}
                  >
                    Resolve Larger Group As Final
                  </button>
                ) : null}
                {canAcceptCurrentAsFinal ? (
                  <button
                    type="button"
                    style={saving ? disabledButtonStyle : actionButtonStyle}
                    disabled={saving}
                    onClick={() => {
                      void handleAcceptCurrentAsFinal();
                    }}
                  >
                    Accept Current Group As Final
                  </button>
                ) : null}
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
                {!hasHistoricalHints ? (
                  <button
                    type="button"
                    style={historyLoading || saving ? disabledButtonStyle : actionButtonStyle}
                    disabled={historyLoading || saving}
                    onClick={() => {
                      void handleLoadHistoricalHints();
                    }}
                  >
                    {historyLoading ? 'Loading History...' : 'Load Historical Hints'}
                  </button>
                ) : null}
                {detailLoading ? <span style={{ color: '#64748b' }}>Loading group...</span> : null}
              </div>

              <section style={{ ...summaryCardStyle, marginBottom: '18px' }}>
                <strong>Resolution Rules</strong>
                <div style={{ marginTop: '8px', color: '#475569', fontSize: '14px', display: 'grid', gap: '4px' }}>
                  <div>Keeper chosen: {decisionSummary.keeperAssetIds.length} / 1</div>
                  <div>Duplicates: {decisionSummary.duplicateAssetIds.length}</div>
                  <div>Not in group: {decisionSummary.excludedAssetIds.length}</div>
                  <div>Unclassified: {decisionSummary.unclassifiedCount}</div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    style={
                      saving || detailLoading || decisionSummary.unclassifiedCount === 0
                        ? disabledButtonStyle
                        : actionButtonStyle
                    }
                    disabled={saving || detailLoading || decisionSummary.unclassifiedCount === 0}
                    onClick={() => {
                      setAllUnclassifiedToDuplicates();
                    }}
                  >
                    Set All Unclassified To Duplicates
                  </button>
                </div>
              </section>

              {selectedGroup.reviewStatus === 'needs_rereview' && selectedGroup.rereviewCause ? (
                <section style={{ ...summaryCardStyle, marginBottom: '18px' }}>
                  <strong>Why Needs Re-review?</strong>
                  <div style={{ marginTop: '8px', color: '#475569', fontSize: '14px', display: 'grid', gap: '10px' }}>
                    <div>
                      <strong>Overlapping Confirmed Groups:</strong>{' '}
                      {selectedGroup.rereviewCause.overlappingConfirmedGroups.length}
                    </div>
                    {selectedGroup.rereviewCause.overlappingConfirmedGroups.length > 0 ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {selectedGroup.rereviewCause.overlappingConfirmedGroups.map((group) => (
                          <div
                            key={group.groupKey}
                            style={{
                              fontSize: '13px',
                              color: '#64748b',
                              display: 'flex',
                              gap: '10px',
                              alignItems: 'center',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span>
                              {group.assetCount} assets · keeper {group.selectedCanonicalAssetId} ·{' '}
                              {group.keeperInCurrentGroup ? 'keeper is in this group' : 'keeper is outside this group'} ·{' '}
                              {group.insideAssetCount} inside this group · {group.outsideAssetCount} outside this view
                              {group.outsideAssetCount > 0 ? ' · warning: this overlap includes assets you are not looking at' : ''}
                              <br />
                              <span style={{ color: '#94a3b8', wordBreak: 'break-word' }}>{group.groupKey}</span>
                            </span>
                            <button
                              type="button"
                              style={saving ? disabledButtonStyle : actionButtonStyle}
                              disabled={saving}
                              onClick={() => {
                                openSpecificGroup(group);
                              }}
                            >
                              Open Group
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <strong>External Candidate Links:</strong>{' '}
                      {selectedGroup.rereviewCause.externalCandidateLinks.length}
                    </div>
                    {selectedGroup.rereviewCause.externalCandidateLinks.length > 0 ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {selectedGroup.rereviewCause.externalCandidateLinks.slice(0, 12).map((link) => (
                          <div key={`${link.insideAssetId}__${link.outsideAssetId}`} style={{ fontSize: '13px', color: '#64748b' }}>
                            inside {link.insideAssetId} → outside {link.outsideAsset?.filename ?? link.outsideAssetId}
                          </div>
                        ))}
                        {selectedGroup.rereviewCause.externalCandidateLinks.length > 12 ? (
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
                            {selectedGroup.rereviewCause.externalCandidateLinks.length - 12} more external candidate links not shown
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      {selectedGroup.rereviewCause.canAcceptCurrentGroupAsFinal
                        ? 'You can accept the current confirmed group as final because the rereview state is driven by outside candidate links, not by another overlapping confirmed group.'
                        : 'This larger group overlaps a smaller confirmed duplicate group. Use Resolve Larger Group As Final if the larger set shown here is the real final answer.'}
                    </div>
                  </div>
                </section>
              ) : null}

              {displayMode === 'grid' ? (
                <div style={groupGridStyle}>
                  {selectedGroup.members.map((member) => (
                    <div key={member.asset.id}>
                      {renderMemberCard({
                        member,
                        albumLabel: getAlbumLabelForMember(member),
                        decision: getDecisionForMember(member),
                        selected: member.asset.id === focusedMember?.asset.id,
                        disabled: saving,
                        inCompareSet: compareAssetIdSet.has(member.asset.id),
                        onSelect: () => setFocusedAssetId(member.asset.id),
                        onToggleCompare: () => toggleCompareAsset(member.asset.id),
                        ...(mirroredMemberAction ? { mirroredAction: mirroredMemberAction } : {}),
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
                    <section style={focusDetailCardStyle}>
                      <strong>{focusedMember.asset.filename}</strong>
                      <div style={{ marginTop: '8px' }}>
                        <span style={badgeStyle}>{getDecisionLabel(getDecisionForMember(focusedMember))}</span>
                      </div>
                      <div style={{ marginTop: '10px', color: '#64748b', fontSize: '12px', wordBreak: 'break-word' }}>
                        {focusedMember.asset.id}
                      </div>
                      <div style={{ marginTop: '8px', color: '#475569', fontSize: '12px', wordBreak: 'break-word' }}>
                        <strong>Albums:</strong> {getAlbumLabelForMember(focusedMember)}
                      </div>
                      <div style={{ marginTop: '12px' }}>{renderHistoricalCounts(focusedMember)}</div>
                      <div style={{ marginTop: '12px' }}>
                        {renderDecisionControls({
                          decision: getDecisionForMember(focusedMember),
                          disabled: saving,
                          onChange: (decision) => updateDecision(focusedMember.asset.id, decision)
                        })}
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={saving ? disabledButtonStyle : actionButtonStyle}
                          disabled={saving}
                          onClick={() => toggleCompareAsset(focusedMember.asset.id)}
                        >
                          {compareAssetIdSet.has(focusedMember.asset.id) ? 'Remove From Compare' : 'Add To Compare'}
                        </button>
                        {mirroredMemberAction ? (
                          <button
                            type="button"
                            style={mirroredMemberAction.style}
                            disabled={mirroredMemberAction.disabled}
                            onClick={mirroredMemberAction.onClick}
                          >
                            {mirroredMemberAction.label}
                          </button>
                        ) : null}
                      </div>
                    </section>
                    {focusMembers.map((member) => (
                      <button
                        key={member.asset.id}
                        type="button"
                        style={{
                          ...filmstripButtonStyle,
                          borderColor: member.asset.id === focusedMember.asset.id ? '#0f4c5c' : '#cbd5e1',
                          boxShadow:
                            member.asset.id === focusedMember.asset.id
                              ? '0 0 0 2px rgba(15, 76, 92, 0.14)'
                              : 'none'
                        }}
                        onClick={() => setFocusedAssetId(member.asset.id)}
                      >
                        <strong style={{ textAlign: 'left' }}>{member.asset.filename}</strong>
                        <span style={{ ...badgeStyle, width: 'fit-content' }}>
                          {getDecisionLabel(getDecisionForMember(member))}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '12px', textAlign: 'left' }}>
                          {compareAssetIdSet.has(member.asset.id) ? 'In Compare Set' : 'Not In Compare Set'}
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
