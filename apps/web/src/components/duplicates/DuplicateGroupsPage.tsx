import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  DuplicateGroupListItem,
  DuplicateGroupListSummary,
  DuplicateGroupResolutionStatus,
  DuplicateGroupSortMode
} from '@tedography/shared';
import {
  bulkUpdateDuplicateGroups,
  getDuplicateGroup,
  listDuplicateGroups,
  updateDuplicateGroupResolution
} from '../../api/duplicateCandidatePairApi';
import { listDuplicateReconciliations } from '../../api/duplicateReconciliationApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';
import {
  getSelectedCanonicalAssetId,
  replaceDuplicateGroupInList
} from './duplicateGroupSelection';
import { DuplicateReconciliationDetail } from './DuplicateReconciliationDetail';
import { DuplicateWorkspaceNav } from './DuplicateWorkspaceNav';

type GroupFilters = {
  resolutionStatus: DuplicateGroupResolutionStatus | 'all';
  assetId: string;
  sizeMode: 'all' | 'exact_pair' | 'three_plus';
  readyToConfirmOnly: boolean;
  sort: DuplicateGroupSortMode;
};

const groupFiltersStorageKey = 'tedography.duplicates.groups.filters';

const defaultFilters: GroupFilters = {
  resolutionStatus: 'all',
  assetId: '',
  sizeMode: 'all',
  readyToConfirmOnly: false,
  sort: 'unresolved_first'
};

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '20px',
  boxSizing: 'border-box',
  background: '#f4f1ea',
  color: '#1e293b',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
};

const shellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  gap: '16px',
  minHeight: 'calc(100vh - 120px)'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '14px',
  backgroundColor: '#fffdf9',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
};

const sidebarListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  maxHeight: 'calc(100vh - 200px)',
  overflow: 'auto'
};

const listItemButtonStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #d4d4d8',
  borderRadius: '12px',
  padding: '12px',
  textAlign: 'left',
  backgroundColor: '#fff',
  cursor: 'pointer'
};

const memberGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '14px',
  marginTop: '16px'
};

const memberCardStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  backgroundColor: '#fff',
  overflow: 'hidden'
};

const imageWrapStyle: CSSProperties = {
  height: '260px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
};

const imageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain'
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

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f4c5c',
  borderColor: '#0f4c5c',
  color: '#ffffff'
};

const mutedButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#f8fafc'
};

const filterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '12px'
};

const filterFieldStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '14px'
};

const inputStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  backgroundColor: '#fff'
};

const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px'
};

const filterActionBarStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  margin: '18px 0'
};

const summaryCardStyle: CSSProperties = {
  ...panelStyle,
  padding: '14px'
};

const secondaryMetaStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '14px'
};

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatOptionalNumber(value: number | null | undefined): string {
  if (value === undefined || value === null) {
    return 'n/a';
  }

  return String(value);
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
}

function renderSummaryCard(label: string, value: number, note?: string): ReactElement {
  return (
    <section style={summaryCardStyle}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ ...secondaryMetaStyle, marginTop: '4px' }}>{note}</div> : null}
    </section>
  );
}

function parseStoredFilters(value: string | null): GroupFilters {
  if (!value) {
    return defaultFilters;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GroupFilters>;
    return {
      resolutionStatus:
        parsed.resolutionStatus === 'proposed' || parsed.resolutionStatus === 'confirmed'
          ? parsed.resolutionStatus
          : 'all',
      assetId: typeof parsed.assetId === 'string' ? parsed.assetId : '',
      sizeMode:
        parsed.sizeMode === 'exact_pair' || parsed.sizeMode === 'three_plus'
          ? parsed.sizeMode
          : 'all',
      readyToConfirmOnly: parsed.readyToConfirmOnly === true,
      sort:
        parsed.sort === 'size_asc' || parsed.sort === 'size_desc' || parsed.sort === 'unresolved_first'
          ? parsed.sort
          : 'unresolved_first'
    };
  } catch {
    return defaultFilters;
  }
}

