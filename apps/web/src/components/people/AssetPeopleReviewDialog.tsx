import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { FaceDetectionIgnoredReason, FaceDetectionMatchStatus, MediaAsset } from '@tedography/domain';
import type { ListAssetFaceDetectionsResponse } from '@tedography/shared';
import {
  enrollPersonFromDetection,
  getPeoplePipelineAssetState,
  listPeople,
  reviewFaceDetection
} from '../../api/peoplePipelineApi';
import { getFaceDetectionPreviewUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';

interface AssetPeopleReviewDialogProps {
  open: boolean;
  asset: MediaAsset | null;
  initialState?: ListAssetFaceDetectionsResponse | null;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1500,
  padding: '20px'
};

const dialogStyle: CSSProperties = {
  width: 'min(1280px, 100%)',
  maxHeight: 'min(92vh, 980px)',
  overflow: 'auto',
  borderRadius: '16px',
  border: '1px solid #d7dce2',
  backgroundColor: '#f3f4f6',
  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.24)',
  padding: '16px'
};

const panelStyle: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #d7dce2',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '14px',
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)'
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '12px'
};

const controlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  alignItems: 'end'
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

const actionsSectionStyle: CSSProperties = {
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

const ignoredReasonOptions: FaceDetectionIgnoredReason[] = [
  'user-ignored',
  'too-small',
  'too-low-quality',
  'background-face',
  'non-person-face',
  'other'
];

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

function formatPeopleList(items: Array<{ displayName: string }>): string {
  return items.length > 0 ? items.map((item) => item.displayName).join(', ') : 'None confirmed yet';
}

function getMatchStatusSummary(
  status: FaceDetectionMatchStatus,
  suggestedPersonName: string,
  matchedPersonName: string
): string {
  switch (status) {
    case 'confirmed':
      return matchedPersonName.length > 0
        ? `Confirmed people metadata now includes ${matchedPersonName} for this asset.`
        : 'Confirmed face. Derived asset people should now reflect the reviewed assignment.';
    case 'autoMatched':
      return suggestedPersonName.length > 0
        ? `Auto-matched candidate ${suggestedPersonName} still needs confirmation before it becomes derived asset people.`
        : 'Auto-matched face still requires confirmation before it becomes derived asset people.';
    case 'suggested':
      return suggestedPersonName.length > 0
        ? `Suggested match ${suggestedPersonName} still needs review before it becomes derived asset people.`
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

function getConfirmActionLabel(suggestedPersonName: string, assignedPersonName: string): string {
  if (suggestedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return `Confirm Suggested (${suggestedPersonName})`;
  }

  if (assignedPersonName.length > 0) {
    return `Confirm ${assignedPersonName}`;
  }

  return 'Confirm';
}

function getConfirmActionHint(suggestedPersonName: string, assignedPersonName: string): string | null {
  if (suggestedPersonName.length > 0 && assignedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return `This confirms the suggested person (${suggestedPersonName}), not the currently assigned person (${assignedPersonName}).`;
  }

  return null;
}

export function AssetPeopleReviewDialog({
  open,
  asset,
  initialState = null,
  onClose,
  onUpdated
}: AssetPeopleReviewDialogProps) {
  const [assetState, setAssetState] = useState<ListAssetFaceDetectionsResponse | null>(initialState);
  const [peopleOptions, setPeopleOptions] = useState<Array<{ id: string; displayName: string }>>([]);
  const [draftByDetectionId, setDraftByDetectionId] = useState<Record<string, DraftState>>({});
  const [loading, setLoading] = useState(false);
  const [busyDetectionId, setBusyDetectionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  async function loadDialogData(): Promise<void> {
    if (!asset) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const [stateResponse, peopleResponse] = await Promise.all([
        getPeoplePipelineAssetState(asset.id),
        listPeople()
      ]);
      setAssetState(stateResponse);
      setPeopleOptions(peopleResponse.items.map((person) => ({ id: person.id, displayName: person.displayName })));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load asset people review data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !asset) {
      return;
    }

    setAssetState(initialState);
    void loadDialogData();
  }, [open, asset?.id, initialState?.assetId]);

  function getDraft(detectionId: string): DraftState {
    return (
      draftByDetectionId[detectionId] ?? {
        selectedPersonId: '',
        newPersonName: '',
        ignoredReason: 'user-ignored'
      }
    );
  }

  function updateDraft(detectionId: string, patch: Partial<DraftState>): void {
    setDraftByDetectionId((current) => ({
      ...current,
      [detectionId]: {
        ...getDraft(detectionId),
        ...patch
      }
    }));
  }

  async function refreshAfterMutation(notice: string): Promise<void> {
    setNoticeMessage(notice);
    await loadDialogData();
    await onUpdated?.();
  }

  async function runAction(
    detectionId: string,
    action:
      | { type: 'confirm'; personId?: string | null }
      | { type: 'reject' }
      | { type: 'assign'; personId: string }
      | { type: 'createAndAssign'; displayName: string }
      | { type: 'ignore'; ignoredReason: FaceDetectionIgnoredReason }
  ): Promise<void> {
    setBusyDetectionId(detectionId);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      if (action.type === 'confirm') {
        await reviewFaceDetection(detectionId, {
          action: 'confirm',
          ...(action.personId ? { personId: action.personId } : {}),
          reviewer: 'library-asset-review-dialog'
        });
        await refreshAfterMutation(`Confirmed face ${detectionId}.`);
      } else if (action.type === 'reject') {
        await reviewFaceDetection(detectionId, {
          action: 'reject',
          reviewer: 'library-asset-review-dialog'
        });
        await refreshAfterMutation(`Rejected face ${detectionId}.`);
      } else if (action.type === 'assign') {
        await reviewFaceDetection(detectionId, {
          action: 'assign',
          personId: action.personId,
          reviewer: 'library-asset-review-dialog'
        });
        await refreshAfterMutation(`Assigned face ${detectionId}.`);
      } else if (action.type === 'createAndAssign') {
        await reviewFaceDetection(detectionId, {
          action: 'createAndAssign',
          displayName: action.displayName,
          reviewer: 'library-asset-review-dialog'
        });
        await refreshAfterMutation(`Created and assigned person for face ${detectionId}.`);
      } else {
        await reviewFaceDetection(detectionId, {
          action: 'ignore',
          ignoredReason: action.ignoredReason,
          reviewer: 'library-asset-review-dialog'
        });
        await refreshAfterMutation(`Ignored face ${detectionId}.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update face review');
    } finally {
      setBusyDetectionId(null);
    }
  }

  async function handleEnroll(detectionId: string, personId: string): Promise<void> {
    setBusyDetectionId(detectionId);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await enrollPersonFromDetection(personId, { detectionId });
      await refreshAfterMutation(
        `Enrolled ${response.person.displayName} from detection ${response.detection.id} using engine identity ${response.subjectKey}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to enroll person from detection');
    } finally {
      setBusyDetectionId(null);
    }
  }

  const peopleById = useMemo(() => new Map(peopleOptions.map((person) => [person.id, person.displayName])), [peopleOptions]);
  const reviewByDetectionId = useMemo(
    () => new Map((assetState?.reviews ?? []).map((review) => [review.faceDetectionId, review])),
    [assetState?.reviews]
  );

  const reviewableCount = useMemo(
    () =>
      (assetState?.detections ?? []).filter(
        (detection) =>
          detection.matchStatus === 'unmatched' ||
          detection.matchStatus === 'suggested' ||
          detection.matchStatus === 'autoMatched'
      ).length,
    [assetState?.detections]
  );

  if (!open || !asset) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <section style={panelStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '30px' }}>Asset People Review</h2>
              <div style={{ fontSize: '13px', color: '#5b6673' }}>
                Stay in Library while reviewing face detections for this asset only.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                to={`/people/review?assetId=${encodeURIComponent(asset.id)}`}
                style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
              >
                Open Full People Review
              </Link>
              <button type="button" style={buttonStyle} onClick={onClose}>
                Done
              </button>
            </div>
          </div>

          <div style={controlsGridStyle}>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Asset</span>
              {asset.id}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Filename</span>
              {asset.filename}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Captured</span>
              {formatDateTime(asset.captureDateTime)}
            </div>
            <div style={metaItemStyle}>
              <span style={labelStyle}>Derived Asset People</span>
              {formatPeopleList(assetState?.people ?? [])}
            </div>
          </div>

          <div style={badgeRowStyle}>
            <span style={badgeStyle}>Detections: {assetState?.detections.length ?? 0}</span>
            <span style={badgeStyle}>Reviewable: {reviewableCount}</span>
            <span style={badgeStyle}>Confirmed: {(assetState?.people ?? []).length}</span>
          </div>

          {errorMessage ? <p style={{ color: '#a32222', marginBottom: 0 }}>{errorMessage}</p> : null}
          {noticeMessage ? <p style={{ color: '#15603a', marginBottom: 0 }}>{noticeMessage}</p> : null}
        </section>

        {loading ? <section style={panelStyle}>Loading asset people review...</section> : null}

        {!loading && assetState && assetState.detections.length === 0 ? (
          <section style={panelStyle}>No face detections for this asset yet.</section>
        ) : null}

        {!loading &&
          assetState?.detections.map((detection) => {
            const draft = getDraft(detection.id);
            const isBusy = busyDetectionId === detection.id;
            const suggestedPersonName = detection.autoMatchCandidatePersonId
              ? peopleById.get(detection.autoMatchCandidatePersonId) ?? ''
              : '';
            const matchedPersonName = detection.matchedPersonId
              ? peopleById.get(detection.matchedPersonId) ?? ''
              : '';
            const confirmHint = getConfirmActionHint(suggestedPersonName, matchedPersonName);
            const review = reviewByDetectionId.get(detection.id) ?? null;
            const canConfirm =
              typeof detection.autoMatchCandidatePersonId === 'string' ||
              typeof detection.matchedPersonId === 'string';
            const enrollPersonId = detection.matchedPersonId ?? detection.autoMatchCandidatePersonId ?? '';

            return (
              <section key={detection.id} style={cardStyle}>
                <div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div>
                      <div style={previewBoxStyle}>
                        <img
                          src={
                            detection.previewPath || detection.cropPath
                              ? getFaceDetectionPreviewUrl(detection.id)
                              : getThumbnailMediaUrl(asset.id)
                          }
                          alt={asset.filename}
                          style={previewImageStyle}
                        />
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#566577' }}>
                        {detection.previewPath || detection.cropPath ? 'Detected face crop preview' : 'Source asset thumbnail'}
                      </div>
                    </div>
                    {detection.previewPath || detection.cropPath ? (
                      <div>
                        <div style={previewBoxStyle}>
                          <img
                            src={getThumbnailMediaUrl(asset.id)}
                            alt={`${asset.filename} source thumbnail`}
                            style={previewImageStyle}
                          />
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#566577' }}>Source asset thumbnail</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div style={badgeRowStyle}>
                    <span style={badgeStyle}>Status: {detection.matchStatus}</span>
                    <span style={badgeStyle}>Face #{detection.faceIndex}</span>
                    <span style={badgeStyle}>Detection: {detection.id}</span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                    {getMatchStatusSummary(detection.matchStatus, suggestedPersonName, matchedPersonName)}
                  </div>

                  <div style={metaGridStyle}>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Archive Path</span>
                      {asset.originalArchivePath}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Detection Confidence</span>
                      {formatConfidence(detection.detectionConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Suggested Person</span>
                      {suggestedPersonName || '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Suggested Confidence</span>
                      {formatConfidence(detection.autoMatchCandidateConfidence)}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Assigned Person</span>
                      {matchedPersonName || '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Ignored Reason</span>
                      {detection.ignoredReason ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Review Decision</span>
                      {review?.decision ?? '—'}
                    </div>
                    <div style={metaItemStyle}>
                      <span style={labelStyle}>Derived Asset People</span>
                      {formatPeopleList(assetState?.people ?? [])}
                    </div>
                  </div>

                  <div style={actionsSectionStyle}>
                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={isBusy || !canConfirm ? disabledButtonStyle : primaryButtonStyle}
                        disabled={isBusy || !canConfirm}
                        onClick={() =>
                          void runAction(detection.id, {
                            type: 'confirm',
                            personId: detection.autoMatchCandidatePersonId ?? detection.matchedPersonId ?? null
                          })
                        }
                        title={confirmHint ?? undefined}
                      >
                        {getConfirmActionLabel(suggestedPersonName, matchedPersonName)}
                      </button>
                      <button
                        type="button"
                        style={isBusy ? disabledButtonStyle : destructiveButtonStyle}
                        disabled={isBusy}
                        onClick={() => void runAction(detection.id, { type: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>

                    {confirmHint ? <div style={{ fontSize: '12px', color: '#6a4d00' }}>{confirmHint}</div> : null}

                    <div style={inlineRowStyle}>
                      <button
                        type="button"
                        style={
                          isBusy || detection.matchStatus !== 'confirmed' || enrollPersonId.length === 0
                            ? disabledButtonStyle
                            : buttonStyle
                        }
                        disabled={isBusy || detection.matchStatus !== 'confirmed' || enrollPersonId.length === 0}
                        onClick={() => void handleEnroll(detection.id, enrollPersonId)}
                      >
                        {matchedPersonName ? `Enroll ${matchedPersonName}` : 'Enroll Person'}
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <select
                        value={draft.selectedPersonId}
                        onChange={(event) => updateDraft(detection.id, { selectedPersonId: event.target.value })}
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
                        onClick={() => void runAction(detection.id, { type: 'assign', personId: draft.selectedPersonId })}
                      >
                        Assign Existing
                      </button>
                    </div>

                    <div style={inlineRowStyle}>
                      <input
                        type="text"
                        value={draft.newPersonName}
                        onChange={(event) => updateDraft(detection.id, { newPersonName: event.target.value })}
                        style={{ ...inputStyle, minWidth: '220px' }}
                        placeholder="New person display name"
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        style={isBusy || draft.newPersonName.trim().length === 0 ? disabledButtonStyle : buttonStyle}
                        disabled={isBusy || draft.newPersonName.trim().length === 0}
                        onClick={() =>
                          void runAction(detection.id, {
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
                          updateDraft(detection.id, { ignoredReason: event.target.value as FaceDetectionIgnoredReason })
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
                        onClick={() => void runAction(detection.id, { type: 'ignore', ignoredReason: draft.ignoredReason })}
                      >
                        Ignore Face
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
