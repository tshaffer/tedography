import { useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type {
  DuplicateCandidatePairAssetSummary,
  DuplicateCandidatePairSummaryResponse,
} from '@tedography/shared';
import {
  type DuplicateReviewActionDecision,
  getDuplicateCandidatePairSummary,
  listDuplicateCandidatePairs,
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
import {
  getDefaultDuplicateReviewFocusSide,
  type DuplicateReviewFocusSide
} from './focusMode';
import {
  getDuplicateReviewImmersiveActionForKey,
  getDuplicateReviewImmersiveSideForKey,
  getInitialDuplicateReviewImmersiveSide
} from './duplicateReviewImmersive';
import { applyOptimisticDuplicateVisibilityUpdate } from './duplicateVisibilityRefresh';
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

const fullModePageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#020617',
  color: '#f8fafc',
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

const sliderStyle: CSSProperties = {
  width: '100%'
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

const pairHeroSectionStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'stretch',
  marginBottom: '20px'
};

const pairHeroGridStyle: CSSProperties = {
  ...comparisonGridStyle,
  width: '100%'
};

const assetPanelStyle: CSSProperties = {
  border: '1px solid #e4e4e7',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  overflow: 'hidden'
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
  minHeight: '100vh',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px',
  boxSizing: 'border-box'
};

const immersiveBodyStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto'
};

const immersiveMetaStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontSize: '14px',
  color: '#cbd5e1'
};

const immersiveImageWrapStyle: CSSProperties = {
  minHeight: 'calc(100vh - 40px)',
  maxHeight: 'calc(100vh - 40px)',
  display: 'flex',
  position: 'relative',
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

const immersiveBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  padding: '8px 10px',
  borderRadius: '999px',
  backgroundColor: 'rgba(15, 23, 42, 0.78)',
  color: '#f8fafc',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
  fontSize: '13px',
  fontWeight: 600,
  display: 'grid',
  gap: '2px',
  justifyItems: 'end',
  textAlign: 'right',
  backdropFilter: 'blur(10px)'
};

const immersiveControlsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center'
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

function formatFileSize(value: number | null | undefined): string {
  if (value === undefined || value === null || value <= 0) {
    return 'n/a';
  }

  const units = ['bytes', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} bytes`;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatFileSizeDelta(value: number | null | undefined, otherValue: number | null | undefined): string | null {
  if (
    value === undefined ||
    value === null ||
    otherValue === undefined ||
    otherValue === null
  ) {
    return null;
  }

  const delta = value - otherValue;
  if (delta === 0) {
    return null;
  }

  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatFileSize(Math.abs(delta))} vs other photo`;
}

function getFileSizeComparisonLabel(
  value: number | null | undefined,
  otherValue: number | null | undefined
): string | null {
  if (
    value === undefined ||
    value === null ||
    otherValue === undefined ||
    otherValue === null
  ) {
    return null;
  }

  if (value > otherValue) {
    return 'Larger file';
  }

  if (value < otherValue) {
    return 'Smaller file';
  }

  return 'Same file size';
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
    const parsed = JSON.parse(value) as Partial<DuplicateReviewFilters> & {
      highConfidenceOnly?: boolean;
    };
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
      minScore:
        typeof parsed.minScore === 'string'
          ? parsed.minScore
          : parsed.highConfidenceOnly === true
            ? '0.90'
            : ''
    };
  } catch {
    return defaultDuplicateReviewFilters;
  }
}

function getDuplicateReviewOutcomeForDecision(
  decision: DuplicateReviewActionDecision
): 'confirmed_duplicate' | 'not_duplicate' | 'none' {
  if (
    decision === 'confirmed_duplicate_keep_both' ||
    decision === 'confirmed_duplicate_keep_left' ||
    decision === 'confirmed_duplicate_keep_right'
  ) {
    return 'confirmed_duplicate';
  }

  if (decision === 'not_duplicate') {
    return 'not_duplicate';
  }

  return 'none';
}

