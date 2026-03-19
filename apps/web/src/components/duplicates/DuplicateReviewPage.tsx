import { useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type {
  DuplicateCandidatePairAssetSummary,
  DuplicateCandidatePairListItem,
  DuplicateCandidatePairSummaryResponse,
  DuplicateCandidateReviewDecision,
  ListDuplicateGroupsResponse
} from '@tedography/shared';
import {
  bulkReviewDuplicateCandidatePairs,
  getDuplicateCandidatePairSummary,
  listDuplicateCandidatePairs,
  listDuplicateGroups,
  updateDuplicateCandidatePairReview
} from '../../api/duplicateCandidatePairApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';
import {
  getNextDuplicateReviewIndex,
  getPreviousDuplicateReviewIndex,
  removeReviewedDuplicatePair,
  replaceDuplicateReviewQueue,
  type DuplicateReviewQueueState
} from './reviewQueue';
import { DuplicateWorkspaceNav } from './DuplicateWorkspaceNav';
import {
  getDefaultDuplicateReviewFocusSide,
  toggleDuplicateReviewFocusSide,
  type DuplicateReviewComparisonMode,
  type DuplicateReviewFocusSide
} from './focusMode';
import {
  getDuplicateReviewImmersiveActionForKey,
  getDuplicateReviewImmersiveSideForKey,
  getInitialDuplicateReviewImmersiveSide
} from './duplicateReviewImmersive';
import {
  defaultDuplicateReviewFilters,
  duplicateReviewPresets,
  getActiveDuplicateReviewPresetId,
  getDuplicateReviewPresetFilters,
  getDuplicateReviewQueueProgress,
  type DuplicateReviewFilters,
  type DuplicateReviewPresetId
} from './duplicateReviewPresets';

const maxQueueItems = 500;
const reviewFiltersStorageKey = 'tedography.duplicates.review.filters';

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
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap'
};

const linkStyle: CSSProperties = {
  color: '#0f4c5c',
  textDecoration: 'none',
  fontWeight: 600
};

const panelStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '14px',
  backgroundColor: '#fffdf9',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  marginBottom: '18px'
};

const summaryCardStyle: CSSProperties = {
  ...panelStyle,
  padding: '14px'
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
  flexWrap: 'wrap'
};

const presetBarStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: '14px'
};

const queueProgressStyle: CSSProperties = {
  ...panelStyle,
  padding: '14px 18px',
  margin: '14px 0 18px 0',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center'
};

const comparisonGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px'
};

const focusComparisonLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 240px',
  gap: '16px',
  alignItems: 'start'
};

const assetPanelStyle: CSSProperties = {
  border: '1px solid #e4e4e7',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  overflow: 'hidden'
};

const focusedAssetPanelStyle: CSSProperties = {
  ...assetPanelStyle,
  borderColor: '#0f4c5c',
  boxShadow: '0 0 0 3px rgba(15, 76, 92, 0.12)'
};

const secondaryAssetPanelStyle: CSSProperties = {
  ...assetPanelStyle,
  opacity: 0.78
};

const imageWrapStyle: CSSProperties = {
  height: '420px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
};

const imageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  display: 'block'
};

const focusedImageWrapStyle: CSSProperties = {
  ...imageWrapStyle,
  height: '620px'
};

const secondaryImageWrapStyle: CSSProperties = {
  ...imageWrapStyle,
  height: '220px'
};

const assetMetaStyle: CSSProperties = {
  padding: '14px',
  display: 'grid',
  gap: '8px',
  fontSize: '14px'
};

const metadataGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
  marginTop: '18px'
};

const signalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
  marginTop: '12px'
};

const actionBarStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '20px'
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

const warningButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#9a3412',
  borderColor: '#9a3412',
  color: '#ffffff'
};

const mutedButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#f8fafc'
};

const secondaryMetaStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '14px'
};

const focusToggleBarStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginTop: '16px'
};

const immersiveOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1600,
  backgroundColor: 'rgba(2, 6, 23, 0.96)',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px',
  boxSizing: 'border-box'
};

const immersiveHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '16px'
};

const immersiveMetaStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontSize: '14px',
  color: '#cbd5e1'
};

const immersiveImageWrapStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: '14px',
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.65) 0%, rgba(2, 6, 23, 0.85) 100%)',
  overflow: 'hidden'
};

const immersiveImageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  display: 'block'
};

const immersiveHintStyle: CSSProperties = {
  marginTop: '16px',
  color: '#94a3b8',
  fontSize: '13px'
};

const immersiveControlsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: '16px'
};

const groupListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '12px'
};

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatOptionalNumber(value: number | null | undefined, digits = 0): string {
  if (value === undefined || value === null) {
    return 'n/a';
  }

  return digits > 0 ? value.toFixed(digits) : String(value);
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

function parseStoredFilters(value: string | null): DuplicateReviewFilters {
  if (!value) {
    return defaultDuplicateReviewFilters;
  }

  try {
    const parsed = JSON.parse(value) as Partial<DuplicateReviewFilters>;
    return {
      status:
        parsed.status === 'unreviewed' ||
        parsed.status === 'reviewed' ||
        parsed.status === 'ignored'
          ? parsed.status
          : 'all',
      classification:
        parsed.classification === 'very_likely_duplicate' ||
        parsed.classification === 'possible_duplicate' ||
        parsed.classification === 'similar_image'
          ? parsed.classification
          : 'all',
      outcome:
        parsed.outcome === 'confirmed_duplicate' ||
        parsed.outcome === 'not_duplicate' ||
        parsed.outcome === 'ignored' ||
        parsed.outcome === 'none'
          ? parsed.outcome
          : 'all',
      assetId: typeof parsed.assetId === 'string' ? parsed.assetId : '',
      highConfidenceOnly: parsed.highConfidenceOnly === true
    };
  } catch {
    return defaultDuplicateReviewFilters;
  }
}

function renderAssetPanel(input: {
  sideLabel: string;
  asset: DuplicateCandidatePairAssetSummary | null;
  isFocused?: boolean;
  isFocusMode?: boolean;
  onFocus?: () => void;
}): ReactElement {
  const { sideLabel, asset, isFocused = false, isFocusMode = false, onFocus } = input;
  if (!asset) {
    return (
      <section style={assetPanelStyle}>
        <div style={imageWrapStyle}>Missing asset metadata</div>
      </section>
    );
  }

  return (
    <section style={isFocusMode ? (isFocused ? focusedAssetPanelStyle : secondaryAssetPanelStyle) : assetPanelStyle}>
      <div style={isFocusMode ? (isFocused ? focusedImageWrapStyle : secondaryImageWrapStyle) : imageWrapStyle}>
        <img src={getDisplayMediaUrl(asset.id)} alt={`${sideLabel} ${asset.filename}`} style={imageStyle} />
      </div>
      <div style={assetMetaStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
          <strong>{sideLabel}</strong>
          {isFocusMode ? (
            <button type="button" style={isFocused ? primaryButtonStyle : mutedButtonStyle} onClick={onFocus}>
              {isFocused ? 'Focused' : `Focus ${sideLabel === 'Asset A' ? 'Left' : 'Right'}`}
            </button>
          ) : null}
        </div>
        <div>Filename: {asset.filename}</div>
        <div>Asset ID: {asset.id}</div>
        <div>Original Path: {asset.originalArchivePath ?? 'n/a'}</div>
        <div>Capture: {formatOptionalDate(asset.captureDateTime)}</div>
        <div>
          Dimensions: {formatOptionalNumber(asset.width)} x {formatOptionalNumber(asset.height)}
        </div>
        {isFocusMode && !isFocused ? (
          <div style={secondaryMetaStyle}>Secondary reference view while the other asset is focused.</div>
        ) : null}
      </div>
    </section>
  );
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
}

export function DuplicateReviewPage(): ReactElement {
  const [draftFilters, setDraftFilters] = useState<DuplicateReviewFilters>(() => {
    if (typeof window === 'undefined') {
      return defaultDuplicateReviewFilters;
    }

    return parseStoredFilters(window.localStorage.getItem(reviewFiltersStorageKey));
  });
  const [appliedFilters, setAppliedFilters] = useState<DuplicateReviewFilters>(() => {
    if (typeof window === 'undefined') {
      return defaultDuplicateReviewFilters;
    }

    return parseStoredFilters(window.localStorage.getItem(reviewFiltersStorageKey));
  });
  const [queueState, setQueueState] = useState<DuplicateReviewQueueState>({ items: [], currentIndex: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPairKey, setBusyPairKey] = useState<string | null>(null);
  const [totalMatching, setTotalMatching] = useState(0);
  const [summary, setSummary] = useState<DuplicateCandidatePairSummaryResponse | null>(null);
  const [groups, setGroups] = useState<ListDuplicateGroupsResponse | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<DuplicateReviewComparisonMode>('side_by_side');
  const [focusedSide, setFocusedSide] = useState<DuplicateReviewFocusSide>(
    getDefaultDuplicateReviewFocusSide()
  );
  const [immersiveOpen, setImmersiveOpen] = useState(false);

  const currentPair = queueState.items[queueState.currentIndex] ?? null;
  const trimmedAssetId = appliedFilters.assetId.trim();
  const minScore = appliedFilters.highConfidenceOnly ? 0.9 : undefined;
  const immersiveAsset = immersiveOpen
    ? focusedSide === 'left'
      ? currentPair?.assetA ?? null
      : currentPair?.assetB ?? null
    : null;

  async function loadQueueAndSummary(activePairKey?: string | null): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [queueResponse, summaryResponse] = await Promise.all([
        listDuplicateCandidatePairs({
          status: appliedFilters.status,
          classification: appliedFilters.classification,
          outcome: appliedFilters.outcome,
          ...(trimmedAssetId.length > 0 ? { assetId: trimmedAssetId } : {}),
          ...(minScore !== undefined ? { minScore } : {}),
          limit: maxQueueItems,
          offset: 0
        }),
        getDuplicateCandidatePairSummary({
          ...(trimmedAssetId.length > 0 ? { assetId: trimmedAssetId } : {}),
          ...(minScore !== undefined ? { minScore } : {})
        })
      ]);

      setQueueState(replaceDuplicateReviewQueue(queueResponse.items, activePairKey ?? null));
      setTotalMatching(queueResponse.total);
      setSummary(summaryResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate review queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.localStorage.setItem(reviewFiltersStorageKey, JSON.stringify(appliedFilters));
  }, [appliedFilters]);

  useEffect(() => {
    void loadQueueAndSummary();
  }, [appliedFilters.status, appliedFilters.classification, appliedFilters.outcome, appliedFilters.assetId, appliedFilters.highConfidenceOnly]);

  useEffect(() => {
    setFocusedSide(getDefaultDuplicateReviewFocusSide());
    setImmersiveOpen(false);
  }, [currentPair?.pairKey]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (busyPairKey || isEditableEventTarget(event.target)) {
        return;
      }

      if (immersiveOpen) {
        const nextImmersiveSide = getDuplicateReviewImmersiveSideForKey({
          key: event.key,
          currentSide: focusedSide
        });

        if (nextImmersiveSide) {
          event.preventDefault();
          setFocusedSide(nextImmersiveSide);
          return;
        }

        const immersiveAction = getDuplicateReviewImmersiveActionForKey(event.key);
        if (immersiveAction === 'close') {
          event.preventDefault();
          setImmersiveOpen(false);
          return;
        }

        if (immersiveAction === 'confirmed_duplicate') {
          event.preventDefault();
          void handleImmersiveDecision('confirmed_duplicate');
          return;
        }

        if (immersiveAction === 'not_duplicate') {
          event.preventDefault();
          void handleImmersiveDecision('not_duplicate');
          return;
        }

        if (immersiveAction === 'ignored') {
          event.preventDefault();
          void handleImmersiveDecision('ignored');
          return;
        }

        if (immersiveAction === 'next') {
          event.preventDefault();
          handleImmersiveNext();
          return;
        }

        if (immersiveAction === 'previous') {
          event.preventDefault();
          handleImmersivePrevious();
          return;
        }

        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        setFocusedSide((previous) => toggleDuplicateReviewFocusSide(previous));
        if (comparisonMode !== 'focus') {
          setComparisonMode('focus');
        }
        return;
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        setFocusedSide('left');
        if (comparisonMode !== 'focus') {
          setComparisonMode('focus');
        }
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        setComparisonMode((previous) => (previous === 'focus' ? 'side_by_side' : 'focus'));
        return;
      }

      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        void handleDecision('confirmed_duplicate');
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        void handleDecision('not_duplicate');
        return;
      }

      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        void handleDecision('ignored');
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'j' || event.key === 'J') {
        if (comparisonMode === 'focus') {
          event.preventDefault();
          setFocusedSide('right');
          return;
        }

        event.preventDefault();
        handleNext();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'k' || event.key === 'K') {
        if (comparisonMode === 'focus') {
          event.preventDefault();
          setFocusedSide('left');
          return;
        }

        event.preventDefault();
        handlePrevious();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [busyPairKey, queueState, currentPair, comparisonMode, immersiveOpen, focusedSide]);

  async function handleDecision(decision: DuplicateCandidateReviewDecision): Promise<void> {
    if (!currentPair) {
      return;
    }

    const nextCandidatePairKey =
      queueState.items[queueState.currentIndex + 1]?.pairKey ??
      queueState.items[queueState.currentIndex - 1]?.pairKey ??
      null;

    setBusyPairKey(currentPair.pairKey);
    setError(null);

    try {
      await updateDuplicateCandidatePairReview(currentPair.pairKey, { decision });
      setQueueState((previous) => removeReviewedDuplicatePair(previous, currentPair.pairKey));
      await loadQueueAndSummary(nextCandidatePairKey);
      setBulkActionMessage(null);
      if (groups) {
        void handleLoadGroups();
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update pair review');
    } finally {
      setBusyPairKey(null);
    }
  }

  async function handleImmersiveDecision(decision: DuplicateCandidateReviewDecision): Promise<void> {
    await handleDecision(decision);
  }

  function handleApplyFilters(event?: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event && event.key !== 'Enter') {
      return;
    }

    setAppliedFilters({
      ...draftFilters,
      assetId: draftFilters.assetId.trim()
    });
    setBulkActionMessage(null);
  }

  function handleResetFilters(): void {
    setDraftFilters(defaultDuplicateReviewFilters);
    setAppliedFilters(defaultDuplicateReviewFilters);
    setBulkActionMessage(null);
  }

  function handleApplyPreset(presetId: DuplicateReviewPresetId): void {
    const presetFilters = getDuplicateReviewPresetFilters(presetId);
    setDraftFilters(presetFilters);
    setAppliedFilters(presetFilters);
    setBulkActionMessage(null);
  }

  function handleNext(): void {
    setQueueState((previous) => ({
      ...previous,
      currentIndex: getNextDuplicateReviewIndex(previous.currentIndex, previous.items.length)
    }));
  }

  function handlePrevious(): void {
    setQueueState((previous) => ({
      ...previous,
      currentIndex: getPreviousDuplicateReviewIndex(previous.currentIndex)
    }));
  }

  function handleImmersiveNext(): void {
    if (queueState.currentIndex >= queueState.items.length - 1) {
      return;
    }

    handleNext();
  }

  function handleImmersivePrevious(): void {
    if (queueState.currentIndex <= 0) {
      return;
    }

    handlePrevious();
  }

  async function handleLoadGroups(): Promise<void> {
    setGroupsLoading(true);
    setGroupsError(null);

    try {
      const response = await listDuplicateGroups({
        ...(trimmedAssetId.length > 0 ? { assetId: trimmedAssetId } : {})
      });
      setGroups(response);
    } catch (loadError) {
      setGroupsError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate groups');
    } finally {
      setGroupsLoading(false);
    }
  }

  async function handleBulkIgnoreLoadedPairs(): Promise<void> {
    const pairKeys = queueState.items.map((item) => item.pairKey);

    if (pairKeys.length === 0) {
      return;
    }

    setBusyPairKey('__bulk__');
    setError(null);
    setBulkActionMessage(null);

    try {
      const response = await bulkReviewDuplicateCandidatePairs({
        pairKeys,
        decision: 'ignored'
      });
      setBulkActionMessage(`Ignored ${response.updatedCount} loaded pairs from the current filtered queue.`);
      await loadQueueAndSummary(null);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Failed to bulk ignore duplicate pairs');
    } finally {
      setBusyPairKey(null);
    }
  }

  const activePresetId = getActiveDuplicateReviewPresetId(appliedFilters);
  const queueProgress = getDuplicateReviewQueueProgress({
    currentIndex: queueState.currentIndex,
    loadedCount: queueState.items.length,
    totalMatching,
    hasCurrentPair: currentPair !== null
  });
  const currentSliceLabel = activePresetId
    ? duplicateReviewPresets.find((preset) => preset.id === activePresetId)?.label ?? 'Custom Slice'
    : 'Custom Slice';

  const summaryCards = summary
    ? [
        renderSummaryCard('Matching Pairs', totalMatching, `Loaded ${queueState.items.length}`),
        renderSummaryCard('Unreviewed', summary.statusCounts.unreviewed),
        renderSummaryCard('Reviewed', summary.statusCounts.reviewed),
        renderSummaryCard('Confirmed Duplicate', summary.outcomeCounts.confirmed_duplicate),
        renderSummaryCard(
          'Remaining Loaded',
          Math.max(queueState.items.length - queueState.currentIndex - 1, 0),
          currentPair ? 'After current pair' : undefined
        ),
        renderSummaryCard('High Confidence', summary.highConfidenceCount),
        renderSummaryCard('No Outcome', summary.outcomeCounts.none)
      ]
    : [];

  return (
    <div style={pageStyle}>
      <header style={pageHeaderStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Duplicate Review</h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b' }}>
            Filter the queue, inspect scoring context, and review pairs without changing the main photo workflow.
          </p>
          <DuplicateWorkspaceNav active="review" />
        </div>
        <div style={headerActionsStyle}>
          <Link to="/" style={linkStyle}>
            Back to Library
          </Link>
          <button type="button" style={mutedButtonStyle} onClick={() => void loadQueueAndSummary(currentPair?.pairKey ?? null)}>
            Refresh Queue
          </button>
          <button type="button" style={mutedButtonStyle} onClick={() => void handleLoadGroups()}>
            Load Groups
          </button>
        </div>
      </header>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Queue Filters</h2>
        <div style={presetBarStyle}>
          <span style={{ ...secondaryMetaStyle, fontWeight: 600 }}>Triage Presets</span>
          {duplicateReviewPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              style={activePresetId === preset.id ? primaryButtonStyle : mutedButtonStyle}
              onClick={() => handleApplyPreset(preset.id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={filterGridStyle}>
          <label style={filterFieldStyle}>
            <span>Status</span>
            <select
              value={draftFilters.status}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  status: event.target.value as DuplicateReviewFilters['status']
                }))
              }
            >
              <option value="unreviewed">unreviewed</option>
              <option value="reviewed">reviewed</option>
              <option value="ignored">ignored</option>
              <option value="all">all</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Classification</span>
            <select
              value={draftFilters.classification}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  classification: event.target.value as DuplicateReviewFilters['classification']
                }))
              }
            >
              <option value="all">all</option>
              <option value="very_likely_duplicate">very_likely_duplicate</option>
              <option value="possible_duplicate">possible_duplicate</option>
              <option value="similar_image">similar_image</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Outcome</span>
            <select
              value={draftFilters.outcome}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  outcome: event.target.value as DuplicateReviewFilters['outcome']
                }))
              }
            >
              <option value="all">all</option>
              <option value="none">none</option>
              <option value="confirmed_duplicate">confirmed_duplicate</option>
              <option value="not_duplicate">not_duplicate</option>
              <option value="ignored">ignored</option>
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
              onKeyDown={handleApplyFilters}
            />
          </label>
        </div>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={draftFilters.highConfidenceOnly}
            onChange={(event) =>
              setDraftFilters((previous) => ({ ...previous, highConfidenceOnly: event.target.checked }))
            }
          />
          High confidence only (score &gt;= 0.90)
        </label>
        <div style={filterActionBarStyle}>
          <button type="button" style={primaryButtonStyle} onClick={() => handleApplyFilters()}>
            Apply Filters
          </button>
          <button type="button" style={mutedButtonStyle} onClick={handleResetFilters}>
            Reset Filters
          </button>
          <button
            type="button"
            style={mutedButtonStyle}
            onClick={() => void handleBulkIgnoreLoadedPairs()}
            disabled={busyPairKey !== null || queueState.items.length === 0}
            title="Ignore every currently loaded pair in the active filtered queue."
          >
            Bulk Ignore Loaded ({queueState.items.length})
          </button>
          <span style={secondaryMetaStyle}>
            Active queue: {appliedFilters.status}, {appliedFilters.classification}, {appliedFilters.outcome}
            {trimmedAssetId ? `, asset ${trimmedAssetId}` : ''}
            {minScore !== undefined ? ', high confidence' : ''}
          </span>
        </div>
      </section>

      <section style={queueProgressStyle}>
        <div>
          <strong>Queue Progress</strong>
          <div style={secondaryMetaStyle}>
            Current slice: {currentSliceLabel}
            {activePresetId === null ? ` · ${appliedFilters.status}, ${appliedFilters.classification}, ${appliedFilters.outcome}` : ''}
            {trimmedAssetId ? ` · asset ${trimmedAssetId}` : ''}
            {minScore !== undefined ? ' · high confidence' : ''}
          </div>
        </div>
        <div style={{ ...secondaryMetaStyle, textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
            {queueProgress.currentPosition} of {queueProgress.totalMatching}
          </div>
          <div>
            {queueProgress.remainingTotal} remaining · loaded {queueProgress.loadedCount}
            {queueProgress.loadedCount > 0 ? ` · ${queueProgress.remainingLoaded} loaded after current` : ''}
          </div>
        </div>
      </section>

      {summaryCards.length > 0 ? <div style={summaryGridStyle}>{summaryCards}</div> : null}
      {bulkActionMessage ? <section style={panelStyle}>{bulkActionMessage}</section> : null}

      {loading ? <section style={panelStyle}>Loading duplicate candidate pairs...</section> : null}
      {error ? <section style={panelStyle}>Failed to load duplicate review queue: {error}</section> : null}

      {!loading && !error && !currentPair ? (
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>No pairs match the current filter</h2>
          <p style={secondaryMetaStyle}>
            Adjust the queue filters or generate more candidate pairs if you expect additional review work.
          </p>
        </section>
      ) : null}

      {!loading && !error && currentPair ? (
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0 }}>Current Pair</h2>
              <div style={secondaryMetaStyle}>
                Position {queueState.currentIndex + 1} of {totalMatching}
                {totalMatching > queueState.items.length ? `, loaded first ${queueState.items.length}` : ''}
              </div>
            </div>
            <div style={secondaryMetaStyle}>
              Shortcuts: F focus mode, Tab toggle side, A left, → right, D duplicate, N not duplicate, I ignore, ←/K previous, →/J next
            </div>
          </div>

          <div style={focusToggleBarStyle}>
            <button
              type="button"
              style={comparisonMode === 'side_by_side' ? primaryButtonStyle : mutedButtonStyle}
              onClick={() => setComparisonMode('side_by_side')}
            >
              Side by Side
            </button>
            <button
              type="button"
              style={comparisonMode === 'focus' ? primaryButtonStyle : mutedButtonStyle}
              onClick={() => setComparisonMode('focus')}
            >
              Focus Mode
            </button>
            <button
              type="button"
              style={comparisonMode === 'focus' && focusedSide === 'left' ? primaryButtonStyle : mutedButtonStyle}
              onClick={() => {
                setFocusedSide('left');
                setComparisonMode('focus');
              }}
            >
              Focus Left
            </button>
            <button
              type="button"
              style={comparisonMode === 'focus' && focusedSide === 'right' ? primaryButtonStyle : mutedButtonStyle}
              onClick={() => {
                setFocusedSide('right');
                setComparisonMode('focus');
              }}
            >
              Focus Right
            </button>
            <button
              type="button"
              style={mutedButtonStyle}
              onClick={() => {
                setFocusedSide(getInitialDuplicateReviewImmersiveSide(focusedSide));
                setImmersiveOpen(true);
              }}
            >
              Full Screen
            </button>
            {comparisonMode === 'focus' ? (
              <span style={secondaryMetaStyle}>
                Focused asset: {focusedSide === 'left' ? 'Asset A' : 'Asset B'}
              </span>
            ) : null}
          </div>

          <div style={comparisonMode === 'focus' ? focusComparisonLayoutStyle : comparisonGridStyle}>
            {comparisonMode === 'focus' ? (
              <>
                {renderAssetPanel({
                  sideLabel: focusedSide === 'left' ? 'Asset A' : 'Asset B',
                  asset: focusedSide === 'left' ? currentPair.assetA : currentPair.assetB,
                  isFocused: true,
                  isFocusMode: true,
                  onFocus: () => undefined
                })}
                {renderAssetPanel({
                  sideLabel: focusedSide === 'left' ? 'Asset B' : 'Asset A',
                  asset: focusedSide === 'left' ? currentPair.assetB : currentPair.assetA,
                  isFocused: false,
                  isFocusMode: true,
                  onFocus: () =>
                    setFocusedSide((previous) => toggleDuplicateReviewFocusSide(previous))
                })}
              </>
            ) : (
              <>
                {renderAssetPanel({
                  sideLabel: 'Asset A',
                  asset: currentPair.assetA
                })}
                {renderAssetPanel({
                  sideLabel: 'Asset B',
                  asset: currentPair.assetB
                })}
              </>
            )}
          </div>

          <div style={metadataGridStyle}>
            <div>Score: {currentPair.score.toFixed(4)}</div>
            <div>Classification: {currentPair.classification}</div>
            <div>Status: {currentPair.status}</div>
            <div>Outcome: {currentPair.outcome ?? 'n/a'}</div>
            <div>Analysis Version: {currentPair.analysisVersion}</div>
            <div>Generation Version: {currentPair.generationVersion}</div>
          </div>

          <div style={signalGridStyle}>
            <div>dHashDistance: {formatOptionalNumber(currentPair.signals.dHashDistance)}</div>
            <div>pHashDistance: {formatOptionalNumber(currentPair.signals.pHashDistance)}</div>
            <div>Dimension Similarity: {formatOptionalNumber(currentPair.signals.dimensionsSimilarity, 4)}</div>
            <div>Aspect Ratio Delta: {formatOptionalNumber(currentPair.signals.aspectRatioDelta, 4)}</div>
            <div>
              Source Updated Delta Ms: {formatOptionalNumber(currentPair.signals.sourceUpdatedTimeDeltaMs)}
            </div>
          </div>

          <div style={actionBarStyle}>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => void handleDecision('confirmed_duplicate')}
              disabled={busyPairKey !== null}
            >
              Duplicate
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => void handleDecision('not_duplicate')}
              disabled={busyPairKey !== null}
            >
              Not Duplicate
            </button>
            <button
              type="button"
              style={warningButtonStyle}
              onClick={() => void handleDecision('ignored')}
              disabled={busyPairKey !== null}
            >
              Ignore
            </button>
            <button
              type="button"
              style={mutedButtonStyle}
              onClick={handlePrevious}
              disabled={queueState.currentIndex === 0 || busyPairKey !== null}
            >
              Previous
            </button>
            <button
              type="button"
              style={mutedButtonStyle}
              onClick={handleNext}
              disabled={queueState.currentIndex >= queueState.items.length - 1 || busyPairKey !== null}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      <section style={{ ...panelStyle, marginTop: '18px' }}>
        <h2 style={{ marginTop: 0 }}>Derived Duplicate Groups</h2>
        <p style={secondaryMetaStyle}>
          Connected components derived from reviewed `confirmed_duplicate` pair outcomes. This is not persisted clustering.
        </p>
        {groupsLoading ? <div>Loading groups...</div> : null}
        {groupsError ? <div>Failed to load groups: {groupsError}</div> : null}
        {groups ? (
          <>
            <div style={secondaryMetaStyle}>
              {groups.totalGroups} groups across {groups.totalAssets} assets
            </div>
            <div style={groupListStyle}>
              {groups.groups.slice(0, 5).map((group) => (
                <div key={group.groupId} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px' }}>
                  <strong>{group.groupId}</strong>
                  <div style={secondaryMetaStyle}>
                    {group.assetCount} assets, {group.confirmedPairCount} confirmed pair links
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '14px' }}>
                    {group.assets.map((asset) => `${asset.filename} (${asset.id})`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <button type="button" style={mutedButtonStyle} onClick={() => void handleLoadGroups()}>
            Load Confirmed Duplicate Groups
          </button>
        )}
      </section>

      {immersiveOpen && immersiveAsset ? (
        <div style={immersiveOverlayStyle} onClick={() => setImmersiveOpen(false)}>
          <section style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }} onClick={(event) => event.stopPropagation()}>
            <div style={immersiveHeaderStyle}>
              <div style={immersiveMetaStyle}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
                  Duplicate Compare Full Screen
                </div>
                <div>
                  Showing {focusedSide === 'left' ? 'Asset A' : 'Asset B'} · {immersiveAsset.filename}
                </div>
                <div>{immersiveAsset.originalArchivePath ?? 'n/a'}</div>
                {currentPair ? (
                  <div>
                    Score {currentPair.score.toFixed(4)} · {currentPair.classification} · Pair{' '}
                    {queueState.currentIndex + 1} of {totalMatching}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={focusedSide === 'left' ? primaryButtonStyle : mutedButtonStyle}
                  onClick={() => setFocusedSide('left')}
                >
                  Show Left
                </button>
                <button
                  type="button"
                  style={focusedSide === 'right' ? primaryButtonStyle : mutedButtonStyle}
                  onClick={() => setFocusedSide('right')}
                >
                  Show Right
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() => setImmersiveOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={immersiveControlsStyle}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void handleImmersiveDecision('confirmed_duplicate')}
                disabled={busyPairKey !== null || !currentPair}
              >
                Duplicate
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => void handleImmersiveDecision('not_duplicate')}
                disabled={busyPairKey !== null || !currentPair}
              >
                Not Duplicate
              </button>
              <button
                type="button"
                style={warningButtonStyle}
                onClick={() => void handleImmersiveDecision('ignored')}
                disabled={busyPairKey !== null || !currentPair}
              >
                Ignore
              </button>
              <button
                type="button"
                style={mutedButtonStyle}
                onClick={handleImmersivePrevious}
                disabled={busyPairKey !== null || queueState.currentIndex <= 0}
              >
                Previous
              </button>
              <button
                type="button"
                style={mutedButtonStyle}
                onClick={handleImmersiveNext}
                disabled={busyPairKey !== null || queueState.currentIndex >= queueState.items.length - 1}
              >
                Next
              </button>
            </div>

            <div style={immersiveImageWrapStyle}>
              <img
                key={immersiveAsset.id}
                src={getDisplayMediaUrl(immersiveAsset.id)}
                alt={immersiveAsset.filename}
                style={immersiveImageStyle}
              />
            </div>

            <div style={immersiveHintStyle}>
              Keyboard: D duplicate, N not duplicate, I ignore, J next, K previous, Tab toggle side, Left show left, Right show right, Escape close full screen.
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default DuplicateReviewPage;
