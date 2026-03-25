import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type {
  FaceDetectionIgnoredReason,
  FaceDetectionMatchStatus,
  Person
} from '@tedography/domain';
import type {
  ListAssetFaceDetectionsResponse,
  PeopleReviewQueueItem,
  ProcessPeopleAssetResponse
} from '@tedography/shared';
import {
  createPerson,
  enrollPersonFromDetection,
  getPeoplePipelineAssetState,
  listPeople,
  listPeoplePipelineRecentAssets,
  listPeopleReviewQueue,
  processPeopleAsset,
  reviewFaceDetection
} from '../../api/peoplePipelineApi';
import { getFaceDetectionPreviewUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';

const samplePeople = ['Ted', 'Lori', 'Joel', 'Morgan', 'Annie'];
const allStatuses: FaceDetectionMatchStatus[] = [
  'suggested',
  'autoMatched',
  'unmatched',
  'confirmed',
  'rejected',
  'ignored'
];
const ignoredReasonOptions: FaceDetectionIgnoredReason[] = [
  'user-ignored',
  'too-small',
  'too-low-quality',
  'background-face',
  'non-person-face',
  'other'
];

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '0 auto',
  padding: '16px',
  maxWidth: '1500px',
  backgroundColor: '#eef2f6',
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

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 10px',
  fontSize: '22px'
};

const controlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
  marginTop: '12px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
  gap: '14px',
  alignItems: 'start'
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  maxHeight: '320px',
  overflow: 'auto'
};

const smallCardStyle: CSSProperties = {
  border: '1px solid #d7dce2',
  borderRadius: '12px',
  padding: '10px',
  backgroundColor: '#fafbfd'
};

const detectionCardStyle: CSSProperties = {
  ...panelStyle,
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr)',
  gap: '16px'
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  borderRadius: '12px',
  backgroundColor: '#dbe2ea',
  border: '1px solid #d7dce2'
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

const inlineRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center'
};

type DraftState = {
  selectedPersonId: string;
  newPersonName: string;
  ignoredReason: FaceDetectionIgnoredReason;
};

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

function formatPeople(items: Array<{ displayName: string }>): string {
  return items.length > 0 ? items.map((item) => item.displayName).join(', ') : 'None';
}

function getConfirmActionLabel(item: PeopleReviewQueueItem): string {
  const suggestedPersonName = item.suggestedPerson?.displayName?.trim() ?? '';
  const assignedPersonName = item.matchedPerson?.displayName?.trim() ?? '';

  if (suggestedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return `Confirm Suggested (${suggestedPersonName})`;
  }

  if (assignedPersonName.length > 0) {
    return `Confirm ${assignedPersonName}`;
  }

  return 'Confirm';
}

function getConfirmActionHint(item: PeopleReviewQueueItem): string | null {
  const suggestedPersonName = item.suggestedPerson?.displayName?.trim() ?? '';
  const assignedPersonName = item.matchedPerson?.displayName?.trim() ?? '';

  if (suggestedPersonName.length > 0 && assignedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return `This confirms the suggested person (${suggestedPersonName}), not the currently assigned person (${assignedPersonName}).`;
  }

  return null;
}