function applyOptimisticDuplicateReviewUpdate(input: {
  pairKey: string;
  decision: DuplicateReviewActionDecision;
  setQueueState: React.Dispatch<React.SetStateAction<DuplicateReviewQueueState>>;
  setTotalMatching: React.Dispatch<React.SetStateAction<number>>;
  setSummary: React.Dispatch<React.SetStateAction<DuplicateCandidatePairSummaryResponse | null>>;
}): void {
  const { pairKey, decision, setQueueState, setTotalMatching, setSummary } = input;
  const outcome = getDuplicateReviewOutcomeForDecision(decision);

  setQueueState((previous) => removeReviewedDuplicatePair(previous, pairKey));
  setTotalMatching((previous) => Math.max(previous - 1, 0));
  setSummary((previous) => {
    if (!previous) {
      return previous;
    }

    return {
      ...previous,
      total: Math.max(previous.total - 1, 0),
      statusCounts: {
        ...previous.statusCounts,
        unreviewed: Math.max(previous.statusCounts.unreviewed - 1, 0),
        reviewed: previous.statusCounts.reviewed + 1
      },
      outcomeCounts: {
        ...previous.outcomeCounts,
        [outcome]: previous.outcomeCounts[outcome] + 1
      }
    };
  });
}

function renderAssetPanel(input: {
  sideLabel: string;
  asset: DuplicateCandidatePairAssetSummary | null;
  otherAsset?: DuplicateCandidatePairAssetSummary | null;
  showMetadata?: boolean;
  imageContainerStyle?: CSSProperties;
}): ReactElement {
  const { sideLabel, asset, otherAsset = null, showMetadata = true, imageContainerStyle } = input;
  if (!asset) {
    return (
      <section style={assetPanelStyle}>
        <div style={imageWrapStyle}>Missing asset metadata</div>
      </section>
    );
  }

  const fileSizeLabel = getFileSizeComparisonLabel(asset.originalFileSizeBytes, otherAsset?.originalFileSizeBytes);
  const fileSizeDelta = formatFileSizeDelta(asset.originalFileSizeBytes, otherAsset?.originalFileSizeBytes);

  return (
    <section style={assetPanelStyle}>
      <div style={{ ...imageWrapStyle, position: 'relative', ...(imageContainerStyle ?? {}) }}>
        {fileSizeLabel ? (
          <div style={{ ...immersiveBadgeStyle, top: '12px', right: '12px' }}>
            <div>{fileSizeLabel}</div>
            {fileSizeDelta ? <div>{fileSizeDelta.replace(' vs other photo', ' vs other')}</div> : null}
          </div>
        ) : null}
        <img src={getDisplayMediaUrl(asset.id)} alt={`${sideLabel} ${asset.filename}`} style={imageStyle} />
      </div>
      {showMetadata ? renderAssetMetadata({ sideLabel, asset, fileSizeLabel, fileSizeDelta }) : null}
    </section>
  );
}

