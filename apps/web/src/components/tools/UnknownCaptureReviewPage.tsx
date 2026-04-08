import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PhotoState } from '@tedography/domain';
import type { ListUnknownCaptureReviewGroupsResponse } from '@tedography/shared';
import { listUnknownCaptureReviewItems, updateAssetPhotoState } from '../../api/assetApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';

const pageStyle: CSSProperties = {
  padding: '20px',
  display: 'grid',
  gap: '16px'
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  alignItems: 'center'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  backgroundColor: '#f4f4f4',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '8px 12px'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1f6feb',
  borderColor: '#1f6feb',
  color: '#fff'
};

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#b42318',
  borderColor: '#b42318',
  color: '#fff'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '14px'
};

const assetGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '14px'
};

const assetCardStyle: CSSProperties = {
  border: '1px solid #e4e4e4',
  borderRadius: '10px',
  padding: '12px',
  display: 'grid',
  gap: '10px',
  alignContent: 'start'
};

const selectedAssetCardStyle: CSSProperties = {
  boxShadow: 'inset 0 0 0 2px #f04438',
  borderColor: '#f04438',
  backgroundColor: '#fff7f6'
};

const imageStyle: CSSProperties = {
  width: '100%',
  height: '240px',
  objectFit: 'contain',
  borderRadius: '8px',
  backgroundColor: '#f7f7f7'
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 1fr',
  gap: '6px',
  fontSize: '13px'
};

const labelStyle: CSSProperties = {
  color: '#666',
  fontWeight: 600
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '999px',
  border: '1px solid #d5d5d5',
  backgroundColor: '#fafafa',
  fontSize: '11px',
  color: '#444'
};

const matchCardStyle: CSSProperties = {
  border: '1px solid #e3e3e3',
  borderRadius: '8px',
  padding: '10px',
  display: 'grid',
  gap: '8px'
};

function formatDimensions(width: number | null | undefined, height: number | null | undefined): string {
  return typeof width === 'number' && typeof height === 'number' ? `${width} × ${height}` : '—';
}

function formatPhotoTakenTime(value: unknown): string {
  return value ? JSON.stringify(value) : '—';
}

