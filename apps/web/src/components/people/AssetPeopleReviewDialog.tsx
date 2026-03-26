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

const currentCardStyle: CSSProperties = {
  ...cardStyle,
  borderColor: '#0f5f73',
  boxShadow: '0 0 0 2px rgba(15, 95, 115, 0.16), 0 8px 18px rgba(15, 23, 42, 0.06)'
};

const sourcePreviewLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
  gap: '16px',
  alignItems: 'start'
};

const sourcePreviewFigureStyle: CSSProperties = {
  ...previewBoxStyle,
  position: 'relative',
  overflow: 'hidden'
};

const sourcePreviewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  maxHeight: '56vh',
  objectFit: 'contain',
  backgroundColor: '#dbe2ea'
};

const overlaySurfaceStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none'
};

const overlayBoxBaseStyle: CSSProperties = {
  position: 'absolute',
  borderRadius: '8px',
  border: '2px solid #0f5f73',
  backgroundColor: 'rgba(15, 95, 115, 0.08)',
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.35) inset',
  pointerEvents: 'auto',
  cursor: 'pointer'
};

const overlayLabelStyle: CSSProperties = {
  position: 'absolute',
  top: '0',
  left: '0',
  transform: 'translateY(calc(-100% - 4px))',
  maxWidth: '100%',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '11px',
  fontWeight: 700,
  color: '#fff',
  backgroundColor: 'rgba(15, 23, 42, 0.88)',
  borderRadius: '999px',
  padding: '2px 8px'
};

const overlayLegendStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  fontSize: '12px',
  color: '#556677'
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

const showFaceBoxesStorageKey = 'tedography.people.assetReviewDialog.showFaceBoxes';

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

function getDetectionOverlayLabel(
  status: FaceDetectionMatchStatus,
  suggestedPersonName: string,
  matchedPersonName: string
): string {
  switch (status) {
    case 'confirmed':
      return matchedPersonName ? `Confirmed: ${matchedPersonName}` : 'Confirmed';
    case 'autoMatched':
      return suggestedPersonName ? `Auto: ${suggestedPersonName}` : 'Auto Matched';
    case 'suggested':
      return suggestedPersonName ? `Suggested: ${suggestedPersonName}` : 'Suggested';
    case 'rejected':
      return 'Rejected';
    case 'ignored':
      return 'Ignored';
    default:
      return 'Unmatched';
  }
}

