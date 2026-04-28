import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { FaceDetectionIgnoredReason, FaceDetectionMatchStatus } from '@tedography/domain';
import type { PeoplePipelineSummaryResponse, PeopleReviewQueueItem, PeopleReviewQueueSort } from '@tedography/shared';
import {
  enrollPersonFromDetection,
  getPeoplePipelineSummary,
  listPeople,
  listPeopleReviewQueue,
  reviewFaceDetection
} from '../../api/peoplePipelineApi';
import { getFaceDetectionPreviewUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';
import { getAssignmentActionState, getExampleActionState, getFaceReviewActionState } from './peopleReviewActionState';

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '0 auto',
  padding: '16px',
  maxWidth: '1400px',
  backgroundColor: '#f3f4f6',
  minHeight: '100vh',
  boxSizing: 'border-box'
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
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

const cardStyle: CSSProperties = {
  ...panelStyle,
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: '16px'
};

const currentCardStyle: CSSProperties = {
  ...cardStyle,
  borderColor: '#0f5f73',
  boxShadow: '0 0 0 2px rgba(15, 95, 115, 0.12), 0 10px 24px rgba(15, 23, 42, 0.08)'
};

const previewBoxStyle: CSSProperties = {
  border: '1px solid #d7dce2',
  borderRadius: '12px',
  overflow: 'hidden',
  backgroundColor: '#eef2f7'
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  backgroundColor: '#dbe2ea'
};

const placeholderStyle: CSSProperties = {
  ...previewImageStyle,
  display: 'grid',
  placeItems: 'center',
  color: '#516273',
  fontSize: '13px',
  fontWeight: 600
};

const metaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '8px 12px',
  marginBottom: '12px'
};

const metaItemStyle: CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.35
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#556677',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '2px'
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const currentBadgeStyle: CSSProperties = {
  ...badgeStyle,
  borderColor: '#0f5f73',
  backgroundColor: '#e8f5f8',
  color: '#0d4f60'
};

const actionsSectionStyle: CSSProperties = {
  display: 'grid',
  gap: '10px'
};

const previewColumnStyle: CSSProperties = {
  display: 'grid',
  gap: '10px'
};

const inlineRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center'
};

const inputStyle: CSSProperties = {
  border: '1px solid #c8d0d9',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  minWidth: '0'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #c6d0da',
  borderRadius: '8px',
  backgroundColor: '#f7f9fb',
  color: '#163246',
  fontSize: '13px',
  fontWeight: 700,
  padding: '8px 12px',
  cursor: 'pointer'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f5f73',
  color: '#fff',
  borderColor: '#0f5f73'
};

const destructiveButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#fff5f5',
  borderColor: '#e7b3b3',
  color: '#7a1f1f'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const compactButtonStyle: CSSProperties = {
  ...buttonStyle,
  padding: '6px 10px',
  fontSize: '12px'
};

const queuedBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#fffbeb',
  borderColor: '#d4a72c',
  color: '#7a4f00',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px'
};

const applyButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f5f73',
  color: '#fff',
  borderColor: '#0f5f73'
};

const queuedConfirmBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#edfaf3',
  borderColor: '#2e9e68',
  color: '#15603a',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px'
};

const queuedIgnoreBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#f1f5f9',
  borderColor: '#64748b',
  color: '#334155',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px'
};

const statusOptions: Array<{ value: FaceDetectionMatchStatus; label: string }> = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'autoMatched', label: 'Auto Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ignored', label: 'Ignored' }
];

const defaultStatuses: FaceDetectionMatchStatus[] = ['suggested', 'autoMatched', 'unmatched'];
const sortOptions: Array<{ value: PeopleReviewQueueSort; label: string }> = [
  { value: 'newest', label: 'Newest First' },
  { value: 'highestConfidence', label: 'Highest Confidence' },
  { value: 'lowestConfidence', label: 'Lowest Confidence' },
  { value: 'filename', label: 'Filename' },
  { value: 'assetId', label: 'Asset ID' }
];
const ignoredReasonOptions: FaceDetectionIgnoredReason[] = [
  'user-ignored',
  'too-small',
  'too-low-quality',
  'background-face',
  'non-person-face',
  'other'
];
const scopedPeopleReviewAssetIdsStorageKey = 'tedography.people.review.scopeAssetIds';

type ScopedPeopleReviewAssetIdsState = {
  assetIds: string[];
  scopeType: string;
  scopeLabel: string;
  scopeSourceLabel: string;
};

function readScopedPeopleReviewAssetIdsState(): ScopedPeopleReviewAssetIdsState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(scopedPeopleReviewAssetIdsStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ScopedPeopleReviewAssetIdsState> | null;
    if (!parsed || !Array.isArray(parsed.assetIds)) {
      return null;
    }

    return {
      assetIds: parsed.assetIds.map((value) => String(value).trim()).filter(Boolean),
      scopeType: typeof parsed.scopeType === 'string' ? parsed.scopeType : 'Scoped assets',
      scopeLabel: typeof parsed.scopeLabel === 'string' ? parsed.scopeLabel : 'Scoped asset set',
      scopeSourceLabel: typeof parsed.scopeSourceLabel === 'string' ? parsed.scopeSourceLabel : 'Scoped assets'
    };
  } catch {
    return null;
  }
}

function getDefaultStatusesForAssetScope(assetId: string): FaceDetectionMatchStatus[] {
  return assetId.trim().length > 0 ? [...defaultStatuses, 'confirmed', 'ignored'] : defaultStatuses;
}

type ReviewDraftState = {
  selectedPersonId: string;
  newPersonName: string;
  ignoredReason: FaceDetectionIgnoredReason;
};

const recentPeopleStorageKey = 'tedography.peopleReview.recentPeople';
const autoAdvanceStorageKey = 'tedography.peopleReview.autoAdvance';

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'option';
}