function renderAssetMetadata(input: {
  sideLabel: string;
  asset: DuplicateCandidatePairAssetSummary;
  fileSizeLabel: string | null;
  fileSizeDelta: string | null;
  style?: CSSProperties;
}): ReactElement {
  const { sideLabel, asset, fileSizeLabel, fileSizeDelta, style } = input;

  return (
    <div style={{ ...assetMetaStyle, ...(style ?? {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
        <strong>{sideLabel}</strong>
      </div>
      <div>Filename: {asset.filename}</div>
      <div>Asset ID: {asset.id}</div>
      <div>Original Path: {asset.originalArchivePath ?? 'n/a'}</div>
      <div>Capture: {formatOptionalDate(asset.captureDateTime)}</div>
      <div>
        Dimensions: {formatOptionalNumber(asset.width)} x {formatOptionalNumber(asset.height)}
      </div>
      <div>File Size: {formatFileSize(asset.originalFileSizeBytes)}</div>
      {fileSizeLabel ? (
        <div style={secondaryMetaStyle}>
          {fileSizeLabel}
          {fileSizeDelta ? ` · ${fileSizeDelta}` : ''}
        </div>
      ) : null}
    </div>
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
  const [displayMode, setDisplayMode] = useState<'pair' | 'full'>('pair');
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPairKey, setBusyPairKey] = useState<string | null>(null);
  const [totalMatching, setTotalMatching] = useState(0);
  const [summary, setSummary] = useState<DuplicateCandidatePairSummaryResponse | null>(null);
  const [focusedSide, setFocusedSide] = useState<DuplicateReviewFocusSide>(
    getDefaultDuplicateReviewFocusSide()
  );

  const currentPair = queueState.items[queueState.currentIndex] ?? null;
  const trimmedAssetId = appliedFilters.assetId.trim();
  const minScore = Number.parseFloat(appliedFilters.minScore);
  const normalizedMinScore = Number.isFinite(minScore) && minScore > 0 ? minScore : undefined;
  const draftMinScore = Number.parseFloat(draftFilters.minScore);
  const draftMinScoreValue = Number.isFinite(draftMinScore) && draftMinScore >= 0 ? draftMinScore : 0;
  const immersiveAsset = displayMode === 'full'
    ? focusedSide === 'left'
      ? currentPair?.assetA ?? null
      : currentPair?.assetB ?? null
    : null;
  const immersiveOtherAsset = displayMode === 'full'
    ? focusedSide === 'left'
      ? currentPair?.assetB ?? null
      : currentPair?.assetA ?? null
    : null;
  const immersiveFileSizeLabel = getFileSizeComparisonLabel(
    immersiveAsset?.originalFileSizeBytes,
    immersiveOtherAsset?.originalFileSizeBytes
  );
  const immersiveFileSizeDelta = formatFileSizeDelta(
    immersiveAsset?.originalFileSizeBytes,
    immersiveOtherAsset?.originalFileSizeBytes
  );

  function getKeepDecisionForFocusedSide(): DuplicateReviewActionDecision {
    return focusedSide === 'left'
      ? 'confirmed_duplicate_keep_left'
      : 'confirmed_duplicate_keep_right';
  }

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
          ...(normalizedMinScore !== undefined ? { minScore: normalizedMinScore } : {}),
          limit: maxQueueItems,
          offset: 0
        }),
        getDuplicateCandidatePairSummary({
          ...(trimmedAssetId.length > 0 ? { assetId: trimmedAssetId } : {}),
          ...(normalizedMinScore !== undefined ? { minScore: normalizedMinScore } : {})
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
  }, [appliedFilters.status, appliedFilters.classification, appliedFilters.outcome, appliedFilters.assetId, appliedFilters.minScore]);

  useEffect(() => {
    if (displayMode !== 'full') {
      setFocusedSide(getDefaultDuplicateReviewFocusSide());
    }
  }, [currentPair?.pairKey]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (busyPairKey || isEditableEventTarget(event.target)) {
        return;
      }

      if (displayMode === 'full') {
        if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          setDisplayMode('pair');
          return;
        }

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
          setDisplayMode('pair');
          return;
        }

        if (immersiveAction === 'reviewed_uncertain') {
          event.preventDefault();
          void handleImmersiveDecision('reviewed_uncertain');
          return;
        }

        if (immersiveAction === 'not_duplicate') {
          event.preventDefault();
          void handleImmersiveDecision('not_duplicate');
          return;
        }

        if (immersiveAction === 'confirmed_duplicate_keep_both') {
          event.preventDefault();
          void handleImmersiveDecision('confirmed_duplicate_keep_both');
          return;
        }

        if (immersiveAction === 'keep_current_photo') {
          event.preventDefault();
          void handleImmersiveDecision(getKeepDecisionForFocusedSide());
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

      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setFocusedSide(getInitialDuplicateReviewImmersiveSide(focusedSide));
        setDisplayMode('full');
        return;
      }

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        void handleDecision('reviewed_uncertain');
        return;
      }

      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        void handleDecision('confirmed_duplicate_keep_both');
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        void handleDecision('not_duplicate');
        return;
      }

      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        void handleDecision('confirmed_duplicate_keep_left');
        return;
      }

      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        void handleDecision('confirmed_duplicate_keep_right');
        return;
      }

      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        handleNext();
        return;
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        handlePrevious();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [busyPairKey, queueState, currentPair, displayMode, focusedSide]);

  async function handleDecision(decision: DuplicateReviewActionDecision): Promise<void> {
    if (!currentPair) {
      return;
    }

    const reviewedPairKey = currentPair.pairKey;
    const nextCandidatePairKey =
      queueState.items[queueState.currentIndex + 1]?.pairKey ??
      queueState.items[queueState.currentIndex - 1]?.pairKey ??
      null;

    setBusyPairKey(reviewedPairKey);
    setError(null);
    setNotice(null);

    try {
      applyOptimisticDuplicateReviewUpdate({
        pairKey: reviewedPairKey,
        decision,
        setQueueState,
        setTotalMatching,
        setSummary
      });

      applyOptimisticDuplicateVisibilityUpdate({
        assetIdA: currentPair.assetIdA,
        assetIdB: currentPair.assetIdB,
        decision
      });

      const response = await updateDuplicateCandidatePairReview(reviewedPairKey, { decision });
      if (response.groupReviewGuardrail?.requiresGroupReview) {
        applyOptimisticDuplicateVisibilityUpdate({
          assetIdA: currentPair.assetIdA,
          assetIdB: currentPair.assetIdB,
          decision: 'reviewed_uncertain'
        });
        setNotice(response.groupReviewGuardrail.message);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update pair review');
      await loadQueueAndSummary(nextCandidatePairKey);
    } finally {
      setBusyPairKey(null);
    }
  }

  async function handleImmersiveDecision(decision: DuplicateReviewActionDecision): Promise<void> {
    await handleDecision(decision);
  }

  function handleApplyFilters(event?: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event && event.key !== 'Enter') {
      return;
    }

    setAppliedFilters({
      ...draftFilters,
      assetId: draftFilters.assetId.trim(),
      minScore: draftFilters.minScore.trim()
    });
  }

  function handleResetFilters(): void {
    setDraftFilters(defaultDuplicateReviewFilters);
    setAppliedFilters(defaultDuplicateReviewFilters);
  }

  function handleApplyPreset(presetId: DuplicateReviewPresetId): void {
    const presetFilters = getDuplicateReviewPresetFilters(presetId);
    setDraftFilters(presetFilters);
    setAppliedFilters(presetFilters);
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
      renderSummaryCard('No Outcome Yet', summary.outcomeCounts.none),
      renderSummaryCard(
        'Remaining Loaded',
        Math.max(queueState.items.length - queueState.currentIndex - 1, 0),
        currentPair ? 'After current pair' : undefined
      ),
      ...(normalizedMinScore !== undefined
        ? [renderSummaryCard('At Min Score', totalMatching, `score >= ${normalizedMinScore.toFixed(2)}`)]
        : [])
    ]
    : [];

  function renderPairDisplayHero(): ReactElement | null {
    if (!currentPair) {
      return null;
    }

    return (
      <section style={pairHeroSectionStyle}>
        <div style={pairHeroGridStyle}>
          {renderAssetPanel({
            sideLabel: 'Asset A',
            asset: currentPair.assetA,
            otherAsset: currentPair.assetB,
            showMetadata: true,
            imageContainerStyle: { height: 'calc(100vh - 40px)' }
          })}
          {renderAssetPanel({
            sideLabel: 'Asset B',
            asset: currentPair.assetB,
            otherAsset: currentPair.assetA,
            showMetadata: true,
            imageContainerStyle: { height: 'calc(100vh - 40px)' }
          })}
        </div>
      </section>
    );
  }

  function renderCurrentPairDetails(options?: { fullscreen?: boolean; showImages?: boolean }): ReactElement | null {
    if (!currentPair) {
      return null;
    }

    const fullscreen = options?.fullscreen ?? false;
    const showImages = options?.showImages ?? !fullscreen;
    const containerStyle = fullscreen
      ? {
        ...panelStyle,
        margin: '20px',
        backgroundColor: '#fffdf9',
        color: '#1e293b'
      }
      : panelStyle;
    const shortcutsText = fullscreen
      ? 'Shortcuts: M toggle screen mode, F previous, J next, Left/Right toggle photo, K keep this photo, C can’t decide, B keep both, N not duplicate'
      : 'Shortcuts: M toggle screen mode, F previous, J next, G keep left, H keep right, C can’t decide, B keep both, N not duplicate';

    return (
      <section style={containerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Current Pair</h2>
            <div style={secondaryMetaStyle}>
              Position {queueState.currentIndex + 1} of {totalMatching}
              {totalMatching > queueState.items.length ? `, loaded first ${queueState.items.length}` : ''}
            </div>
          </div>
          <div style={secondaryMetaStyle}>{shortcutsText}</div>
        </div>

        {!fullscreen && showImages ? (
          <>
            <div style={focusToggleBarStyle}>
              <button
                type="button"
                style={mutedButtonStyle}
                onClick={() => {
                  setFocusedSide(getInitialDuplicateReviewImmersiveSide(focusedSide));
                  setDisplayMode('full');
                }}
              >
                Full Screen
              </button>
            </div>

            <div style={comparisonGridStyle}>
              {renderAssetPanel({
                sideLabel: 'Asset A',
                asset: currentPair.assetA,
                otherAsset: currentPair.assetB
              })}
              {renderAssetPanel({
                sideLabel: 'Asset B',
                asset: currentPair.assetB,
                otherAsset: currentPair.assetA
              })}
            </div>
          </>
        ) : null}

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
            onClick={() => void (fullscreen ? handleImmersiveDecision('reviewed_uncertain') : handleDecision('reviewed_uncertain'))}
            disabled={busyPairKey !== null}
          >
            Can’t Decide
          </button>
          <button
            type="button"
            style={buttonStyle}
            onClick={() =>
              void (fullscreen
                ? handleImmersiveDecision('confirmed_duplicate_keep_both')
                : handleDecision('confirmed_duplicate_keep_both'))
            }
            disabled={busyPairKey !== null}
          >
            Keep Both
          </button>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => void (fullscreen ? handleImmersiveDecision('not_duplicate') : handleDecision('not_duplicate'))}
            disabled={busyPairKey !== null}
          >
            Not Duplicates
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() =>
              void (fullscreen ? handleImmersiveDecision(getKeepDecisionForFocusedSide()) : handleDecision('confirmed_duplicate_keep_left'))
            }
            disabled={busyPairKey !== null}
          >
            {fullscreen ? 'Keep This Photo' : 'Keep Left'}
          </button>
          {!fullscreen ? (
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => void handleDecision('confirmed_duplicate_keep_right')}
              disabled={busyPairKey !== null}
            >
              Keep Right
            </button>
          ) : null}
          <button
            type="button"
            style={mutedButtonStyle}
            onClick={fullscreen ? handleImmersivePrevious : handlePrevious}
            disabled={busyPairKey !== null || queueState.currentIndex === 0}
          >
            Previous
          </button>
          <button
            type="button"
            style={mutedButtonStyle}
            onClick={fullscreen ? handleImmersiveNext : handleNext}
            disabled={busyPairKey !== null || queueState.currentIndex >= queueState.items.length - 1}
          >
            Next
          </button>
        </div>
      </section>
    );
  }

  const queueFiltersSection = (
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
          <span>Minimum Score</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={draftMinScoreValue}
            style={sliderStyle}
            onChange={(event) =>
              setDraftFilters((previous) => ({
                ...previous,
                minScore: Number.parseFloat(event.target.value) <= 0 ? '' : event.target.value
              }))
            }
          />
          <span style={secondaryMetaStyle}>
            {draftMinScoreValue <= 0 ? 'Any score' : `Score >= ${draftMinScoreValue.toFixed(2)}`}
          </span>
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
      <div style={filterActionBarStyle}>
        <button type="button" style={primaryButtonStyle} onClick={() => handleApplyFilters()}>
          Apply Filters
        </button>
        <button type="button" style={mutedButtonStyle} onClick={handleResetFilters}>
          Reset Filters
        </button>
        <span style={secondaryMetaStyle}>
          Active queue: {appliedFilters.status}, {appliedFilters.classification}, {appliedFilters.outcome}
          {trimmedAssetId ? `, asset ${trimmedAssetId}` : ''}
          {normalizedMinScore !== undefined ? `, score >= ${normalizedMinScore.toFixed(2)}` : ''}
        </span>
      </div>
    </section>
  );

  const queueProgressSection = (
    <section style={queueProgressStyle}>
      <div>
        <strong>Queue Progress</strong>
        <div style={secondaryMetaStyle}>
          Current slice: {currentSliceLabel}
          {activePresetId === null ? ` · ${appliedFilters.status}, ${appliedFilters.classification}, ${appliedFilters.outcome}` : ''}
          {trimmedAssetId ? ` · asset ${trimmedAssetId}` : ''}
          {normalizedMinScore !== undefined ? ` · score >= ${normalizedMinScore.toFixed(2)}` : ''}
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
  );

  const loadingSection = loading ? <section style={panelStyle}>Loading duplicate candidate pairs...</section> : null;
  const errorSection = error ? <section style={panelStyle}>Failed to load duplicate review queue: {error}</section> : null;
  const noticeSection = notice ? (
    <section style={{ ...panelStyle, backgroundColor: '#fef3c7', color: '#92400e' }}>{notice}</section>
  ) : null;
  const emptySection = !loading && !error && !currentPair ? (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>No pairs match the current filter</h2>
      <p style={secondaryMetaStyle}>
        Adjust the queue filters or generate more candidate pairs if you expect additional review work.
      </p>
    </section>
  ) : null;

  if (displayMode === 'full' && immersiveAsset) {
    return (
      <div style={fullModePageStyle}>
        <section style={immersiveOverlayStyle}>
          <div style={immersiveBodyStyle}>
            <div style={immersiveImageWrapStyle}>
              {immersiveFileSizeLabel ? (
                <div style={immersiveBadgeStyle}>
                  <div>{immersiveFileSizeLabel}</div>
                  {immersiveFileSizeDelta ? <div>{immersiveFileSizeDelta.replace(' vs other photo', ' vs other')}</div> : null}
                </div>
              ) : null}
              <img
                key={immersiveAsset.id}
                src={getDisplayMediaUrl(immersiveAsset.id)}
                alt={immersiveAsset.filename}
                style={immersiveImageStyle}
              />
            </div>

            <section
              style={{
                ...panelStyle,
                margin: '0 20px',
                backgroundColor: '#fffdf9',
                color: '#1e293b'
              }}
            >
              {renderAssetMetadata({
                sideLabel: focusedSide === 'left' ? 'Asset A' : 'Asset B',
                asset: immersiveAsset,
                fileSizeLabel: immersiveFileSizeLabel,
                fileSizeDelta: immersiveFileSizeDelta
              })}
            </section>

            {renderCurrentPairDetails({ fullscreen: true })}

            <div style={{ padding: '0 20px 20px 20px' }}>
              {queueFiltersSection}
              {queueProgressSection}
              {summaryCards.length > 0 ? <div style={summaryGridStyle}>{summaryCards}</div> : null}
              {loadingSection}
              {errorSection}
              {noticeSection}
              {emptySection}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {!loading && !error && currentPair ? renderPairDisplayHero() : null}
      <div style={{ ...headerActionsStyle, marginBottom: '18px' }}>
        <Link to="/duplicates/groups" style={linkStyle}>
          Group Review
        </Link>
        <Link to="/" style={linkStyle}>
          Back to Library
        </Link>
      </div>

      {!loading && !error && currentPair ? renderCurrentPairDetails({ showImages: false }) : null}
      {queueFiltersSection}
      {queueProgressSection}
      {summaryCards.length > 0 ? <div style={summaryGridStyle}>{summaryCards}</div> : null}
      {loadingSection}
      {errorSection}
      {noticeSection}
      {emptySection}
    </div>
  );
}

export default DuplicateReviewPage;
