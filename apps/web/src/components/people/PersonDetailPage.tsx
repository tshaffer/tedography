import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { GetPersonDetailResponse, ListPeopleResponse } from '@tedography/shared';
import {
  enrollPersonFromDetection,
  getPersonDetail,
  listPeople,
  mergePerson,
  processPeopleAsset,
  removePersonExample,
  reviewFaceDetection,
  updatePerson
} from '../../api/peoplePipelineApi';
import { getFaceDetectionPreviewUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '0 auto',
  padding: '16px',
  maxWidth: '1500px',
  backgroundColor: '#f3f4f6',
  minHeight: '100vh',
  boxSizing: 'border-box'
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
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

const previewFrameStyle: CSSProperties = {
  borderRadius: '14px',
  overflow: 'hidden',
  border: '1px solid #d7dce2',
  backgroundColor: '#edf2f7'
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  backgroundColor: '#d8e1ea'
};

const placeholderStyle: CSSProperties = {
  ...previewImageStyle,
  display: 'grid',
  placeItems: 'center',
  color: '#516273',
  fontSize: '42px',
  fontWeight: 700
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#556677',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '6px'
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

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '16px'
};

const compactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '12px'
};

const assetCardStyle: CSSProperties = {
  ...panelStyle,
  marginBottom: 0,
  padding: '12px',
  display: 'grid',
  gap: '8px'
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const warningBadgeStyle: CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#fff7e8',
  borderColor: '#e7c77d',
  color: '#805a00'
};