function readRecentPeopleIds(): string[] {
  try {
    const raw = window.localStorage.getItem(recentPeopleStorageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function readAutoAdvanceDefault(): boolean {
  try {
    return window.localStorage.getItem(autoAdvanceStorageKey) !== 'false';
  } catch {
    return true;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatConfidence(value?: number | null): string {
  return typeof value === 'number' ? value.toFixed(4) : '—';
}

function formatPeopleList(items: Array<{ displayName: string }>): string {
  if (items.length === 0) {
    return 'None derived yet';
  }

  return items.map((item) => item.displayName).join(', ');
}

function getMatchStatusSummary(item: PeopleReviewQueueItem): string {
  switch (item.detection.matchStatus) {
    case 'confirmed':
      return item.matchedPerson?.displayName
        ? `Confirmed people metadata now includes ${item.matchedPerson.displayName} for this asset.`
        : 'Confirmed face. Derived asset people should now reflect the reviewed assignment.';
    case 'autoMatched':
      return item.suggestedPerson?.displayName
        ? `Auto-matched candidate ${item.suggestedPerson.displayName} is still not confirmed for derived asset people.`
        : 'Auto-matched face still requires confirmation before it becomes derived asset people.';
    case 'suggested':
      return item.suggestedPerson?.displayName
        ? `Suggested match ${item.suggestedPerson.displayName} still needs review before it becomes derived asset people.`
        : 'Suggested face still needs review before it becomes derived asset people.';
    case 'unmatched':
      return 'Detected face has no accepted person yet. It does not affect derived asset people.';
    case 'rejected':
      return 'Rejected match stays out of derived asset people until it is explicitly reassigned and confirmed.';
    case 'ignored':
      return 'Ignored face is excluded from derived asset people.';
    default:
      return 'Review this face before trusting it as derived asset people.';
  }
}

function getConfirmActionHint(item: PeopleReviewQueueItem): string | null {
  const suggestedPersonName = item.suggestedPerson?.displayName?.trim() ?? '';
  const assignedPersonName = item.matchedPerson?.displayName?.trim() ?? '';

  if (suggestedPersonName.length > 0 && assignedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return `This confirms the suggested person (${suggestedPersonName}), not the currently assigned person (${assignedPersonName}).`;
  }

  return null;
}

export function PeopleReviewPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<PeopleReviewQueueItem[]>([]);
  const [counts, setCounts] = useState<Record<FaceDetectionMatchStatus, number>>({
    unmatched: 0,
    suggested: 0,
    autoMatched: 0,
    confirmed: 0,
    rejected: 0,
    ignored: 0
  });
  const [peopleOptions, setPeopleOptions] = useState<Array<{ id: string; displayName: string }>>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<FaceDetectionMatchStatus[]>(() =>
    getDefaultStatusesForAssetScope(searchParams.get('assetId')?.trim() ?? '')
  );
  const [assetIdFilter, setAssetIdFilter] = useState(() => searchParams.get('assetId')?.trim() ?? '');
  const [personIdFilter, setPersonIdFilter] = useState(() => searchParams.get('personId')?.trim() ?? '');
  const [scopedAssetIdsState, setScopedAssetIdsState] = useState<ScopedPeopleReviewAssetIdsState | null>(() =>
    searchParams.get('scopeAssetIds') === 'active' ? readScopedPeopleReviewAssetIdsState() : null
  );
  const [sortBy, setSortBy] = useState<PeopleReviewQueueSort>('newest');
  const [draftByDetectionId, setDraftByDetectionId] = useState<Record<string, ReviewDraftState>>({});
  const [busyDetectionId, setBusyDetectionId] = useState<string | null>(null);
  const [currentDetectionId, setCurrentDetectionId] = useState<string | null>(null);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<string[]>([]);
  const [personFilterId, setPersonFilterId] = useState('');
  const [recentPeopleIds, setRecentPeopleIds] = useState<string[]>(() => readRecentPeopleIds());
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(() => readAutoAdvanceDefault());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<PeoplePipelineSummaryResponse | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, { personId: string; personName: string }>>({});
  const [pendingConfirmations, setPendingConfirmations] = useState<Record<string, { confirmPersonId: string | null; personName: string }>>({});
  const [pendingIgnores, setPendingIgnores] = useState<Record<string, { ignoredReason: FaceDetectionIgnoredReason }>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const assignSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const createInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function rememberRecentPerson(personId: string | null | undefined): void {
    if (!personId) {
      return;
    }

    setRecentPeopleIds((current) => {
      const next = [personId, ...current.filter((value) => value !== personId)].slice(0, 6);
      try {
        window.localStorage.setItem(recentPeopleStorageKey, JSON.stringify(next));
      } catch {
        // Best-effort only.
      }
      return next;
    });
  }

  async function loadPageData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [queueResponse, peopleResponse, summaryResponse] = await Promise.all([
        listPeopleReviewQueue({
          statuses: selectedStatuses,
          ...(assetIdFilter.trim() ? { assetId: assetIdFilter.trim() } : {}),
          ...(scopedAssetIdsState?.assetIds && scopedAssetIdsState.assetIds.length > 0
            ? { assetIds: scopedAssetIdsState.assetIds }
            : {}),
          ...(personIdFilter.trim() ? { personId: personIdFilter.trim() } : {}),
          limit: 200,
          sort: sortBy
        }),
        listPeople(),
        getPeoplePipelineSummary()
      ]);
      setItems(queueResponse.items);
      setCounts(queueResponse.counts);
      setPeopleOptions(
        peopleResponse.items.map((person) => ({ id: person.id, displayName: person.displayName }))
      );
      setSummary(summaryResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load people review data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, [selectedStatuses, assetIdFilter, personIdFilter, scopedAssetIdsState, sortBy]);

  useEffect(() => {
    try {
      window.localStorage.setItem(autoAdvanceStorageKey, autoAdvanceEnabled ? 'true' : 'false');
    } catch {
      // Best-effort only.
    }
  }, [autoAdvanceEnabled]);

  useEffect(() => {
    const queryAssetId = searchParams.get('assetId')?.trim() ?? '';
    const queryPersonId = searchParams.get('personId')?.trim() ?? '';
    const queryScopeAssetIds = searchParams.get('scopeAssetIds');
    setAssetIdFilter(queryAssetId);
    setPersonIdFilter(queryPersonId);
    setScopedAssetIdsState(queryScopeAssetIds === 'active' ? readScopedPeopleReviewAssetIdsState() : null);
    setSelectedStatuses((current) => {
      const defaultForScope = getDefaultStatusesForAssetScope(queryAssetId);
      const currentSet = new Set(current);
      const isStillDefaultReviewSet =
        current.length === defaultStatuses.length && defaultStatuses.every((status) => currentSet.has(status));

      if (queryAssetId.length > 0 && isStillDefaultReviewSet) {
        return defaultForScope;
      }

      if (queryAssetId.length === 0 && current.length === defaultForScope.length && defaultForScope.every((status) => currentSet.has(status))) {
        return defaultStatuses;
      }

      return current;
    });
  }, [searchParams]);

  function getDraft(detectionId: string, storedIgnoredReason?: FaceDetectionIgnoredReason | null): ReviewDraftState {
    return (
      draftByDetectionId[detectionId] ?? {
        selectedPersonId: '',
        newPersonName: '',
        ignoredReason: storedIgnoredReason ?? 'user-ignored'
      }
    );
  }

  function updateDraft(detectionId: string, patch: Partial<ReviewDraftState>) {
    setDraftByDetectionId((current) => ({
      ...current,
      [detectionId]: {
        ...getDraft(detectionId),
        ...patch
      }
    }));
  }

  const filteredItems = useMemo(() => {
    const trimmedPersonFilterId = personFilterId.trim();
    if (trimmedPersonFilterId.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const confirmedPeople = item.asset.people ?? [];
      return (
        item.detection.matchedPersonId === trimmedPersonFilterId ||
        item.detection.autoMatchCandidatePersonId === trimmedPersonFilterId ||
        item.matchedPerson?.id === trimmedPersonFilterId ||
        item.suggestedPerson?.id === trimmedPersonFilterId ||
        confirmedPeople.some((person) => person.personId === trimmedPersonFilterId)
      );
    });
  }, [items, personFilterId]);

  const filteredItemIds = useMemo(() => filteredItems.map((item) => item.detection.id), [filteredItems]);
  const selectedDetectionIdSet = useMemo(() => new Set(selectedDetectionIds), [selectedDetectionIds]);
  const visibleSelectedCount = useMemo(
    () => filteredItemIds.filter((id) => selectedDetectionIdSet.has(id)).length,
    [filteredItemIds, selectedDetectionIdSet]
  );
  const currentItemIndex = filteredItems.findIndex((item) => item.detection.id === currentDetectionId);
  const currentItem = currentItemIndex >= 0 ? filteredItems[currentItemIndex] : filteredItems[0] ?? null;
  const recentPeople = useMemo(
    () =>
      recentPeopleIds
        .map((personId) => peopleOptions.find((person) => person.id === personId))
        .filter((person): person is { id: string; displayName: string } => Boolean(person)),
    [peopleOptions, recentPeopleIds]
  );

  useEffect(() => {
    setSelectedDetectionIds((current) => current.filter((id) => filteredItemIds.includes(id)));
  }, [filteredItemIds]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setCurrentDetectionId(null);
      return;
    }

    if (!currentDetectionId || !filteredItemIds.includes(currentDetectionId)) {
      setCurrentDetectionId(filteredItems[0]?.detection.id ?? null);
    }
  }, [currentDetectionId, filteredItemIds, filteredItems]);

  function focusDetectionCard(detectionId: string): void {
    setCurrentDetectionId(detectionId);
    const node = cardRefs.current[detectionId];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function focusRelativeItem(direction: -1 | 1): void {
    if (filteredItems.length === 0 || !currentItem) {
      return;
    }

    const currentIndex = filteredItems.findIndex((item) => item.detection.id === currentItem.detection.id);
    const nextIndex = Math.min(filteredItems.length - 1, Math.max(0, currentIndex + direction));
    const nextItem = filteredItems[nextIndex];
    if (nextItem) {
      focusDetectionCard(nextItem.detection.id);
    }
  }

  function advanceAfterAction(completedDetectionId: string): void {
    if (!autoAdvanceEnabled || filteredItems.length === 0) {
      return;
    }

    const currentIndexInFiltered = filteredItems.findIndex((item) => item.detection.id === completedDetectionId);
    const nextItem = filteredItems[currentIndexInFiltered + 1] ?? filteredItems[currentIndexInFiltered - 1] ?? null;
    if (nextItem) {
      setCurrentDetectionId(nextItem.detection.id);
    }
  }

  function queueAssignment(item: PeopleReviewQueueItem, personId: string): void {
    const personName = peopleOptions.find((p) => p.id === personId)?.displayName ?? personId;
    setPendingAssignments((current) => ({ ...current, [item.detection.id]: { personId, personName } }));
    rememberRecentPerson(personId);
    advanceAfterAction(item.detection.id);
  }

  function cancelQueuedAssignment(detectionId: string): void {
    setPendingAssignments((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });
  }

  async function applyPendingAssignments(): Promise<void> {
    const entries = Object.entries(pendingAssignments);
    if (entries.length === 0) {
      return;
    }

    setBusyDetectionId('__batch__');
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const results = await Promise.allSettled(
        entries.map(([detectionId, { personId }]) =>
          reviewFaceDetection(detectionId, {
            action: 'assign',
            personId,
            reviewer: 'people-review-ui'
          })
        )
      );

      const succeededCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      setPendingAssignments({});
      await loadPageData();

      if (failedCount === 0) {
        setNoticeMessage(`Assigned ${succeededCount} face${succeededCount === 1 ? '' : 's'}.`);
      } else {
        setNoticeMessage(
          `Assigned ${succeededCount} face${succeededCount === 1 ? '' : 's'}; ${failedCount} failed.`
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to apply assignments');
    } finally {
      setBusyDetectionId(null);
    }
  }

  function queueConfirmation(item: PeopleReviewQueueItem): void {
    const confirmPersonId =
      item.detection.autoMatchCandidatePersonId ?? item.detection.matchedPersonId ?? null;
    const personName =
      item.suggestedPerson?.displayName ?? item.matchedPerson?.displayName ?? 'Unknown';
    setPendingConfirmations((current) => ({
      ...current,
      [item.detection.id]: { confirmPersonId, personName }
    }));
    rememberRecentPerson(confirmPersonId);
    advanceAfterAction(item.detection.id);
  }

  function cancelQueuedConfirmation(detectionId: string): void {
    setPendingConfirmations((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });
  }

  async function applyPendingConfirmations(): Promise<void> {
    const entries = Object.entries(pendingConfirmations);
    if (entries.length === 0) {
      return;
    }

    setBusyDetectionId('__batch__');
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const results = await Promise.allSettled(
        entries.map(([detectionId, { confirmPersonId }]) =>
          reviewFaceDetection(detectionId, {
            action: 'confirm',
            ...(confirmPersonId ? { personId: confirmPersonId } : {}),
            reviewer: 'people-review-ui'
          })
        )
      );

      const succeededCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      setPendingConfirmations({});
      await loadPageData();

      if (failedCount === 0) {
        setNoticeMessage(`Confirmed ${succeededCount} face${succeededCount === 1 ? '' : 's'}.`);
      } else {
        setNoticeMessage(
          `Confirmed ${succeededCount} face${succeededCount === 1 ? '' : 's'}; ${failedCount} failed.`
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to apply confirmations');
    } finally {
      setBusyDetectionId(null);
    }
  }

  function queueIgnore(item: PeopleReviewQueueItem, ignoredReason: FaceDetectionIgnoredReason): void {
    setPendingIgnores((current) => ({ ...current, [item.detection.id]: { ignoredReason } }));
    advanceAfterAction(item.detection.id);
  }

  function cancelQueuedIgnore(detectionId: string): void {
    setPendingIgnores((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });
  }

  async function applyPendingIgnores(): Promise<void> {
    const entries = Object.entries(pendingIgnores);
    if (entries.length === 0) return;

    setBusyDetectionId('__batch__');
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const results = await Promise.allSettled(
        entries.map(([detectionId, { ignoredReason }]) =>
          reviewFaceDetection(detectionId, {
            action: 'ignore',
            ignoredReason,
            reviewer: 'people-review-ui'
          })
        )
      );

      const succeededCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      setPendingIgnores({});
      await loadPageData();

      if (failedCount === 0) {
        setNoticeMessage(`Ignored ${succeededCount} face${succeededCount === 1 ? '' : 's'}.`);
      } else {
        setNoticeMessage(
          `Ignored ${succeededCount} face${succeededCount === 1 ? '' : 's'}; ${failedCount} failed.`
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to apply ignores');
    } finally {
      setBusyDetectionId(null);
    }
  }

  async function runAction(
    item: PeopleReviewQueueItem,
    action:
      | { type: 'confirm' }
      | { type: 'reject' }
      | { type: 'assign'; personId: string }
      | { type: 'createAndAssign'; displayName: string }
      | { type: 'ignore'; ignoredReason: FaceDetectionIgnoredReason }
  ): Promise<boolean> {
    setBusyDetectionId(item.detection.id);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      if (action.type === 'confirm') {
        const confirmPersonId =
          item.detection.autoMatchCandidatePersonId ?? item.detection.matchedPersonId ?? null;
        await reviewFaceDetection(item.detection.id, {
          action: 'confirm',
          ...(confirmPersonId ? { personId: confirmPersonId } : {}),
          reviewer: 'people-review-ui'
        });
        rememberRecentPerson(confirmPersonId);
        if (assetIdFilter.trim().length > 0) {
          setSelectedStatuses((current) =>
            current.includes('confirmed') ? current : [...current, 'confirmed']
          );
        }
        setNoticeMessage(`Confirmed face ${item.detection.id}.`);
      } else if (action.type === 'reject') {
        await reviewFaceDetection(item.detection.id, {
          action: 'reject',
          reviewer: 'people-review-ui'
        });
        setNoticeMessage(`Rejected face ${item.detection.id}.`);
      } else if (action.type === 'assign') {
        await reviewFaceDetection(item.detection.id, {
          action: 'assign',
          personId: action.personId,
          reviewer: 'people-review-ui'
        });
        rememberRecentPerson(action.personId);
        setNoticeMessage(`Assigned face ${item.detection.id}.`);
      } else if (action.type === 'createAndAssign') {
        await reviewFaceDetection(item.detection.id, {
          action: 'createAndAssign',
          displayName: action.displayName,
          reviewer: 'people-review-ui'
        });
        updateDraft(item.detection.id, { newPersonName: '' });
        setNoticeMessage(`Created and assigned person for face ${item.detection.id}.`);
      } else {
        await reviewFaceDetection(item.detection.id, {
          action: 'ignore',
          ignoredReason: action.ignoredReason,
          reviewer: 'people-review-ui'
        });
        setNoticeMessage(`Ignored face ${item.detection.id}.`);
      }

      await loadPageData();
      advanceAfterAction(item.detection.id);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update face review');
      return false;
    } finally {
      setBusyDetectionId(null);
    }
  }

  async function handleEnroll(item: PeopleReviewQueueItem, personId: string): Promise<void> {
    setBusyDetectionId(item.detection.id);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await enrollPersonFromDetection(personId, {
        detectionId: item.detection.id
      });
      rememberRecentPerson(response.person.id);
      setNoticeMessage(
        `Added example face for ${response.person.displayName} from detection ${response.detection.id}.`
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to enroll person from detection');
    } finally {
      setBusyDetectionId(null);
    }
  }

  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const trimmedAssetIdFilter = assetIdFilter.trim();
  const trimmedPersonIdFilter = personIdFilter.trim();

  async function runBatchAction(action: 'confirm' | 'reject' | 'ignore'): Promise<void> {
    const selectedItems = filteredItems.filter((item) => selectedDetectionIdSet.has(item.detection.id));
    if (selectedItems.length === 0 || busyDetectionId) {
      return;
    }

    setBusyDetectionId('__batch__');
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const results = await Promise.allSettled(
        selectedItems.map((item) => {
          if (action === 'confirm') {
            const faceState = getFaceReviewActionState({
              detection: item.detection,
              review: item.review,
              matchedPerson: item.matchedPerson,
              suggestedPerson: item.suggestedPerson
            });
            if (!faceState.canConfirm) {
              return Promise.reject(new Error(`Face ${item.detection.id} is already confirmed or has no person to confirm`));
            }
            const confirmPersonId =
              item.detection.autoMatchCandidatePersonId ?? item.detection.matchedPersonId ?? null;
            if (!confirmPersonId) {
              return Promise.reject(new Error(`Face ${item.detection.id} has no person to confirm`));
            }
            rememberRecentPerson(confirmPersonId);
            return reviewFaceDetection(item.detection.id, {
              action: 'confirm',
              personId: confirmPersonId,
              reviewer: 'people-review-ui'
            });
          }

          if (action === 'reject') {
            return reviewFaceDetection(item.detection.id, {
              action: 'reject',
              reviewer: 'people-review-ui'
            });
          }

          const ignoredReason = getDraft(item.detection.id, item.detection.ignoredReason).ignoredReason;
          return reviewFaceDetection(item.detection.id, {
            action: 'ignore',
            ignoredReason,
            reviewer: 'people-review-ui'
          });
        })
      );

      const succeededCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - succeededCount;

      if (action === 'confirm' && trimmedAssetIdFilter.length > 0 && succeededCount > 0) {
        setSelectedStatuses((current) => (current.includes('confirmed') ? current : [...current, 'confirmed']));
      }

      if (succeededCount > 0) {
        setSelectedDetectionIds((current) =>
          current.filter((id) => !selectedItems.some((item) => item.detection.id === id))
        );
      }

      await loadPageData();

      if (failedCount === 0) {
        setNoticeMessage(
          `${action === 'confirm' ? 'Confirmed' : action === 'reject' ? 'Rejected' : 'Ignored'} ${succeededCount} selected face${succeededCount === 1 ? '' : 's'}.`
        );
      } else {
        setNoticeMessage(
          `${action === 'confirm' ? 'Confirmed' : action === 'reject' ? 'Rejected' : 'Ignored'} ${succeededCount} selected face${succeededCount === 1 ? '' : 's'}; ${failedCount} failed.`
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update selected face reviews');
    } finally {
      setBusyDetectionId(null);
    }
  }

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (loading || busyDetectionId || isEditableEventTarget(event.target)) {
        return;
      }

      if (filteredItems.length === 0 || !currentItem) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        focusRelativeItem(1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        focusRelativeItem(-1);
        return;
      }

      if (event.key === 'c' || event.key === 'C') {
        const faceState = getFaceReviewActionState({
          detection: currentItem.detection,
          review: currentItem.review,
          matchedPerson: currentItem.matchedPerson,
          suggestedPerson: currentItem.suggestedPerson
        });
        if (faceState.canConfirm) {
          event.preventDefault();
          queueConfirmation(currentItem);
        }
        return;
      }

      if (event.key === 'x' || event.key === 'X') {
        event.preventDefault();
        void runAction(currentItem, { type: 'reject' });
        return;
      }

      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        const draft = getDraft(currentItem.detection.id, currentItem.detection.ignoredReason);
        queueIgnore(currentItem, draft.ignoredReason);
        return;
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        assignSelectRefs.current[currentItem.detection.id]?.focus();
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        createInputRefs.current[currentItem.detection.id]?.focus();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [busyDetectionId, currentItem, filteredItems, loading]);

  return (
    <div style={pageStyle}>
      <div style={linkRowStyle}>
        <Link to="/" style={linkStyle}>
          Back to Library
        </Link>
        <Link to="/people/dev" style={linkStyle}>
          People Dev Harness
        </Link>
      </div>

      <section style={panelStyle}>
        <h1 style={{ margin: '0 0 10px', fontSize: '32px' }}>People Review</h1>
        <p style={{ margin: '0 0 14px', color: '#5b6673' }}>
          Minimal review workbench for persisted face detections and derived <code>mediaAsset.people</code>.
        </p>

        {trimmedAssetIdFilter ? (
          <div
            style={{
              ...panelStyle,
              marginBottom: '14px',
              padding: '10px 12px',
              backgroundColor: '#eef7fb',
              borderColor: '#bfd6e0',
              boxShadow: 'none'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#163246' }}>
              Filtered to asset {trimmedAssetIdFilter}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#566577' }}>
              Review actions here affect this asset only. Confirmed matches are what drive derived <code>mediaAsset.people</code>.
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to="/"
                style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Back to Library
              </Link>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setAssetIdFilter('')}
              >
                Clear Asset Filter
              </button>
            </div>
          </div>
        ) : null}

        {!trimmedAssetIdFilter && scopedAssetIdsState && scopedAssetIdsState.assetIds.length > 0 ? (
          <div
            style={{
              ...panelStyle,
              marginBottom: '14px',
              padding: '10px 12px',
              backgroundColor: '#eef7fb',
              borderColor: '#bfd6e0',
              boxShadow: 'none'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#163246' }}>
              {scopedAssetIdsState.scopeType} scope ({scopedAssetIdsState.assetIds.length} assets)
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#566577' }}>
              {scopedAssetIdsState.scopeLabel}. This queue is limited to the saved scope: {scopedAssetIdsState.scopeSourceLabel}.
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to="/"
                style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Back to Library
              </Link>
              <Link
                to="/people/review"
                style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Clear Scoped Filter
              </Link>
            </div>
          </div>
        ) : null}

        {!trimmedAssetIdFilter && !scopedAssetIdsState && trimmedPersonIdFilter ? (
          <div
            style={{
              ...panelStyle,
              marginBottom: '14px',
              padding: '10px 12px',
              backgroundColor: '#eef7fb',
              borderColor: '#bfd6e0',
              boxShadow: 'none'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#163246' }}>
              Filtered to person {trimmedPersonIdFilter}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#566577' }}>
              This queue is scoped to detections related to the selected person. Confirmed asset people remain distinct from unresolved review work.
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to={`/people/${encodeURIComponent(trimmedPersonIdFilter)}`}
                style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Back to Person
              </Link>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setPersonIdFilter('')}
              >
                Clear Person Filter
              </button>
            </div>
          </div>
        ) : null}

        <div style={controlsGridStyle}>
          <div>
            <span style={labelStyle}>Asset ID Filter</span>
            <input
              type="text"
              value={assetIdFilter}
              onChange={(event) => setAssetIdFilter(event.target.value)}
              style={{ ...inputStyle, width: '100%' }}
              placeholder="Optional asset id"
            />
          </div>
          <div>
            <span style={labelStyle}>Person ID Filter</span>
            <select
              value={personIdFilter}
              onChange={(event) => setPersonIdFilter(event.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="">Any related person</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as PeopleReviewQueueSort)}
              style={{ ...inputStyle, width: '100%' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Person Filter</span>
            <select
              value={personFilterId}
              onChange={(event) => setPersonFilterId(event.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="">Any person state</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Queue Size</span>
            <div style={{ ...inputStyle, backgroundColor: '#f7f9fb' }}>{filteredItems.length} loaded</div>
          </div>
          <div>
            <span style={labelStyle}>Actions</span>
            <div style={inlineRowStyle}>
              <button type="button" style={compactButtonStyle} onClick={() => void loadPageData()}>
                Refresh
              </button>
              <button
                type="button"
                style={filteredItems.length === 0 || currentItemIndex <= 0 ? disabledButtonStyle : compactButtonStyle}
                disabled={filteredItems.length === 0 || currentItemIndex <= 0}
                onClick={() => focusRelativeItem(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                style={
                  filteredItems.length === 0 || currentItemIndex < 0 || currentItemIndex >= filteredItems.length - 1
                    ? disabledButtonStyle
                    : compactButtonStyle
                }
                disabled={filteredItems.length === 0 || currentItemIndex < 0 || currentItemIndex >= filteredItems.length - 1}
                onClick={() => focusRelativeItem(1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...metaGridStyle, marginTop: '14px', marginBottom: '14px' }}>
          <div style={metaItemStyle}>
            <span style={labelStyle}>Current Item</span>
            {currentItem ? `${currentItemIndex + 1} of ${filteredItems.length}` : 'None'}
          </div>
          <div style={metaItemStyle}>
            <span style={labelStyle}>Selection</span>
            {visibleSelectedCount} selected
          </div>
          <div style={metaItemStyle}>
            <span style={labelStyle}>Auto Advance</span>
            <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={autoAdvanceEnabled}
                onChange={(event) => setAutoAdvanceEnabled(event.target.checked)}
              />
              Move to next face after action
            </label>
          </div>
          <div style={metaItemStyle}>
            <span style={labelStyle}>Shortcuts</span>
            <span>J/K or arrows next/previous, C confirm, X reject, I ignore, A assign, N create</span>
          </div>
        </div>

        {visibleSelectedCount > 0 ? (
          <div
            style={{
              ...panelStyle,
              marginTop: '14px',
              marginBottom: '14px',
              padding: '12px',
              backgroundColor: '#f6fafb',
              borderColor: '#bfd6e0',
              boxShadow: 'none'
            }}
          >
            <div style={{ ...inlineRowStyle, justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#163246' }}>
                {visibleSelectedCount} selected in current queue view
              </div>
              <div style={inlineRowStyle}>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void runBatchAction('confirm')}
                >
                  Confirm Selected
                </button>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void runBatchAction('reject')}
                >
                  Reject Selected
                </button>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void runBatchAction('ignore')}
                >
                  Ignore Selected
                </button>
                <button
                  type="button"
                  style={compactButtonStyle}
                  onClick={() => setSelectedDetectionIds([])}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {Object.keys(pendingAssignments).length > 0 ? (
          <div
            style={{
              ...panelStyle,
              marginTop: '14px',
              marginBottom: '14px',
              padding: '12px',
              backgroundColor: '#fffdf0',
              borderColor: '#d4a72c',
              boxShadow: 'none'
            }}
          >
            <div style={{ ...inlineRowStyle, justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#7a4f00' }}>
                {Object.keys(pendingAssignments).length} assignment{Object.keys(pendingAssignments).length === 1 ? '' : 's'} queued
              </div>
              <div style={inlineRowStyle}>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : applyButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void applyPendingAssignments()}
                >
                  Apply Assignments ({Object.keys(pendingAssignments).length})
                </button>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => setPendingAssignments({})}
                >
                  Clear Queue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {Object.keys(pendingConfirmations).length > 0 ? (
          <div
            style={{
              ...panelStyle,
              marginTop: '14px',
              marginBottom: '14px',
              padding: '12px',
              backgroundColor: '#f0faf5',
              borderColor: '#2e9e68',
              boxShadow: 'none'
            }}
          >
            <div style={{ ...inlineRowStyle, justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#15603a' }}>
                {Object.keys(pendingConfirmations).length} confirmation{Object.keys(pendingConfirmations).length === 1 ? '' : 's'} queued
              </div>
              <div style={inlineRowStyle}>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : applyButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void applyPendingConfirmations()}
                >
                  Apply Confirmations ({Object.keys(pendingConfirmations).length})
                </button>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => setPendingConfirmations({})}
                >
                  Clear Queue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {Object.keys(pendingIgnores).length > 0 ? (
          <div
            style={{
              ...panelStyle,
              marginTop: '14px',
              marginBottom: '14px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderColor: '#64748b',
              boxShadow: 'none'
            }}
          >
            <div style={{ ...inlineRowStyle, justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                {Object.keys(pendingIgnores).length} ignore{Object.keys(pendingIgnores).length === 1 ? '' : 's'} queued
              </div>
              <div style={inlineRowStyle}>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : applyButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => void applyPendingIgnores()}
                >
                  Apply Ignores ({Object.keys(pendingIgnores).length})
                </button>
                <button
                  type="button"
                  style={busyDetectionId ? disabledButtonStyle : compactButtonStyle}
                  disabled={Boolean(busyDetectionId)}
                  onClick={() => setPendingIgnores({})}
                >
                  Clear Queue
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div style={{ ...metaGridStyle, marginTop: '14px', marginBottom: 0 }}>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Active Engine</span>
              {summary.config.engine}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Pipeline Version</span>
              {summary.config.pipelineVersion}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Thresholds</span>
              Review {summary.config.thresholds.reviewThreshold.toFixed(2)} / Auto {summary.config.thresholds.autoMatchThreshold.toFixed(2)}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Detection Filters</span>
              Conf {summary.config.thresholds.minDetectionConfidence.toFixed(2)} / Area {summary.config.thresholds.minFaceAreaPercent.toFixed(1)}%
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>People / Detections / Reviews</span>
              {summary.totals.peopleCount} / {summary.totals.detectionsCount} / {summary.totals.reviewsCount}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Review Decisions</span>
              Pending {summary.reviewDecisionCounts.pending}, Confirmed {summary.reviewDecisionCounts.confirmed}, Rejected {summary.reviewDecisionCounts.rejected}
            </div>
          </div>
        ) : null}

        <div style={{ ...badgeRowStyle, marginTop: '14px' }}>
          {statusOptions.map((status) => {
            const selected = selectedStatusSet.has(status.value);
            return (
              <button
                key={status.value}
                type="button"
                style={{
                  ...badgeStyle,
                  cursor: 'pointer',
                  borderColor: selected ? '#0f5f73' : '#d5dbe3',
                  backgroundColor: selected ? '#e8f5f8' : '#f8fafc',
                  color: selected ? '#0d4f60' : '#223447'
                }}
                onClick={() =>
                  setSelectedStatuses((current) =>
                    current.includes(status.value)
                      ? current.length === 1
                        ? current
                        : current.filter((value) => value !== status.value)
                      : [...current, status.value]
                  )
                }
              >
                {status.label}: {counts[status.value]}
              </button>
            );
          })}
        </div>

        {errorMessage ? <p style={{ color: '#a32222', marginBottom: 0 }}>{errorMessage}</p> : null}
        {noticeMessage ? <p style={{ color: '#15603a', marginBottom: 0 }}>{noticeMessage}</p> : null}
      </section>

      {loading ? <section style={panelStyle}>Loading people review queue...</section> : null}

      {!loading && items.length === 0 ? (
        <section style={panelStyle}>
          {trimmedAssetIdFilter
            ? `No face detections matched the current filters for asset ${trimmedAssetIdFilter}.`
            : 'No face detections matched the current filters.'}
        </section>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div style={{ ...inlineRowStyle, marginBottom: '12px' }}>
          <button
            type="button"
            style={compactButtonStyle}
            onClick={() => setSelectedDetectionIds(filteredItemIds)}
          >
            Select All Visible
          </button>
          <button
            type="button"
            style={compactButtonStyle}
            onClick={() => setSelectedDetectionIds([])}
          >
            Clear Selection
          </button>
        </div>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <section style={panelStyle}>No face detections matched the current person filter.</section>
      ) : null}

      {!loading
        ? filteredItems.map((item) => {
            const draft = getDraft(item.detection.id, item.detection.ignoredReason);
            const isBusy = busyDetectionId === item.detection.id || busyDetectionId === '__batch__';
            const faceState = getFaceReviewActionState({
              detection: item.detection,
              review: item.review,
              matchedPerson: item.matchedPerson,
              suggestedPerson: item.suggestedPerson
            });
            const enrollPersonId = item.detection.matchedPersonId ?? item.detection.autoMatchCandidatePersonId ?? '';
            const enrollPersonName = item.matchedPerson?.displayName ?? item.suggestedPerson?.displayName ?? '';
            const exampleActionState = getExampleActionState({
              faceState,
              detection: item.detection,
              assignedPersonName: enrollPersonName,
              examples: item.examples,
              busy: isBusy
            });
            const confirmActionHint = getConfirmActionHint(item);
            const isCurrent = currentItem?.detection.id === item.detection.id;
            const isSelected = selectedDetectionIdSet.has(item.detection.id);
            const pendingAssignment = pendingAssignments[item.detection.id] ?? null;
            const pendingConfirmation = pendingConfirmations[item.detection.id] ?? null;
            const pendingIgnore = pendingIgnores[item.detection.id] ?? null;
            const selectedPersonOption = draft.selectedPersonId
              ? peopleOptions.find((person) => person.id === draft.selectedPersonId) ?? null
              : null;
            const selectedPersonAssignmentState = selectedPersonOption
              ? getAssignmentActionState({ faceState, person: selectedPersonOption, busy: isBusy })
              : null;

            return (
              <section
                key={item.detection.id}
                ref={(node) => {
                  cardRefs.current[item.detection.id] = node;
                }}
                style={isCurrent ? currentCardStyle : cardStyle}
                onClick={() => setCurrentDetectionId(item.detection.id)}
              >
                <div>
                  <div style={previewColumnStyle}>
                    <div>
                      <div style={previewBoxStyle}>
                        {item.asset.id ? (
                          <img
                            src={
                              item.detection.previewPath || item.detection.cropPath
                                ? getFaceDetectionPreviewUrl(item.detection.id)
                                : getThumbnailMediaUrl(item.asset.id)
                            }
                            alt={item.asset.filename}
                            style={previewImageStyle}
                          />
                        ) : (
                          <div style={placeholderStyle}>No asset preview</div>
                        )}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#566577' }}>
                        {item.detection.previewPath || item.detection.cropPath
                          ? 'Detected face crop preview'
                          : 'Source asset thumbnail'}
                      </div>
                    </div>
                    {item.detection.previewPath || item.detection.cropPath ? (
                      <div>
                        <div style={previewBoxStyle}>
                          <img
                            src={getThumbnailMediaUrl(item.asset.id)}
                            alt={`${item.asset.filename} source thumbnail`}
                            style={previewImageStyle}
                          />
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#566577' }}>
                          Source asset thumbnail
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div style={badgeRowStyle}>
                    <label style={{ ...badgeStyle, display: 'inline-flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) =>
                          setSelectedDetectionIds((current) =>
                            event.target.checked
                              ? [...current, item.detection.id]
                              : current.filter((id) => id !== item.detection.id)
                          )
                        }
                        onClick={(event) => event.stopPropagation()}
                      />
                      Select
                    </label>
                    <span style={isCurrent ? currentBadgeStyle : badgeStyle}>Status: {item.detection.matchStatus}</span>
                    {isCurrent ? <span style={currentBadgeStyle}>Current</span> : null}
                    <span style={badgeStyle}>Face #{item.detection.faceIndex}</span>
                    <span style={badgeStyle}>Asset: {item.asset.id}</span>
                    {pendingAssignment ? (
                      <span style={queuedBadgeStyle}>
                        Queued → {pendingAssignment.personName}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelQueuedAssignment(item.detection.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: '#7a4f00', fontWeight: 700, fontSize: '13px' }}
                          title="Cancel queued assignment"
                        >
                          ✕
                        </button>
                      </span>
                    ) : null}
                    {pendingConfirmation ? (
                      <span style={queuedConfirmBadgeStyle}>
                        Queued → Confirm {pendingConfirmation.personName}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelQueuedConfirmation(item.detection.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: '#15603a', fontWeight: 700, fontSize: '13px' }}
                          title="Cancel queued confirmation"
                        >
                          ✕
                        </button>
                      </span>
                    ) : null}
                    {pendingIgnore ? (
                      <span style={queuedIgnoreBadgeStyle}>
                        Queued → Ignore ({pendingIgnore.ignoredReason})
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelQueuedIgnore(item.detection.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: '#334155', fontWeight: 700, fontSize: '13px' }}
                          title="Cancel queued ignore"
                        >
                          ✕
                        </button>
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                    {getMatchStatusSummary(item)}
                  </div>

                  <div style={metaGridStyle}>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Filename</span>
                      {item.asset.filename}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Archive Path</span>
                      {item.asset.originalArchivePath}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Captured</span>
                      {formatDateTime(item.asset.captureDateTime)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Detection Confidence</span>
                      {formatConfidence(item.detection.detectionConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Suggested Person</span>
                      {item.suggestedPerson?.displayName ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Suggested Confidence</span>
                      {formatConfidence(item.detection.autoMatchCandidateConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Assigned Person</span>
                      {item.matchedPerson?.displayName ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Ignored Reason</span>
                      {item.detection.ignoredReason ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Engine</span>
                      {[item.detection.engine, item.detection.engineVersion].filter(Boolean).join(' / ')}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Pipeline Version</span>
                      {item.detection.pipelineVersion}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Review Decision</span>
                      {item.review?.decision ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Derived Asset People</span>
                      {formatPeopleList(item.asset.people ?? [])}
                    </div>
                  </div>

                  <div style={actionsSectionStyle}>
                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={isBusy || !faceState.canConfirm ? disabledButtonStyle : primaryButtonStyle}
                        disabled={isBusy || !faceState.canConfirm}
                        onClick={() => queueConfirmation(item)}
                        title={faceState.isPassiveConfirmed ? undefined : confirmActionHint ?? undefined}
                      >
                        {faceState.label}
                      </button>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : destructiveButtonStyle}
                        disabled={isBusy}
                        onClick={() => void runAction(item, { type: 'reject' })}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy}
                        onClick={() => focusDetectionCard(item.detection.id)}
                      >
                        Focus
                      </button>
                    </div>
                    {confirmActionHint ? (
                      <div style={{ fontSize: '12px', color: '#6a4d00' }}>{confirmActionHint}</div>
                    ) : null}

                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={exampleActionState.canAddAssignedPersonAsExample ? buttonStyle : disabledButtonStyle}
                        disabled={!exampleActionState.canAddAssignedPersonAsExample}
                        onClick={() => void handleEnroll(item, enrollPersonId)}
                      >
                        {isBusy && !exampleActionState.alreadyExampleForAssignedPerson && enrollPersonName
                          ? `Adding ${enrollPersonName} As Example...`
                          : exampleActionState.label}
                      </button>
                    </div>

                    {recentPeople.length > 0 ? (
                      <div style={inlineRowStyle}>
                        {recentPeople.map((person) => {
                          const assignmentState = getAssignmentActionState({ faceState, person, busy: isBusy });

                          return (
                            <button
                              key={person.id}
                              type="button"
                              style={assignmentState.disabled ? disabledButtonStyle : compactButtonStyle}
                              disabled={assignmentState.disabled}
                              onClick={() => {
                                updateDraft(item.detection.id, { selectedPersonId: person.id });
                                queueAssignment(item, person.id);
                              }}
                            >
                              {assignmentState.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    <div style={inlineRowStyle}>
                      <select
                        ref={(node) => {
                          assignSelectRefs.current[item.detection.id] = node;
                        }}
                        value={draft.selectedPersonId}
                        onChange={(event) => updateDraft(item.detection.id, { selectedPersonId: event.target.value })}
                        style={{ ...inputStyle, minWidth: '240px' }}
                        disabled={isBusy}
                      >
                        <option value="">Select existing person</option>
                        {peopleOptions.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={
                          isBusy ||
                            draft.selectedPersonId.length === 0 ||
                            selectedPersonAssignmentState?.isAlreadyAssigned
                            ? disabledButtonStyle
                            : buttonStyle
                        }
                        disabled={
                          isBusy ||
                          draft.selectedPersonId.length === 0 ||
                          selectedPersonAssignmentState?.isAlreadyAssigned
                        }
                        onClick={() => queueAssignment(item, draft.selectedPersonId)}
                      >
                        {selectedPersonAssignmentState?.isAlreadyAssigned ? 'Already Assigned' : 'Queue Assignment'}
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <input
                        ref={(node) => {
                          createInputRefs.current[item.detection.id] = node;
                        }}
                        type="text"
                        value={draft.newPersonName}
                        onChange={(event) => updateDraft(item.detection.id, { newPersonName: event.target.value })}
                        style={{ ...inputStyle, minWidth: '220px' }}
                        placeholder="New person display name"
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        style={isBusy || draft.newPersonName.trim().length === 0 ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy || draft.newPersonName.trim().length === 0}
                        onClick={() =>
                          void runAction(item, {
                            type: 'createAndAssign',
                            displayName: draft.newPersonName.trim()
                          })
                        }
                      >
                        Create + Assign
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <select
                        value={draft.ignoredReason}
                        onChange={(event) =>
                          updateDraft(item.detection.id, {
                            ignoredReason: event.target.value as FaceDetectionIgnoredReason
                          })
                        }
                        style={{ ...inputStyle, minWidth: '220px' }}
                        disabled={isBusy}
                      >
                        {ignoredReasonOptions.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy}
                        onClick={() => queueIgnore(item, draft.ignoredReason)}
                      >
                        Queue Ignore
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}