function getDetectionOverlayPalette(status: FaceDetectionMatchStatus, isSelected: boolean): CSSProperties {
  const paletteByStatus: Record<FaceDetectionMatchStatus, { border: string; background: string }> = {
    confirmed: { border: '#1d8348', background: 'rgba(29, 131, 72, 0.18)' },
    suggested: { border: '#0f5f73', background: 'rgba(15, 95, 115, 0.14)' },
    autoMatched: { border: '#6d28d9', background: 'rgba(109, 40, 217, 0.14)' },
    unmatched: { border: '#475569', background: 'rgba(71, 85, 105, 0.12)' },
    rejected: { border: '#b45309', background: 'rgba(180, 83, 9, 0.14)' },
    ignored: { border: '#64748b', background: 'rgba(100, 116, 139, 0.12)' }
  };

  const palette = paletteByStatus[status];
  return {
    borderColor: palette.border,
    backgroundColor: palette.background,
    zIndex: isSelected ? 2 : 1,
    boxShadow: isSelected ? `0 0 0 2px ${palette.border}, 0 0 0 4px rgba(255, 255, 255, 0.6)` : undefined
  };
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
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [showFaceBoxes, setShowFaceBoxes] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(showFaceBoxesStorageKey) === 'true';
  });

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

  useEffect(() => {
    if (!open || !assetState) {
      return;
    }

    if (
      selectedDetectionId &&
      assetState.detections.some((detection) => detection.id === selectedDetectionId)
    ) {
      return;
    }

    setSelectedDetectionId(assetState.detections[0]?.id ?? null);
  }, [assetState, open, selectedDetectionId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(showFaceBoxesStorageKey, showFaceBoxes ? 'true' : 'false');
  }, [showFaceBoxes]);

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
        `Added example face for ${response.person.displayName} from detection ${response.detection.id}.`
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

  const selectedDetection = useMemo(
    () => assetState?.detections.find((detection) => detection.id === selectedDetectionId) ?? null,
    [assetState?.detections, selectedDetectionId]
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

          {assetState ? (
            <div style={sourcePreviewLayoutStyle}>
              <div>
                <div style={{ ...inlineRowStyle, justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#475569', fontWeight: 700 }}>Source asset context</div>
                  <label style={{ ...inlineRowStyle, gap: '6px', fontSize: '13px', color: '#163246' }}>
                    <input
                      type="checkbox"
                      checked={showFaceBoxes}
                      onChange={(event) => setShowFaceBoxes(event.target.checked)}
                    />
                    Show Face Boxes
                  </label>
                </div>
                <div style={sourcePreviewFigureStyle}>
                  <img
                    src={getThumbnailMediaUrl(asset.id)}
                    alt={`${asset.filename} source thumbnail`}
                    style={sourcePreviewImageStyle}
                  />
                  {showFaceBoxes ? (
                    <div style={overlaySurfaceStyle}>
                      {assetState.detections.map((detection) => {
                        const suggestedPersonName = detection.autoMatchCandidatePersonId
                          ? peopleById.get(detection.autoMatchCandidatePersonId) ?? ''
                          : '';
                        const matchedPersonName = detection.matchedPersonId
                          ? peopleById.get(detection.matchedPersonId) ?? ''
                          : '';
                        const isSelected = detection.id === selectedDetection?.id;

                        return (
                          <button
                            key={detection.id}
                            type="button"
                            onClick={() => setSelectedDetectionId(detection.id)}
                            style={{
                              ...overlayBoxBaseStyle,
                              ...getDetectionOverlayPalette(detection.matchStatus, isSelected),
                              left: `${detection.boundingBox.left * 100}%`,
                              top: `${detection.boundingBox.top * 100}%`,
                              width: `${detection.boundingBox.width * 100}%`,
                              height: `${detection.boundingBox.height * 100}%`
                            }}
                            title={`${getDetectionOverlayLabel(
                              detection.matchStatus,
                              suggestedPersonName,
                              matchedPersonName
                            )} • Face #${detection.faceIndex}`}
                          >
                            <span style={overlayLabelStyle}>
                              {getDetectionOverlayLabel(detection.matchStatus, suggestedPersonName, matchedPersonName)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Face boxes are optional and use the same detection statuses as the review controls below.
                </div>
                <div style={overlayLegendStyle}>
                  <span>Confirmed = green</span>
                  <span>Suggested = teal</span>
                  <span>Auto Matched = purple</span>
                  <span>Unmatched = slate</span>
                  <span>Rejected = amber</span>
                  <span>Ignored = gray</span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  {selectedDetection
                    ? `Selected face #${selectedDetection.faceIndex} is highlighted on the image and in the review list.`
                    : 'Select a face below to highlight its box on the asset image.'}
                </div>
                {!showFaceBoxes && assetState.detections.length > 0 ? (
                  <div style={{ fontSize: '13px', color: '#5b6673' }}>
                    Turn on <strong>Show Face Boxes</strong> to see where each reviewed face appears in the photo.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

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
            const isSelected = selectedDetection?.id === detection.id;

            return (
              <section
                key={detection.id}
                style={isSelected ? currentCardStyle : cardStyle}
                onClick={() => setSelectedDetectionId(detection.id)}
              >
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
                    {isSelected ? <span style={badgeStyle}>Selected</span> : null}
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
                        {matchedPersonName ? `Add ${matchedPersonName} As Example` : 'Add As Example'}
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