export function PeopleDevPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [recentAssets, setRecentAssets] = useState<
    Array<{
      id: string;
      filename: string;
      originalArchivePath: string;
      captureDateTime?: string | null;
      importedAt: string;
      photoState: string;
      people?: Array<{ personId: string; displayName: string }>;
    }>
  >([]);
  const [queueItems, setQueueItems] = useState<PeopleReviewQueueItem[]>([]);
  const [counts, setCounts] = useState<Record<FaceDetectionMatchStatus, number>>({
    unmatched: 0,
    suggested: 0,
    autoMatched: 0,
    confirmed: 0,
    rejected: 0,
    ignored: 0
  });
  const [selectedStatuses, setSelectedStatuses] = useState<FaceDetectionMatchStatus[]>(allStatuses);
  const [createPersonName, setCreatePersonName] = useState('');
  const [processAssetId, setProcessAssetId] = useState('');
  const [filterAssetId, setFilterAssetId] = useState('');
  const [lastProcessResult, setLastProcessResult] = useState<ProcessPeopleAssetResponse | null>(null);
  const [lastAssetState, setLastAssetState] = useState<ListAssetFaceDetectionsResponse | null>(null);
  const [draftByDetectionId, setDraftByDetectionId] = useState<Record<string, DraftState>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const peopleOptions = useMemo(
    () => people.map((person) => ({ id: person.id, displayName: person.displayName })),
    [people]
  );
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);

  async function refreshAll() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [peopleResponse, queueResponse, recentAssetsResponse] = await Promise.all([
        listPeople(),
        listPeopleReviewQueue({
          statuses: selectedStatuses,
          ...(filterAssetId.trim() ? { assetId: filterAssetId.trim() } : {}),
          limit: 250
        }),
        listPeoplePipelineRecentAssets({ limit: 18 })
      ]);

      setPeople(peopleResponse.items);
      setQueueItems(queueResponse.items);
      setCounts(queueResponse.counts);
      setRecentAssets(recentAssetsResponse.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load people dev harness data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, [selectedStatuses, filterAssetId]);

  function getDraft(detectionId: string): DraftState {
    return (
      draftByDetectionId[detectionId] ?? {
        selectedPersonId: '',
        newPersonName: '',
        ignoredReason: 'user-ignored'
      }
    );
  }

  function updateDraft(detectionId: string, patch: Partial<DraftState>) {
    setDraftByDetectionId((current) => ({
      ...current,
      [detectionId]: {
        ...getDraft(detectionId),
        ...patch
      }
    }));
  }

  async function handleCreatePerson(name: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }

    setBusyKey('create-person');
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      const response = await createPerson({ displayName: trimmed });
      setCreatePersonName('');
      setNoticeMessage(`Created person ${response.item.displayName}.`);
      await refreshAll();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create person');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateSamplePeople() {
    setBusyKey('create-samples');
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      const existing = new Set(people.map((person) => person.displayName.toLowerCase()));
      for (const name of samplePeople) {
        if (existing.has(name.toLowerCase())) {
          continue;
        }

        await createPerson({ displayName: name });
      }

      setNoticeMessage('Created any missing sample people.');
      await refreshAll();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create sample people');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleProcessAsset(assetId: string) {
    const trimmed = assetId.trim();
    if (trimmed.length === 0) {
      return;
    }

    setBusyKey(`process-${trimmed}`);
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      const processResponse = await processPeopleAsset(trimmed);
      const assetStateResponse = await getPeoplePipelineAssetState(processResponse.assetId).catch(() => null);
      setProcessAssetId(trimmed);
      setLastProcessResult(processResponse);
      setLastAssetState(assetStateResponse);
      setNoticeMessage(
        processResponse.processed
          ? `Processed asset ${trimmed}.`
          : `Skipped asset ${trimmed}: ${processResponse.skippedReason ?? 'unknown reason'}`
      );
      await refreshAll();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process asset');
    } finally {
      setBusyKey(null);
    }
  }

  async function runReviewAction(
    item: PeopleReviewQueueItem,
    action:
      | { type: 'confirm' }
      | { type: 'reject' }
      | { type: 'assign'; personId: string }
      | { type: 'createAndAssign'; displayName: string }
      | { type: 'ignore'; ignoredReason: FaceDetectionIgnoredReason }
  ) {
    setBusyKey(item.detection.id);
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      if (action.type === 'confirm') {
        const confirmPersonId =
          item.detection.autoMatchCandidatePersonId ?? item.detection.matchedPersonId ?? null;
        await reviewFaceDetection(item.detection.id, {
          action: 'confirm',
          ...(confirmPersonId ? { personId: confirmPersonId } : {}),
          reviewer: 'people-dev-ui'
        });
        setNoticeMessage(`Confirmed ${item.detection.id}.`);
      } else if (action.type === 'reject') {
        await reviewFaceDetection(item.detection.id, {
          action: 'reject',
          reviewer: 'people-dev-ui'
        });
        setNoticeMessage(`Rejected ${item.detection.id}.`);
      } else if (action.type === 'assign') {
        await reviewFaceDetection(item.detection.id, {
          action: 'assign',
          personId: action.personId,
          reviewer: 'people-dev-ui'
        });
        setNoticeMessage(`Assigned ${item.detection.id}.`);
      } else if (action.type === 'createAndAssign') {
        await reviewFaceDetection(item.detection.id, {
          action: 'createAndAssign',
          displayName: action.displayName,
          reviewer: 'people-dev-ui'
        });
        setNoticeMessage(`Created and assigned a person for ${item.detection.id}.`);
      } else {
        await reviewFaceDetection(item.detection.id, {
          action: 'ignore',
          ignoredReason: action.ignoredReason,
          reviewer: 'people-dev-ui'
        });
        setNoticeMessage(`Ignored ${item.detection.id}.`);
      }

      const assetState = await getPeoplePipelineAssetState(item.asset.id).catch(() => null);
      setLastAssetState(assetState);
      await refreshAll();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to review detection');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleEnroll(item: PeopleReviewQueueItem, personId: string) {
    setBusyKey(`enroll-${item.detection.id}`);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await enrollPersonFromDetection(personId, {
        detectionId: item.detection.id
      });
      setNoticeMessage(
        `Enrolled ${response.person.displayName} from detection ${response.detection.id} using engine identity ${response.subjectKey}.`
      );
      const assetState = await getPeoplePipelineAssetState(item.asset.id).catch(() => null);
      setLastAssetState(assetState);
      await refreshAll();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to enroll person from detection');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={linkRowStyle}>
        <Link to="/" style={linkStyle}>
          Back to Library
        </Link>
        <Link to="/people/review" style={linkStyle}>
          People Review
        </Link>
      </div>

      <section style={panelStyle}>
        <h1 style={{ margin: '0 0 8px', fontSize: '32px' }}>People Pipeline Dev Harness</h1>
        <p style={{ margin: 0, color: '#5b6673' }}>
          Internal dev/test page for seeding sample people, processing assets, forcing face-review states, and
          verifying derived <code>mediaAsset.people</code>.
        </p>
        {errorMessage ? <p style={{ color: '#a32222', marginBottom: 0 }}>{errorMessage}</p> : null}
        {noticeMessage ? <p style={{ color: '#15603a', marginBottom: 0 }}>{noticeMessage}</p> : null}
      </section>

      <div style={twoColumnStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Sample People / Create People</h2>
          <div style={controlsGridStyle}>
            <div>
              <span style={labelStyle}>New Person Name</span>
              <input
                type="text"
                value={createPersonName}
                onChange={(event) => setCreatePersonName(event.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                placeholder="Display name"
              />
            </div>
            <div style={inlineRowStyle}>
              <button
                type="button"
                style={busyKey === 'create-person' || createPersonName.trim().length === 0 ? disabledButtonStyle : primaryButtonStyle}
                disabled={busyKey === 'create-person' || createPersonName.trim().length === 0}
                onClick={() => void handleCreatePerson(createPersonName)}
              >
                Create Person
              </button>
              <button
                type="button"
                style={busyKey === 'create-samples' ? disabledButtonStyle : buttonStyle}
                disabled={busyKey === 'create-samples'}
                onClick={() => void handleCreateSamplePeople()}
              >
                Create Sample People
              </button>
            </div>
          </div>

          <div style={{ ...listStyle, marginTop: '12px' }}>
            {people.map((person) => (
              <div key={person.id} style={smallCardStyle}>
                <strong>{person.displayName}</strong>
                <div style={{ fontSize: '12px', color: '#586676' }}>{person.id}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Process Assets</h2>
          <div style={controlsGridStyle}>
            <div>
              <span style={labelStyle}>Asset ID</span>
              <input
                type="text"
                value={processAssetId}
                onChange={(event) => setProcessAssetId(event.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                placeholder="Paste asset id"
              />
            </div>
            <div style={inlineRowStyle}>
              <button
                type="button"
                style={processAssetId.trim().length === 0 ? disabledButtonStyle : primaryButtonStyle}
                disabled={processAssetId.trim().length === 0}
                onClick={() => void handleProcessAsset(processAssetId)}
              >
                Process Asset
              </button>
              <button type="button" style={buttonStyle} onClick={() => void refreshAll()}>
                Refresh Harness
              </button>
            </div>
          </div>

          {lastProcessResult ? (
            <div style={{ ...smallCardStyle, marginTop: '12px' }}>
              <strong>Last Process Result</strong>
              <div style={{ fontSize: '12px', color: '#586676', marginTop: '4px' }}>
                Asset: {lastProcessResult.assetId}
              </div>
              <div style={{ fontSize: '12px', color: '#586676' }}>
                Processed: {String(lastProcessResult.processed)} | Detections: {lastProcessResult.detectionsCreated}
              </div>
              <div style={{ fontSize: '12px', color: '#586676' }}>
                Engine: {lastProcessResult.engine} | Pipeline: {lastProcessResult.pipelineVersion}
              </div>
              {lastProcessResult.skippedReason ? (
                <div style={{ fontSize: '12px', color: '#8a2a2a' }}>Skipped: {lastProcessResult.skippedReason}</div>
              ) : null}
            </div>
          ) : null}

          <div style={{ ...listStyle, marginTop: '12px' }}>
            {recentAssets.map((asset) => (
              <div key={asset.id} style={smallCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{asset.filename}</strong>
                    <div style={{ fontSize: '12px', color: '#586676' }}>{asset.id}</div>
                    <div style={{ fontSize: '12px', color: '#586676' }}>{asset.originalArchivePath}</div>
                    <div style={{ fontSize: '12px', color: '#586676' }}>
                      Imported: {formatDateTime(asset.importedAt)} | Derived People: {formatPeople(asset.people ?? [])}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={busyKey === `process-${asset.id}` ? disabledButtonStyle : buttonStyle}
                    disabled={busyKey === `process-${asset.id}`}
                    onClick={() => void handleProcessAsset(asset.id)}
                  >
                    Process
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Detection Browser</h2>
        <div style={controlsGridStyle}>
          <div>
            <span style={labelStyle}>Filter Asset ID</span>
            <input
              type="text"
              value={filterAssetId}
              onChange={(event) => setFilterAssetId(event.target.value)}
              style={{ ...inputStyle, width: '100%' }}
              placeholder="Optional asset id"
            />
          </div>
          <div>
            <span style={labelStyle}>Loaded Detections</span>
            <div style={{ ...inputStyle, backgroundColor: '#f7f9fb' }}>
              {loading ? 'Loading...' : `${queueItems.length} detections`}
            </div>
          </div>
        </div>

        <div style={badgeRowStyle}>
          {allStatuses.map((status) => (
            <button
              key={status}
              type="button"
              style={{
                ...badgeStyle,
                cursor: 'pointer',
                borderColor: selectedStatusSet.has(status) ? '#0f5f73' : '#d5dbe3',
                backgroundColor: selectedStatusSet.has(status) ? '#e8f5f8' : '#f8fafc'
              }}
              onClick={() =>
                setSelectedStatuses((current) =>
                  current.includes(status)
                    ? current.length === 1
                      ? current
                      : current.filter((value) => value !== status)
                    : [...current, status]
                )
              }
            >
              {status}: {counts[status]}
            </button>
          ))}
        </div>
      </section>

      {lastAssetState ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Last Asset State</h2>
          <div style={{ fontSize: '13px', color: '#44515d', marginBottom: '8px' }}>
            Asset: {lastAssetState.assetId}
          </div>
          <div style={{ fontSize: '13px', color: '#44515d', marginBottom: '8px' }}>
            Derived People: {formatPeople(lastAssetState.people ?? [])}
          </div>
          <div style={{ fontSize: '13px', color: '#44515d' }}>
            Detections: {lastAssetState.detections.length} | Reviews: {lastAssetState.reviews.length}
          </div>
        </section>
      ) : null}

      {!loading && queueItems.length === 0 ? (
        <section style={panelStyle}>No detections matched the current dev-harness filters.</section>
      ) : null}

      {!loading
        ? queueItems.map((item) => {
            const draft = getDraft(item.detection.id);
            const isBusy = busyKey === item.detection.id;
            const enrollmentBusy = busyKey === `enroll-${item.detection.id}`;
            const canConfirm =
              typeof item.detection.autoMatchCandidatePersonId === 'string' ||
              typeof item.detection.matchedPersonId === 'string';
            const confirmActionLabel = getConfirmActionLabel(item);
            const confirmActionHint = getConfirmActionHint(item);
            const enrollPersonId = item.matchedPerson?.id ?? (draft.selectedPersonId || '');

            return (
              <section key={item.detection.id} style={detectionCardStyle}>
                <div>
                  <img
                    src={
                      item.detection.previewPath || item.detection.cropPath
                        ? getFaceDetectionPreviewUrl(item.detection.id)
                        : getThumbnailMediaUrl(item.asset.id)
                    }
                    alt={item.asset.filename}
                    style={previewImageStyle}
                  />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#586676' }}>
                    {item.detection.previewPath || item.detection.cropPath
                      ? 'Detected face crop preview'
                      : 'Source asset thumbnail'}
                  </div>
                </div>
                <div>
                  <div style={badgeRowStyle}>
                    <span style={badgeStyle}>Status: {item.detection.matchStatus}</span>
                    <span style={badgeStyle}>Detection: {item.detection.id}</span>
                    <span style={badgeStyle}>Asset: {item.asset.id}</span>
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
                      <span style={labelStyle}>Suggested Person</span>
                      {item.suggestedPerson?.displayName ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Assigned Person</span>
                      {item.matchedPerson?.displayName ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Suggested Confidence</span>
                      {formatConfidence(item.detection.autoMatchCandidateConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Match Confidence</span>
                      {formatConfidence(item.detection.matchConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Ignored Reason</span>
                      {item.detection.ignoredReason ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Derived Asset People</span>
                      {formatPeople(item.asset.people ?? [])}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Review Decision</span>
                      {item.review?.decision ?? '—'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={isBusy || !canConfirm ? disabledButtonStyle : primaryButtonStyle}
                        disabled={isBusy || !canConfirm}
                        onClick={() => void runReviewAction(item, { type: 'confirm' })}
                        title={confirmActionHint ?? undefined}
                      >
                        {confirmActionLabel}
                      </button>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : destructiveButtonStyle}
                        disabled={isBusy}
                        onClick={() => void runReviewAction(item, { type: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>
                    {confirmActionHint ? (
                      <div style={{ fontSize: '12px', color: '#6a4d00' }}>{confirmActionHint}</div>
                    ) : null}

                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={enrollmentBusy || enrollPersonId.length === 0 ? disabledButtonStyle : buttonStyle}
                        disabled={enrollmentBusy || enrollPersonId.length === 0}
                        onClick={() => void handleEnroll(item, enrollPersonId)}
                      >
                        {item.matchedPerson ? `Enroll ${item.matchedPerson.displayName}` : 'Enroll Selected Person'}
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <select
                        value={draft.selectedPersonId}
                        onChange={(event) => updateDraft(item.detection.id, { selectedPersonId: event.target.value })}
                        style={{ ...inputStyle, minWidth: '240px' }}
                        disabled={isBusy}
                      >
                        <option value="">Assign existing person</option>
                        {peopleOptions.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={isBusy || draft.selectedPersonId.length === 0 ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy || draft.selectedPersonId.length === 0}
                        onClick={() => void runReviewAction(item, { type: 'assign', personId: draft.selectedPersonId })}
                      >
                        Assign Existing
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <input
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
                          void runReviewAction(item, {
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
                        onClick={() => void runReviewAction(item, { type: 'ignore', ignoredReason: draft.ignoredReason })}
                      >
                        Ignore Face
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
