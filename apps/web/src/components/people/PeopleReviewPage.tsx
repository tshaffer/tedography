import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { FaceDetectionIgnoredReason, FaceDetectionMatchStatus } from '@tedography/domain';
import type { PeoplePipelineSummaryResponse, PeopleReviewQueueItem, PeopleReviewQueueSort } from '@tedography/shared';
import {
  getPeoplePipelineSummary,
  listPeople,
  listPeopleReviewQueue,
  reviewFaceDetection
} from '../../api/peoplePipelineApi';
import { getFaceDetectionPreviewUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';

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

type ReviewDraftState = {
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

function formatPeopleList(items: Array<{ displayName: string }>): string {
  if (items.length === 0) {
    return 'None derived yet';
  }

  return items.map((item) => item.displayName).join(', ');
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

export function PeopleReviewPage() {
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
  const [selectedStatuses, setSelectedStatuses] = useState<FaceDetectionMatchStatus[]>(defaultStatuses);
  const [assetIdFilter, setAssetIdFilter] = useState('');
  const [sortBy, setSortBy] = useState<PeopleReviewQueueSort>('newest');
  const [draftByDetectionId, setDraftByDetectionId] = useState<Record<string, ReviewDraftState>>({});
  const [busyDetectionId, setBusyDetectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<PeoplePipelineSummaryResponse | null>(null);

  const queueCount = items.length;

  async function loadPageData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [queueResponse, peopleResponse, summaryResponse] = await Promise.all([
        listPeopleReviewQueue({
          statuses: selectedStatuses,
          ...(assetIdFilter.trim() ? { assetId: assetIdFilter.trim() } : {}),
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
  }, [selectedStatuses, assetIdFilter, sortBy]);

  function getDraft(detectionId: string): ReviewDraftState {
    return (
      draftByDetectionId[detectionId] ?? {
        selectedPersonId: '',
        newPersonName: '',
        ignoredReason: 'user-ignored'
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

  async function runAction(
    item: PeopleReviewQueueItem,
    action:
      | { type: 'confirm' }
      | { type: 'reject' }
      | { type: 'assign'; personId: string }
      | { type: 'createAndAssign'; displayName: string }
      | { type: 'ignore'; ignoredReason: FaceDetectionIgnoredReason }
  ) {
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
        setNoticeMessage(`Assigned face ${item.detection.id}.`);
      } else if (action.type === 'createAndAssign') {
        await reviewFaceDetection(item.detection.id, {
          action: 'createAndAssign',
          displayName: action.displayName,
          reviewer: 'people-review-ui'
        });
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update face review');
    } finally {
      setBusyDetectionId(null);
    }
  }

  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);

  return (
    <div style={pageStyle}>
      <div style={linkRowStyle}>
        <Link to="/" style={linkStyle}>
          Back to Library
        </Link>
        <Link to="/people/dev" style={linkStyle}>
          People Dev Harness
        </Link>
        <Link to="/duplicates/review" style={linkStyle}>
          Duplicate Review
        </Link>
      </div>

      <section style={panelStyle}>
        <h1 style={{ margin: '0 0 10px', fontSize: '32px' }}>People Review</h1>
        <p style={{ margin: '0 0 14px', color: '#5b6673' }}>
          Minimal review workbench for persisted face detections and derived <code>mediaAsset.people</code>.
        </p>

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
            <span style={labelStyle}>Queue Size</span>
            <div style={{ ...inputStyle, backgroundColor: '#f7f9fb' }}>{queueCount} loaded</div>
          </div>
          <div>
            <span style={labelStyle}>Actions</span>
            <button type="button" style={buttonStyle} onClick={() => void loadPageData()}>
              Refresh
            </button>
          </div>
        </div>

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
        <section style={panelStyle}>No face detections matched the current filters.</section>
      ) : null}

      {!loading
        ? items.map((item) => {
            const draft = getDraft(item.detection.id);
            const isBusy = busyDetectionId === item.detection.id;
            const canConfirm =
              typeof item.detection.autoMatchCandidatePersonId === 'string' ||
              typeof item.detection.matchedPersonId === 'string';
            const confirmActionLabel = getConfirmActionLabel(item);
            const confirmActionHint = getConfirmActionHint(item);

            return (
              <section key={item.detection.id} style={cardStyle}>
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
                    <span style={badgeStyle}>Status: {item.detection.matchStatus}</span>
                    <span style={badgeStyle}>Face #{item.detection.faceIndex}</span>
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
                        style={isBusy || !canConfirm ? disabledButtonStyle : primaryButtonStyle}
                        disabled={isBusy || !canConfirm}
                        onClick={() => void runAction(item, { type: 'confirm' })}
                        title={confirmActionHint ?? undefined}
                      >
                        {confirmActionLabel}
                      </button>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : destructiveButtonStyle}
                        disabled={isBusy}
                        onClick={() => void runAction(item, { type: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>
                    {confirmActionHint ? (
                      <div style={{ fontSize: '12px', color: '#6a4d00' }}>{confirmActionHint}</div>
                    ) : null}

                    <div style={inlineRowStyle}>
                      <select
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
                        style={isBusy || draft.selectedPersonId.length === 0 ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy || draft.selectedPersonId.length === 0}
                        onClick={() => void runAction(item, { type: 'assign', personId: draft.selectedPersonId })}
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
                        onClick={() => void runAction(item, { type: 'ignore', ignoredReason: draft.ignoredReason })}
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