export function DuplicateGroupsPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<GroupFilters>(() => {
    if (typeof window === 'undefined') {
      return defaultFilters;
    }

    return parseStoredFilters(window.localStorage.getItem(groupFiltersStorageKey));
  });
  const [appliedFilters, setAppliedFilters] = useState<GroupFilters>(() => {
    if (typeof window === 'undefined') {
      return defaultFilters;
    }

    return parseStoredFilters(window.localStorage.getItem(groupFiltersStorageKey));
  });
  const [groups, setGroups] = useState<DuplicateGroupListItem[]>([]);
  const [groupSummary, setGroupSummary] = useState<DuplicateGroupListSummary | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroupListItem | null>(null);
  const [selectedReconciliation, setSelectedReconciliation] = useState<Awaited<
    ReturnType<typeof listDuplicateReconciliations>
  >['items'][number] | null>(null);
  const [selectedCanonicalAssetId, setSelectedCanonicalAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);

  const trimmedAssetId = appliedFilters.assetId.trim();

  async function loadGroups(preferredGroupKey?: string | null): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await listDuplicateGroups({
        ...(trimmedAssetId.length > 0 ? { assetId: trimmedAssetId } : {}),
        ...(appliedFilters.resolutionStatus !== 'all'
          ? { resolutionStatus: appliedFilters.resolutionStatus }
          : {}),
        ...(appliedFilters.sizeMode === 'exact_pair'
          ? { exactAssetCount: 2 }
          : appliedFilters.sizeMode === 'three_plus'
            ? { minAssetCount: 3 }
            : {}),
        ...(appliedFilters.readyToConfirmOnly ? { readyToConfirmOnly: true } : {}),
        sort: appliedFilters.sort
      });
      setGroups(response.groups);
      setGroupSummary(response.summary);

      const nextGroupKey =
        preferredGroupKey && response.groups.some((group) => group.groupKey === preferredGroupKey)
          ? preferredGroupKey
          : response.groups[0]?.groupKey ?? null;
      setSelectedGroupKey(nextGroupKey);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.localStorage.setItem(groupFiltersStorageKey, JSON.stringify(appliedFilters));
  }, [appliedFilters]);

  useEffect(() => {
    void loadGroups(searchParams.get('groupKey'));
  }, [
    appliedFilters.assetId,
    appliedFilters.readyToConfirmOnly,
    appliedFilters.resolutionStatus,
    appliedFilters.sizeMode,
    appliedFilters.sort,
    searchParams
  ]);

  useEffect(() => {
    async function loadSelectedGroup(): Promise<void> {
      if (!selectedGroupKey) {
        setSelectedGroup(null);
        setSelectedCanonicalAssetId(null);
        return;
      }

      try {
        const response = await getDuplicateGroup(selectedGroupKey);
        setSelectedGroup(response.group);
        setSelectedCanonicalAssetId(getSelectedCanonicalAssetId(response.group));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate group');
      }
    }

    void loadSelectedGroup();
  }, [selectedGroupKey]);

  useEffect(() => {
    async function loadSelectedReconciliation(): Promise<void> {
      if (!selectedGroupKey) {
        setSelectedReconciliation(null);
        return;
      }

      try {
        const response = await listDuplicateReconciliations({ groupKey: selectedGroupKey });
        setSelectedReconciliation(response.items[0] ?? null);
      } catch {
        setSelectedReconciliation(null);
      }
    }

    void loadSelectedReconciliation();
  }, [selectedGroupKey]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (isEditableEventTarget(event.target) || saving || !selectedGroup) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        setSelectedGroupKey((previous) => {
          if (!previous) {
            return groups[0]?.groupKey ?? null;
          }

          const currentIndex = groups.findIndex((group) => group.groupKey === previous);
          return groups[Math.min(currentIndex + 1, groups.length - 1)]?.groupKey ?? previous;
        });
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        setSelectedGroupKey((previous) => {
          if (!previous) {
            return groups[0]?.groupKey ?? null;
          }

          const currentIndex = groups.findIndex((group) => group.groupKey === previous);
          return groups[Math.max(currentIndex - 1, 0)]?.groupKey ?? previous;
        });
        return;
      }

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        void handleSaveResolution('confirmed');
        return;
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        void handleSaveResolution('proposed');
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        void handleResetToProposed();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [groups, saving, selectedGroup, selectedCanonicalAssetId]);

  async function handleSaveResolution(nextStatus: DuplicateGroupResolutionStatus): Promise<void> {
    if (!selectedGroup || !selectedCanonicalAssetId) {
      return;
    }

    setSaving(true);
    setError(null);
    setBulkActionMessage(null);

    try {
      const response = await updateDuplicateGroupResolution(selectedGroup.groupKey, {
        canonicalAssetId: selectedCanonicalAssetId,
        resolutionStatus: nextStatus
      });
      setSelectedGroup(response.group);
      setSelectedCanonicalAssetId(response.group.selectedCanonicalAssetId);
      setGroups((previous) => replaceDuplicateGroupInList(previous, response.group));
      await loadGroups(response.group.groupKey);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update duplicate group');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToProposed(): Promise<void> {
    if (!selectedGroup) {
      return;
    }

    const proposedCanonicalAssetId = selectedGroup.proposedCanonicalAssetId;
    setSelectedCanonicalAssetId(proposedCanonicalAssetId);

    setSaving(true);
    setError(null);
    setBulkActionMessage(null);
    try {
      const response = await updateDuplicateGroupResolution(selectedGroup.groupKey, {
        canonicalAssetId: proposedCanonicalAssetId,
        resolutionStatus: 'proposed'
      });
      setSelectedGroup(response.group);
      setSelectedCanonicalAssetId(response.group.selectedCanonicalAssetId);
      setGroups((previous) => replaceDuplicateGroupInList(previous, response.group));
      await loadGroups(response.group.groupKey);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update duplicate group');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkConfirm(): Promise<void> {
    const groupKeys = groups
      .filter(
        (group) =>
          group.resolutionStatus === 'proposed' &&
          group.selectedCanonicalAssetId === group.proposedCanonicalAssetId
      )
      .map((group) => group.groupKey);

    if (groupKeys.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setBulkActionMessage(null);

    try {
      const response = await bulkUpdateDuplicateGroups({
        action: 'confirm_proposals',
        groupKeys
      });
      setBulkActionMessage(`Confirmed ${response.updatedCount} duplicate groups from the current filtered queue.`);
      await loadGroups(selectedGroupKey);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Failed to bulk confirm duplicate groups');
    } finally {
      setSaving(false);
    }
  }

  function handleApplyFilters(): void {
    setBulkActionMessage(null);
    setAppliedFilters({
      ...draftFilters,
      assetId: draftFilters.assetId.trim()
    });
  }

  function handleResetFilters(): void {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setBulkActionMessage(null);
  }

  const selectedGroupIndex = useMemo(
    () => groups.findIndex((group) => group.groupKey === selectedGroupKey),
    [groups, selectedGroupKey]
  );

  const bulkConfirmableCount = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.resolutionStatus === 'proposed' &&
          group.selectedCanonicalAssetId === group.proposedCanonicalAssetId
      ).length,
    [groups]
  );

  const summaryCards = groupSummary
    ? [
        renderSummaryCard('Filtered Groups', groups.length),
        renderSummaryCard('Proposed', groupSummary.statusCounts.proposed),
        renderSummaryCard('Confirmed', groupSummary.statusCounts.confirmed),
        renderSummaryCard('Ready To Confirm', groupSummary.readyToConfirmCount),
        renderSummaryCard('Exactly 2 Assets', groupSummary.exactPairGroupCount)
      ]
    : [];

  return (
    <div style={pageStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Duplicate Groups</h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b' }}>
            Slice duplicate groups, confirm canonical proposals in bulk, and finalize non-destructive resolutions faster.
          </p>
          <DuplicateWorkspaceNav active="groups" />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={mutedButtonStyle} onClick={() => void loadGroups(selectedGroupKey)}>
            Refresh
          </button>
        </div>
      </header>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Group Filters</h2>
        <div style={filterGridStyle}>
          <label style={filterFieldStyle}>
            <span>Resolution Status</span>
            <select
              value={draftFilters.resolutionStatus}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  resolutionStatus: event.target.value as GroupFilters['resolutionStatus']
                }))
              }
            >
              <option value="all">all</option>
              <option value="proposed">proposed</option>
              <option value="confirmed">confirmed</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Group Size</span>
            <select
              value={draftFilters.sizeMode}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  sizeMode: event.target.value as GroupFilters['sizeMode']
                }))
              }
            >
              <option value="all">all</option>
              <option value="exact_pair">exactly 2 members</option>
              <option value="three_plus">3+ members</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Sort</span>
            <select
              value={draftFilters.sort}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  sort: event.target.value as GroupFilters['sort']
                }))
              }
            >
              <option value="unresolved_first">unresolved first</option>
              <option value="size_asc">smallest first</option>
              <option value="size_desc">largest first</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Asset ID</span>
            <input
              value={draftFilters.assetId}
              style={inputStyle}
              placeholder="Optional asset id"
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, assetId: event.target.value }))
              }
            />
          </label>
        </div>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={draftFilters.readyToConfirmOnly}
            onChange={(event) =>
              setDraftFilters((previous) => ({ ...previous, readyToConfirmOnly: event.target.checked }))
            }
          />
          Only show groups ready for bulk confirm
        </label>
        <div style={filterActionBarStyle}>
          <button type="button" style={primaryButtonStyle} onClick={handleApplyFilters}>
            Apply Filters
          </button>
          <button type="button" style={mutedButtonStyle} onClick={handleResetFilters}>
            Reset Filters
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => void handleBulkConfirm()}
            disabled={saving || bulkConfirmableCount === 0}
            title="Confirm the proposed canonical asset for all currently filtered groups that are still unresolved."
          >
            Bulk Confirm Proposals ({bulkConfirmableCount})
          </button>
          <span style={secondaryMetaStyle}>
            Active queue: {appliedFilters.resolutionStatus}
            {appliedFilters.sizeMode !== 'all' ? `, ${appliedFilters.sizeMode}` : ''}
            {trimmedAssetId ? `, asset ${trimmedAssetId}` : ''}
            {appliedFilters.readyToConfirmOnly ? ', ready to confirm' : ''}
          </span>
        </div>
      </section>

      {summaryCards.length > 0 ? <div style={summaryGridStyle}>{summaryCards}</div> : null}

      {bulkActionMessage ? <section style={panelStyle}>{bulkActionMessage}</section> : null}
      {error ? <section style={panelStyle}>Failed to load duplicate groups: {error}</section> : null}

      <div style={shellStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Groups</h2>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            {groups.length} filtered groups
          </div>
          {loading ? <div>Loading groups...</div> : null}
          {!loading && groups.length === 0 ? <div>No duplicate groups match the current filter.</div> : null}
          <div style={sidebarListStyle}>
            {groups.map((group) => {
              const selectedMember = group.assets.find((asset) => asset.id === group.selectedCanonicalAssetId);
              const isReadyToConfirm =
                group.resolutionStatus === 'proposed' &&
                group.selectedCanonicalAssetId === group.proposedCanonicalAssetId;
              return (
                <button
                  key={group.groupKey}
                  type="button"
                  style={{
                    ...listItemButtonStyle,
                    borderColor: selectedGroupKey === group.groupKey ? '#0f4c5c' : '#d4d4d8'
                  }}
                  onClick={() => setSelectedGroupKey(group.groupKey)}
                >
                  <div style={{ fontWeight: 700 }}>{group.groupKey}</div>
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                    {group.assetCount} assets, status {group.resolutionStatus}
                  </div>
                  <div style={{ color: '#475569', fontSize: '13px', marginTop: '6px' }}>
                    Canonical: {selectedMember?.filename ?? group.selectedCanonicalAssetId}
                  </div>
                  {isReadyToConfirm ? (
                    <div style={{ color: '#0f4c5c', fontSize: '13px', marginTop: '6px' }}>
                      Ready to bulk confirm
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <main style={panelStyle}>
          {!selectedGroup ? (
            <div>Select a duplicate group to review its canonical proposal.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedGroup.groupKey}</h2>
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    {selectedGroup.assetCount} assets, {selectedGroup.confirmedPairCount} confirmed pair links
                  </div>
                </div>
                <div style={{ color: '#475569', fontSize: '14px' }}>
                  Status: {selectedGroup.resolutionStatus}
                  {selectedGroupIndex >= 0 ? `, Position ${selectedGroupIndex + 1} of ${groups.length}` : ''}
                </div>
              </div>

              <div style={{ ...secondaryMetaStyle, marginTop: '8px' }}>
                Shortcuts: S save, C confirm, R reset, ←/K previous, →/J next
              </div>

              <section style={{ marginTop: '16px' }}>
                <strong>Proposed canonical:</strong> {selectedGroup.proposedCanonicalAssetId}
                <div style={{ marginTop: '8px', color: '#475569', fontSize: '14px' }}>
                  {selectedGroup.canonicalReasonSummary.join(' ')}
                </div>
              </section>

              <section style={{ marginTop: '16px' }}>
                <strong>Selected canonical:</strong> {selectedCanonicalAssetId ?? 'n/a'}
                <div style={{ marginTop: '6px', color: '#475569', fontSize: '14px' }}>
                  Non-canonical members:{' '}
                  {selectedGroup.assetIds.filter((assetId) => assetId !== selectedCanonicalAssetId).join(', ') || 'n/a'}
                </div>
              </section>

              <section style={{ marginTop: '16px' }}>
                <strong>Reconciliation:</strong>{' '}
                {selectedReconciliation
                  ? `${selectedReconciliation.status} · ${selectedReconciliation.entries.reduce(
                      (sum, entry) => sum + entry.addedValues.length,
                      0
                    )} added album association${
                      selectedReconciliation.entries.reduce(
                        (sum, entry) => sum + entry.addedValues.length,
                        0
                      ) === 1
                        ? ''
                        : 's'
                    }`
                  : 'none generated yet'}
                <div style={{ marginTop: '6px' }}>
                  <Link
                    to={`/duplicates/reconciliations?groupKey=${encodeURIComponent(selectedGroup.groupKey)}`}
                    style={{ color: '#0f4c5c', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Open Reconciliation Detail
                  </Link>
                </div>
              </section>

              <div style={memberGridStyle}>
                {selectedGroup.assets.map((asset) => {
                  const isProposed = asset.id === selectedGroup.proposedCanonicalAssetId;
                  const isSelected = asset.id === selectedCanonicalAssetId;

                  return (
                    <section key={asset.id} style={memberCardStyle}>
                      <div style={imageWrapStyle}>
                        <img src={getDisplayMediaUrl(asset.id)} alt={asset.filename} style={imageStyle} />
                      </div>
                      <div style={{ padding: '12px', display: 'grid', gap: '6px', fontSize: '14px' }}>
                        <strong>{asset.filename}</strong>
                        <div>Asset ID: {asset.id}</div>
                        <div>Original Path: {asset.originalArchivePath ?? 'n/a'}</div>
                        <div>Capture: {formatOptionalDate(asset.captureDateTime)}</div>
                        <div>
                          Dimensions: {formatOptionalNumber(asset.width)} x {formatOptionalNumber(asset.height)}
                        </div>
                        <div>Original Format: {asset.originalFileFormat ?? 'n/a'}</div>
                        <div>Display Storage: {asset.displayStorageType ?? 'n/a'}</div>
                        <div>Photo State: {asset.photoState ?? 'n/a'}</div>
                        <div>File Size: {formatOptionalNumber(asset.originalFileSizeBytes)}</div>
                        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedCanonicalAssetId(asset.id)}
                          />
                          Use as canonical
                        </label>
                        {isProposed ? <div style={{ color: '#0f4c5c' }}>Proposed canonical</div> : null}
                        {isSelected && !isProposed ? <div style={{ color: '#9a3412' }}>Manual override</div> : null}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void handleSaveResolution('proposed')}
                  disabled={saving || !selectedCanonicalAssetId}
                >
                  Save Canonical Selection
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void handleSaveResolution('confirmed')}
                  disabled={saving || !selectedCanonicalAssetId}
                >
                  Confirm Resolution
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() => void handleResetToProposed()}
                  disabled={saving}
                >
                  Reset To Proposed
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() =>
                    setSelectedGroupKey(groups[Math.max(selectedGroupIndex - 1, 0)]?.groupKey ?? selectedGroupKey)
                  }
                  disabled={saving || selectedGroupIndex <= 0}
                >
                  Previous Group
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() =>
                    setSelectedGroupKey(
                      groups[Math.min(selectedGroupIndex + 1, groups.length - 1)]?.groupKey ?? selectedGroupKey
                    )
                  }
                  disabled={saving || selectedGroupIndex < 0 || selectedGroupIndex >= groups.length - 1}
                >
                  Next Group
                </button>
              </div>

              <div style={{ marginTop: '18px' }}>
                <DuplicateReconciliationDetail reconciliation={selectedReconciliation} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default DuplicateGroupsPage;
