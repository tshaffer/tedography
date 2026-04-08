import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PhotoState } from '@tedography/domain';
import type { ListUnknownCaptureReviewItemsResponse } from '@tedography/shared';
import { listUnknownCaptureReviewItems, updateAssetPhotoState } from '../../api/assetApi';
import { getDisplayMediaUrl, getThumbnailMediaUrl } from '../../utilities/mediaUrls';

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

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 1.2fr) minmax(340px, 0.8fr)',
  gap: '16px',
  alignItems: 'start'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '14px'
};

const imageStyle: CSSProperties = {
  width: '100%',
  maxHeight: '70vh',
  objectFit: 'contain',
  borderRadius: '8px',
  backgroundColor: '#f7f7f7'
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: '8px',
  fontSize: '13px'
};

const labelStyle: CSSProperties = {
  color: '#666',
  fontWeight: 600
};

const matchCardStyle: CSSProperties = {
  border: '1px solid #e3e3e3',
  borderRadius: '8px',
  padding: '10px',
  display: 'grid',
  gap: '8px'
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

function formatDimensions(width: number | null | undefined, height: number | null | undefined): string {
  return typeof width === 'number' && typeof height === 'number' ? `${width} × ${height}` : '—';
}

function formatPhotoTakenTime(value: unknown): string {
  if (!value) {
    return '—';
  }
  return JSON.stringify(value);
}

export function UnknownCaptureReviewPage() {
  const [data, setData] = useState<ListUnknownCaptureReviewItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
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
          setCurrentIndex(0);
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

  const items = data?.items ?? [];
  const currentItem = items[currentIndex] ?? null;

  const summary = useMemo(() => {
    const possibleUnconfirmed = items.filter((item) => item.possibleUnconfirmedDuplicate).length;
    const ambiguousVerified = items.filter((item) => item.verifiedMatchCount > 1).length;
    return { possibleUnconfirmed, ambiguousVerified };
  }, [items]);

  async function handleDiscard(): Promise<void> {
    if (!currentItem) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await updateAssetPhotoState(currentItem.asset.id, PhotoState.Discard);
      setData((previous) => {
        if (!previous) {
          return previous;
        }

        const nextItems = previous.items.filter((item) => item.asset.id !== currentItem.asset.id);
        return {
          ...previous,
          itemCount: nextItems.length,
          items: nextItems
        };
      });
      setCurrentIndex((previous) => {
        const nextLength = Math.max(0, items.length - 1);
        return Math.min(previous, Math.max(0, nextLength - 1));
      });
      setNotice(`Discarded ${currentItem.asset.filename}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update photo state');
    } finally {
      setBusy(false);
    }
  }

  function handleKeepAsIs(): void {
    setNotice(null);
    setCurrentIndex((previous) => Math.min(previous + 1, Math.max(0, items.length - 1)));
  }

  return (
    <main style={pageStyle}>
      <div style={toolbarStyle}>
        <Link to="/">Back to Library</Link>
        <strong>Unknown Capture Review</strong>
        {data ? <span>{data.itemCount} items</span> : null}
        {data ? <span>{summary.ambiguousVerified} with multiple verified matches</span> : null}
        {data ? <span>{summary.possibleUnconfirmed} possible unconfirmed duplicates</span> : null}
      </div>

      {loading ? <p>Loading review items...</p> : null}
      {errorMessage ? <p style={{ color: '#b00020' }}>{errorMessage}</p> : null}
      {notice ? <p style={{ color: '#0f5132' }}>{notice}</p> : null}

      {!loading && !currentItem ? <p>No review items found.</p> : null}

      {currentItem ? (
        <>
          <div style={toolbarStyle}>
            <button
              type="button"
              style={currentIndex > 0 ? buttonStyle : disabledButtonStyle}
              onClick={() => setCurrentIndex((previous) => Math.max(0, previous - 1))}
              disabled={currentIndex === 0 || busy}
            >
              Previous
            </button>
            <button
              type="button"
              style={!busy ? buttonStyle : disabledButtonStyle}
              onClick={handleKeepAsIs}
              disabled={busy || currentIndex >= items.length - 1}
            >
              Keep As-Is / Next
            </button>
            <button
              type="button"
              style={!busy ? primaryButtonStyle : disabledButtonStyle}
              onClick={() => {
                void handleDiscard();
              }}
              disabled={busy}
            >
              {busy ? 'Discarding...' : 'Discard'}
            </button>
            <span>
              Item {currentIndex + 1} / {items.length}
            </span>
          </div>

          <div style={layoutStyle}>
            <section style={panelStyle}>
              <img
                src={getDisplayMediaUrl(currentItem.asset.id)}
                alt={currentItem.asset.filename}
                style={imageStyle}
              />
            </section>

            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, marginBottom: '12px' }}>{currentItem.asset.filename}</h2>
              <div style={infoGridStyle}>
                <span style={labelStyle}>Asset ID</span>
                <span>{currentItem.asset.id}</span>
                <span style={labelStyle}>Photo State</span>
                <span>{currentItem.asset.photoState}</span>
                <span style={labelStyle}>Captured</span>
                <span>{currentItem.asset.captureDateTime ?? 'Unknown'}</span>
                <span style={labelStyle}>Dimensions</span>
                <span>{formatDimensions(currentItem.asset.width, currentItem.asset.height)}</span>
                <span style={labelStyle}>Archive Path</span>
                <span>{currentItem.asset.originalArchivePath}</span>
                <span style={labelStyle}>Basename Matches</span>
                <span>{currentItem.basenameMatchedSidecarCount}</span>
                <span style={labelStyle}>Verified Matches</span>
                <span>{currentItem.verifiedMatchCount}</span>
                <span style={labelStyle}>Possible Unconfirmed Duplicate</span>
                <span>{currentItem.possibleUnconfirmedDuplicate ? 'Yes' : 'No'}</span>
              </div>
            </section>
          </div>

          <section style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Matched Sidecars</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {currentItem.matches.map((match) => (
                <article key={`${currentItem.asset.id}:${match.sidecarPath}`} style={matchCardStyle}>
                  <div style={badgeRowStyle}>
                    <span style={badgeStyle}>{match.verifiedDimensions ? 'Verified' : 'Basename Only'}</span>
                    <span style={badgeStyle}>
                      {match.hasStructuredPhotoTakenTime ? 'Has photoTakenTime' : 'No photoTakenTime'}
                    </span>
                    {match.hasExactUnknownCapturePhotoTakenTime ? (
                      <span style={badgeStyle}>Exact Unknown Value</span>
                    ) : null}
                  </div>
                  <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                    <div><strong>Sidecar:</strong> {match.sidecarPath}</div>
                    <div><strong>Media:</strong> {match.mediaPath ?? 'Not found'}</div>
                    <div><strong>Media Dimensions:</strong> {formatDimensions(match.mediaWidth, match.mediaHeight)}</div>
                    <div><strong>photoTakenTime:</strong> {formatPhotoTakenTime(match.photoTakenTime)}</div>
                  </div>
                  {match.mediaPath ? (
                    <img
                      src={getThumbnailMediaUrl(currentItem.asset.id)}
                      alt={currentItem.asset.filename}
                      style={{ width: '120px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