function formatSeenAt(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function formatAssetCount(count: number): string {
  return `${count} asset${count === 1 ? '' : 's'}`;
}

export function PersonDetailPage() {
  const { personId = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<GetPersonDetailResponse | null>(null);
  const [peopleOptions, setPeopleOptions] = useState<ListPeopleResponse['items']>([]);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [mergeTargetPersonId, setMergeTargetPersonId] = useState('');
  const [confirmedFaceAssignments, setConfirmedFaceAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  async function loadDetail(): Promise<void> {
    if (!personId.trim()) {
      setLoadErrorMessage('Person not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadErrorMessage(null);
    try {
      const [response, peopleResponse] = await Promise.all([getPersonDetail(personId), listPeople()]);
      setDetail(response);
      setDisplayNameDraft(response.person.displayName);
      setPeopleOptions(peopleResponse.items);
      setMergeTargetPersonId('');
      setConfirmedFaceAssignments(
        Object.fromEntries(
          response.confirmedFaces.map((face) => [face.detection.id, ''])
        )
      );
    } catch (error) {
      setLoadErrorMessage(error instanceof Error ? error.message : 'Unable to load person detail');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [personId]);

  const personSearchHref = useMemo(
    () => `/?area=Search&people=${encodeURIComponent(personId)}&peopleMode=Any`,
    [personId]
  );
  const personReviewHref = useMemo(
    () => `/people/review?personId=${encodeURIComponent(personId)}`,
    [personId]
  );

  async function handleSavePerson(): Promise<void> {
    if (!detail) {
      return;
    }

    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      const response = await updatePerson(detail.person.id, {
        displayName: displayNameDraft.trim(),
        isHidden: detail.person.isHidden ?? false,
        isArchived: detail.person.isArchived ?? false
      });
      setDetail((current) => (current ? { ...current, person: response.item } : current));
      setDisplayNameDraft(response.item.displayName);
      setNoticeMessage(`Updated ${response.item.displayName}.`);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to update person');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFlag(flag: 'isHidden' | 'isArchived'): Promise<void> {
    if (!detail) {
      return;
    }

    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      const response = await updatePerson(detail.person.id, {
        [flag]: !(detail.person[flag] ?? false)
      });
      setDetail((current) => (current ? { ...current, person: response.item } : current));
      setNoticeMessage(
        `${response.item.displayName} is now ${flag === 'isHidden'
          ? response.item.isHidden ? 'hidden' : 'visible'
          : response.item.isArchived ? 'archived' : 'active'}.`
      );
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to update person');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveExample(exampleId: string): Promise<void> {
    if (!detail) {
      return;
    }

    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      await removePersonExample(detail.person.id, exampleId);
      await loadDetail();
      setNoticeMessage('Removed example face from the enrolled set.');
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to remove example face');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddConfirmedFaceAsExample(detectionId: string): Promise<void> {
    if (!detail) {
      return;
    }

    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      await enrollPersonFromDetection(detail.person.id, { detectionId });
      await loadDetail();
      setNoticeMessage('Added confirmed face to the example set.');
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to add example face');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveConfirmedFace(detectionId: string): Promise<void> {
    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      await reviewFaceDetection(detectionId, { action: 'reject' });
      await loadDetail();
      setNoticeMessage('Removed confirmed face from this person.');
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to remove confirmed face');
    } finally {
      setSaving(false);
    }
  }

  async function handleReassignConfirmedFace(detectionId: string): Promise<void> {
    const targetPersonId = confirmedFaceAssignments[detectionId]?.trim() ?? '';
    if (!targetPersonId) {
      setActionErrorMessage('Choose a target person before reassigning this confirmed face.');
      return;
    }

    setSaving(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      await reviewFaceDetection(detectionId, { action: 'assign', personId: targetPersonId });
      await loadDetail();
      setNoticeMessage('Reassigned confirmed face to a different person.');
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to reassign confirmed face');
    } finally {
      setSaving(false);
    }
  }

  async function handleMergePerson(): Promise<void> {
    if (!detail) {
      return;
    }

    if (!mergeTargetPersonId.trim()) {
      setActionErrorMessage('Choose a target person before merging.');
      return;
    }

    setMerging(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      const response = await mergePerson(detail.person.id, {
        targetPersonId: mergeTargetPersonId.trim()
      });
      setNoticeMessage(
        `Merged ${response.sourcePerson.displayName} into ${response.targetPerson.displayName}. Moved ${response.movedConfirmedDetectionsCount} confirmed faces and ${response.movedExampleCount} example faces across ${response.affectedAssetCount} assets.`
      );
      navigate(`/people/${encodeURIComponent(response.targetPerson.id)}`);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to merge person');
    } finally {
      setMerging(false);
    }
  }

  async function handleReprocessRelatedAssets(): Promise<void> {
    if (!detail || detail.assets.length === 0) {
      return;
    }

    setReprocessing(true);
    setActionErrorMessage(null);
    setNoticeMessage(null);
    try {
      const assetIds = detail.assets.slice(0, 20).map((asset) => asset.id);
      const results = await Promise.allSettled(assetIds.map((assetId) => processPeopleAsset(assetId, { force: true })));
      const succeededCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - succeededCount;
      await loadDetail();
      setNoticeMessage(
        failedCount === 0
          ? `Reprocessed ${succeededCount} related asset${succeededCount === 1 ? '' : 's'}.`
          : `Reprocessed ${succeededCount} related asset${succeededCount === 1 ? '' : 's'}; ${failedCount} failed.`
      );
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Failed to reprocess related assets');
    } finally {
      setReprocessing(false);
    }
  }

  const enrollmentStatusLabel = detail
    ? detail.exampleCount === 0
      ? 'Not enrolled'
      : detail.exampleCount < 3
        ? `Enrolled: ${detail.exampleCount} examples (thin set)`
        : `Enrolled: ${detail.exampleCount} examples`
    : '—';

  return (
    <div style={pageStyle}>
      <div style={linkRowStyle}>
        <Link to="/people" style={linkStyle}>
          Back to People
        </Link>
        <Link to={personSearchHref} style={linkStyle}>
          View In Search
        </Link>
        <Link to={personReviewHref} style={linkStyle}>
          Review Related Faces
        </Link>
      </div>

      {loading ? <section style={panelStyle}>Loading person...</section> : null}
      {!loading && loadErrorMessage ? <section style={panelStyle}>Person not found or unavailable: {loadErrorMessage}</section> : null}

      {!loading && !loadErrorMessage && detail ? (
        <>
          <section
            style={{
              ...panelStyle,
              display: 'grid',
              gridTemplateColumns: '220px minmax(0, 1fr)',
              gap: '18px'
            }}
          >
            <div style={previewFrameStyle}>
              {detail.representativeAssetId ? (
                <img
                  src={getThumbnailMediaUrl(detail.representativeAssetId)}
                  alt={detail.person.displayName}
                  style={previewImageStyle}
                />
              ) : (
                <div style={placeholderStyle}>
                  {detail.person.displayName.trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>

            <div>
              <h1 style={{ margin: '0 0 10px', fontSize: '32px' }}>{detail.person.displayName}</h1>
              <div style={badgeRowStyle}>
                <span style={badgeStyle}>{formatAssetCount(detail.assetCount)}</span>
                <span style={badgeStyle}>Last seen {formatSeenAt(detail.lastSeenAt)}</span>
                <span style={detail.exampleCount < 3 ? warningBadgeStyle : badgeStyle}>{enrollmentStatusLabel}</span>
                {detail.reviewableAssetCount > 0 ? (
                  <span style={warningBadgeStyle}>
                    {detail.reviewableAssetCount} asset{detail.reviewableAssetCount === 1 ? '' : 's'} still need review
                  </span>
                ) : null}
                {detail.person.isArchived ? <span style={badgeStyle}>Archived</span> : null}
                {detail.person.isHidden ? <span style={badgeStyle}>Hidden</span> : null}
              </div>

              <p style={{ margin: '12px 0', color: '#5b6673' }}>
                Confirmed photos below come from derived <code>mediaAsset.people</code>. Review-needed work is shown separately and does not imply confirmed presence.
              </p>
              <p style={{ margin: '0 0 12px', color: '#5b6673', fontSize: '13px' }}>
                Example faces are the specific confirmed detections tedography uses to improve future recognition quality for this person.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 320px) auto auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <span style={labelStyle}>Display Name</span>
                  <input
                    type="text"
                    value={displayNameDraft}
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                    disabled={saving}
                  />
                </div>
                <button
                  type="button"
                  style={saving || displayNameDraft.trim().length === 0 ? disabledButtonStyle : primaryButtonStyle}
                  disabled={saving || displayNameDraft.trim().length === 0}
                  onClick={() => void handleSavePerson()}
                >
                  Save Name
                </button>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={saving ? disabledButtonStyle : buttonStyle}
                    disabled={saving}
                    onClick={() => void handleToggleFlag('isHidden')}
                  >
                    {detail.person.isHidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button
                    type="button"
                    style={saving ? disabledButtonStyle : buttonStyle}
                    disabled={saving}
                    onClick={() => void handleToggleFlag('isArchived')}
                  >
                    {detail.person.isArchived ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) auto', gap: '10px', alignItems: 'end', marginTop: '12px' }}>
                <div>
                  <span style={labelStyle}>Merge Into Person</span>
                  <select
                    value={mergeTargetPersonId}
                    onChange={(event) => setMergeTargetPersonId(event.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                    disabled={saving || merging}
                  >
                    <option value="">Choose surviving person</option>
                    {peopleOptions
                      .filter((person) => person.id !== detail.person.id)
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.displayName}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  style={merging || mergeTargetPersonId.trim().length === 0 ? disabledButtonStyle : buttonStyle}
                  disabled={merging || mergeTargetPersonId.trim().length === 0}
                  onClick={() => void handleMergePerson()}
                >
                  {merging ? 'Merging...' : 'Merge Person'}
                </button>
              </div>
              <p style={{ margin: '10px 0 0', color: '#5b6673', fontSize: '12px' }}>
                Merge moves confirmed detections and example faces to the surviving person, then hides and archives this source person.
              </p>

              {noticeMessage ? <p style={{ color: '#15603a', marginBottom: 0 }}>{noticeMessage}</p> : null}
              {actionErrorMessage ? <p style={{ color: '#a32222', marginBottom: 0 }}>{actionErrorMessage}</p> : null}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: '22px' }}>Needs Review</h2>
            {detail.reviewableAssetCount > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <p style={{ margin: 0, color: '#5b6673' }}>
                  {detail.reviewableAssetCount} asset{detail.reviewableAssetCount === 1 ? '' : 's'} containing {detail.person.displayName} still have reviewable faces.
                </p>
                <Link to={personReviewHref} style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-block' }}>
                  Open People Review
                </Link>
              </div>
            ) : (
              <p style={{ margin: 0, color: '#5b6673' }}>No review-needed face detections are currently tied to this person.</p>
            )}
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={reprocessing ? disabledButtonStyle : buttonStyle}
                disabled={reprocessing || detail.assets.length === 0}
                onClick={() => void handleReprocessRelatedAssets()}
              >
                {reprocessing ? 'Reprocessing...' : 'Reprocess Related Assets'}
              </button>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: '22px' }}>Example Faces</h2>
            <p style={{ margin: '0 0 12px', color: '#5b6673' }}>
              {detail.exampleCount === 0
                ? 'No example faces are enrolled yet.'
                : detail.exampleCount < 3
                  ? 'This person has a thin example set. Adding a few more clean examples can improve recognition quality.'
                  : 'This example set is large enough to be useful, but you can still remove weak examples to improve quality.'}
            </p>
            {detail.exampleFaces.length === 0 ? (
              <p style={{ margin: 0, color: '#5b6673' }}>No example faces available yet.</p>
            ) : (
              <div style={gridStyle}>
                {detail.exampleFaces.map((face) => (
                  <article key={face.id} style={assetCardStyle}>
                    <div style={previewFrameStyle}>
                      <img
                        src={getFaceDetectionPreviewUrl(face.detection.id)}
                        alt={`${detail.person?.displayName ?? 'Person'} face example`}
                        style={previewImageStyle}
                      />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{face.asset.filename}</div>
                    <div style={{ fontSize: '12px', color: '#5b6673' }}>
                      {formatSeenAt(face.asset.captureDateTime)}
                    </div>
                    <div style={badgeRowStyle}>
                      <span style={badgeStyle}>{face.engine}</span>
                      <span style={badgeStyle}>Face #{face.detection.faceIndex}</span>
                    </div>
                    <button
                      type="button"
                      style={saving ? disabledButtonStyle : buttonStyle}
                      disabled={saving}
                      onClick={() => void handleRemoveExample(face.id)}
                    >
                      Remove Example
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: '22px' }}>Confirmed Faces</h2>
            <p style={{ margin: '0 0 12px', color: '#5b6673' }}>
              These are confirmed detections currently assigned to {detail.person.displayName}. Reassigning or removing one updates the detection and the derived <code>mediaAsset.people</code> state for that asset. Example faces remain a separate opt-in concept.
            </p>
            {detail.confirmedFaces.length === 0 ? (
              <p style={{ margin: 0, color: '#5b6673' }}>No confirmed face detections are currently available for maintenance.</p>
            ) : (
              <div style={compactGridStyle}>
                {detail.confirmedFaces.map((face) => (
                  <article key={face.detection.id} style={assetCardStyle}>
                    <div style={previewFrameStyle}>
                      <img
                        src={getFaceDetectionPreviewUrl(face.detection.id)}
                        alt={`${detail.person.displayName} confirmed face`}
                        style={previewImageStyle}
                      />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{face.asset.filename}</div>
                    <div style={{ fontSize: '12px', color: '#5b6673' }}>{face.asset.originalArchivePath}</div>
                    <div style={badgeRowStyle}>
                      <span style={badgeStyle}>Face #{face.detection.faceIndex}</span>
                      {face.exampleId ? <span style={badgeStyle}>Example</span> : null}
                    </div>
                    {!face.exampleId ? (
                      <button
                        type="button"
                        style={saving ? disabledButtonStyle : buttonStyle}
                        disabled={saving}
                        onClick={() => void handleAddConfirmedFaceAsExample(face.detection.id)}
                      >
                        Add as Example
                      </button>
                    ) : null}
                    <div>
                      <span style={labelStyle}>Reassign to</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                        <select
                          value={confirmedFaceAssignments[face.detection.id] ?? ''}
                          onChange={(event) =>
                            setConfirmedFaceAssignments((current) => ({
                              ...current,
                              [face.detection.id]: event.target.value
                            }))
                          }
                          style={{ ...inputStyle, width: '100%' }}
                          disabled={saving}
                        >
                          <option value="">Choose target person</option>
                          {peopleOptions
                            .filter((person) => person.id !== detail.person.id)
                            .map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.displayName}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          style={
                            saving || !(confirmedFaceAssignments[face.detection.id] ?? '').trim()
                              ? disabledButtonStyle
                              : buttonStyle
                          }
                          disabled={saving || !(confirmedFaceAssignments[face.detection.id] ?? '').trim()}
                          onClick={() => void handleReassignConfirmedFace(face.detection.id)}
                        >
                          Reassign
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      style={saving ? disabledButtonStyle : buttonStyle}
                      disabled={saving}
                      onClick={() => void handleRemoveConfirmedFace(face.detection.id)}
                    >
                      Remove from Person
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>Confirmed Photos</h2>
              <Link to={personSearchHref} style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-block' }}>
                View In Search
              </Link>
            </div>
            {detail.assets.length === 0 ? (
              <p style={{ margin: 0, color: '#5b6673' }}>No confirmed photos for this person yet.</p>
            ) : (
              <div style={gridStyle}>
                {detail.assets.map((asset) => (
                  <article key={asset.id} style={assetCardStyle}>
                    <div style={previewFrameStyle}>
                      <img
                        src={getThumbnailMediaUrl(asset.id)}
                        alt={asset.filename}
                        style={previewImageStyle}
                      />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{asset.filename}</div>
                    <div style={{ fontSize: '12px', color: '#5b6673' }}>{asset.originalArchivePath}</div>
                    <div style={badgeRowStyle}>
                      <span style={badgeStyle}>{asset.photoState}</span>
                      {asset.reviewableDetectionsCount > 0 ? (
                        <span style={warningBadgeStyle}>
                          {asset.reviewableDetectionsCount} reviewable
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