export function UnknownCaptureReviewPage() {
  const [data, setData] = useState<ListUnknownCaptureReviewGroupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await listUnknownCaptureReviewItems();
        if (!cancelled) {
          setData(response);
          setCurrentGroupIndex(0);
          setSelectedDiscardIds([]);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load review items');
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
  }, []);

  const groups = data?.groups ?? [];
  const currentGroup = groups[currentGroupIndex] ?? null;

  useEffect(() => {
    setSelectedDiscardIds([]);
    setNotice(null);
  }, [currentGroupIndex]);

  const summary = useMemo(() => {
    const assetCount = data?.assetCount ?? 0;
    const groupCount = data?.groupCount ?? 0;
    const ambiguousGroups = groups.filter((group) => group.assets.length > 1).length;
    return { assetCount, groupCount, ambiguousGroups };
  }, [data, groups]);

  function moveToNextGroup(): void {
    setCurrentGroupIndex((previous) => Math.min(previous + 1, Math.max(0, groups.length - 1)));
  }

  async function handleDiscardSelected(): Promise<void> {
    if (!currentGroup || selectedDiscardIds.length === 0) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      await Promise.all(selectedDiscardIds.map((assetId) => updateAssetPhotoState(assetId, PhotoState.Discard)));
      setData((previous) => {
        if (!previous) {
          return previous;
        }

        const nextGroups = previous.groups
          .map((group) =>
            group.key === currentGroup.key
              ? {
                  ...group,
                  assets: group.assets.filter((item) => !selectedDiscardIds.includes(item.asset.id)),
                  relatedTedographyAssets: group.relatedTedographyAssets.filter(
                    (item) => !selectedDiscardIds.includes(item.asset.id)
                  )
                }
              : {
                  ...group,
                  assets: group.assets.filter((item) => !selectedDiscardIds.includes(item.asset.id)),
                  relatedTedographyAssets: group.relatedTedographyAssets.filter(
                    (item) => !selectedDiscardIds.includes(item.asset.id)
                  )
                }
          )
          .filter((group) => group.assets.length > 0);

        return {
          ...previous,
          assetCount: nextGroups.reduce((total, group) => total + group.assets.length, 0),
          groupCount: nextGroups.length,
          groups: nextGroups
        };
      });
      setNotice(`Discarded ${selectedDiscardIds.length} asset${selectedDiscardIds.length === 1 ? '' : 's'}.`);
      setCurrentGroupIndex((previous) => Math.min(previous, Math.max(0, groups.length - 2)));
      setSelectedDiscardIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update photo state');
    } finally {
      setBusy(false);
    }
  }

  function toggleSelectedDiscard(assetId: string): void {
    setSelectedDiscardIds((previous) =>
      previous.includes(assetId) ? previous.filter((id) => id !== assetId) : [...previous, assetId]
    );
  }

  return (
    <main style={pageStyle}>
      <div style={toolbarStyle}>
        <Link to="/">Back to Library</Link>
        <strong>Unknown Capture Review</strong>
        {data ? <span>{summary.groupCount} groups</span> : null}
        {data ? <span>{summary.assetCount} assets</span> : null}
        {data ? <span>{summary.ambiguousGroups} multi-asset groups</span> : null}
      </div>

      {loading ? <p>Loading review items...</p> : null}
      {errorMessage ? <p style={{ color: '#b00020' }}>{errorMessage}</p> : null}
      {notice ? <p style={{ color: '#0f5132' }}>{notice}</p> : null}

      {!loading && !currentGroup ? <p>No review groups found.</p> : null}

      {currentGroup ? (
        <>
          <div style={toolbarStyle}>
            <button
              type="button"
              style={currentGroupIndex > 0 && !busy ? buttonStyle : disabledButtonStyle}
              onClick={() => setCurrentGroupIndex((previous) => Math.max(0, previous - 1))}
              disabled={currentGroupIndex === 0 || busy}
            >
              Previous Group
            </button>
            <button
              type="button"
              style={!busy && currentGroupIndex < groups.length - 1 ? buttonStyle : disabledButtonStyle}
              onClick={moveToNextGroup}
              disabled={busy || currentGroupIndex >= groups.length - 1}
            >
              Keep Group / Next
            </button>
            <button
              type="button"
              style={selectedDiscardIds.length > 0 && !busy ? dangerButtonStyle : disabledButtonStyle}
              onClick={() => {
                void handleDiscardSelected();
              }}
              disabled={busy || selectedDiscardIds.length === 0}
            >
              {busy ? 'Discarding...' : `Discard Selected (${selectedDiscardIds.length})`}
            </button>
            <span>
              Group {currentGroupIndex + 1} / {groups.length}
            </span>
            <span>{currentGroup.assets.length} review assets in group</span>
            <span>{currentGroup.relatedTedographyAssets.length} Tedography assets matched</span>
            <span>{currentGroup.verifiedMatchCount} verified external matches</span>
          </div>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Review Assets In Group</h2>
            <div style={assetGridStyle}>
              {currentGroup.assets.map((item) => {
                const selected = selectedDiscardIds.includes(item.asset.id);
                return (
                  <article
                    key={item.asset.id}
                    style={{
                      ...assetCardStyle,
                      ...(selected ? selectedAssetCardStyle : {})
                    }}
                  >
                    <img
                      src={getDisplayMediaUrl(item.asset.id)}
                      alt={item.asset.filename}
                      style={imageStyle}
                    />
                    <div style={badgeRowStyle}>
                      <span style={badgeStyle}>{item.asset.photoState}</span>
                      <span style={badgeStyle}>{formatDimensions(item.asset.width, item.asset.height)}</span>
                      <span style={badgeStyle}>{item.basenameMatchedSidecarCount} basename matches</span>
                      <span style={badgeStyle}>{item.verifiedMatchCount} verified matches</span>
                      {item.possibleUnconfirmedDuplicate ? (
                        <span style={badgeStyle}>Possible Unconfirmed Duplicate</span>
                      ) : null}
                    </div>
                    <div style={infoGridStyle}>
                      <span style={labelStyle}>Filename</span>
                      <span>{item.asset.filename}</span>
                      <span style={labelStyle}>Captured</span>
                      <span>{item.asset.captureDateTime ?? 'Unknown'}</span>
                      <span style={labelStyle}>Path</span>
                      <span>{item.asset.originalArchivePath}</span>
                      <span style={labelStyle}>Asset ID</span>
                      <span>{item.asset.id}</span>
                    </div>
                    <button
                      type="button"
                      style={selected ? dangerButtonStyle : primaryButtonStyle}
                      onClick={() => toggleSelectedDiscard(item.asset.id)}
                      disabled={busy}
                    >
                      {selected ? 'Selected To Discard' : 'Select To Discard'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>All Matching Tedography Assets</h2>
            <div style={assetGridStyle}>
              {currentGroup.relatedTedographyAssets.map((item) => {
                const selected = selectedDiscardIds.includes(item.asset.id);
                const isReviewAsset = currentGroup.assets.some((reviewItem) => reviewItem.asset.id === item.asset.id);
                return (
                  <article
                    key={`related:${item.asset.id}`}
                    style={{
                      ...assetCardStyle,
                      ...(selected ? selectedAssetCardStyle : {})
                    }}
                  >
                    <img
                      src={getDisplayMediaUrl(item.asset.id)}
                      alt={item.asset.filename}
                      style={imageStyle}
                    />
                    <div style={badgeRowStyle}>
                      <span style={badgeStyle}>{item.asset.photoState}</span>
                      <span style={badgeStyle}>{formatDimensions(item.asset.width, item.asset.height)}</span>
                      {isReviewAsset ? <span style={badgeStyle}>In Review Set</span> : null}
                      {item.possibleUnconfirmedDuplicate ? (
                        <span style={badgeStyle}>Possible Unconfirmed Duplicate</span>
                      ) : null}
                    </div>
                    <div style={infoGridStyle}>
                      <span style={labelStyle}>Filename</span>
                      <span>{item.asset.filename}</span>
                      <span style={labelStyle}>Captured</span>
                      <span>{item.asset.captureDateTime ?? 'Unknown'}</span>
                      <span style={labelStyle}>Path</span>
                      <span>{item.asset.originalArchivePath}</span>
                      <span style={labelStyle}>Asset ID</span>
                      <span>{item.asset.id}</span>
                    </div>
                    <button
                      type="button"
                      style={selected ? dangerButtonStyle : primaryButtonStyle}
                      onClick={() => toggleSelectedDiscard(item.asset.id)}
                      disabled={busy}
                    >
                      {selected ? 'Selected To Discard' : 'Select To Discard'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Shared Verified Matches</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {currentGroup.sharedVerifiedMatches.map((match) => (
                <article key={match.sidecarPath} style={matchCardStyle}>
                  <div style={badgeRowStyle}>
                    <span style={badgeStyle}>Verified</span>
                    <span style={badgeStyle}>
                      {match.hasStructuredPhotoTakenTime ? 'Has photoTakenTime' : 'No photoTakenTime'}
                    </span>
                    {match.hasExactUnknownCapturePhotoTakenTime ? (
                      <span style={badgeStyle}>Exact Unknown Value</span>
                    ) : null}
                  </div>
                  <div style={infoGridStyle}>
                    <span style={labelStyle}>Sidecar</span>
                    <span>{match.sidecarPath}</span>
                    <span style={labelStyle}>Media</span>
                    <span>{match.mediaPath ?? 'Not found'}</span>
                    <span style={labelStyle}>Dimensions</span>
                    <span>{formatDimensions(match.mediaWidth, match.mediaHeight)}</span>
                    <span style={labelStyle}>photoTakenTime</span>
                    <span>{formatPhotoTakenTime(match.photoTakenTime)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
