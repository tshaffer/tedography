import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { PhotoState } from '@tedography/domain';
import type { FindSimilarAssetsResponse } from '@tedography/shared';
import { getThumbnailMediaUrl } from '../../utilities/mediaUrls';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1200
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  width: 'min(1080px, 96vw)',
  maxHeight: 'min(88vh, 900px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '16px'
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px'
};

const bodyStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: '12px',
  overflow: 'auto'
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap'
};

const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontSize: '12px',
  color: '#444'
};

const inputStyle: CSSProperties = {
  border: '1px solid #cfcfcf',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '13px'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const resultsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '12px'
};

const cardStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  overflow: 'hidden',
  backgroundColor: '#fff'
};

const thumbStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  backgroundColor: '#f0f0f0'
};

const cardBodyStyle: CSSProperties = {
  padding: '10px',
  display: 'grid',
  gap: '6px',
  fontSize: '12px'
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: '#666',
  fontSize: '12px'
};

type SimilarAssetsDialogProps = {
  open: boolean;
  assetId: string | null;
  assetFilename: string | null;
  loading: boolean;
  result: FindSimilarAssetsResponse | null;
  errorMessage: string | null;
  onClose: () => void;
  onRun: (input: { limit: number; photoState?: PhotoState }) => void;
};

const photoStateOptions: Array<{ label: string; value: 'all' | PhotoState }> = [
  { label: 'Discard', value: PhotoState.Discard },
  { label: 'All', value: 'all' },
  { label: 'Keep', value: PhotoState.Keep },
  { label: 'Pending', value: PhotoState.Pending },
  { label: 'New', value: PhotoState.New }
];

export function SimilarAssetsDialog({
  open,
  assetId,
  assetFilename,
  loading,
  result,
  errorMessage,
  onClose,
  onRun
}: SimilarAssetsDialogProps): ReactElement | null {
  const [limit, setLimit] = useState('12');
  const [photoStateSelection, setPhotoStateSelection] = useState<'all' | PhotoState>(PhotoState.Discard);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLimit('12');
    setPhotoStateSelection(PhotoState.Discard);
  }, [open]);

  if (!open || !assetId) {
    return null;
  }

  const parsedLimit = Number.parseInt(limit, 10);
  const canRun = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 && !loading;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Find Similar Photos</h2>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
              Search for similar photos to <strong>{assetFilename ?? assetId}</strong>.
            </p>
          </div>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={bodyStyle}>
          <div style={controlsStyle}>
            <label style={fieldLabelStyle}>
              <span>Photo state</span>
              <select
                value={photoStateSelection}
                style={inputStyle}
                onChange={(event) => setPhotoStateSelection(event.target.value as 'all' | PhotoState)}
              >
                {photoStateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldLabelStyle}>
              <span>Limit</span>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                style={{ ...inputStyle, width: '84px' }}
                onChange={(event) => setLimit(event.target.value)}
              />
            </label>

            <div style={{ alignSelf: 'end' }}>
              <button
                type="button"
                style={canRun ? buttonStyle : disabledButtonStyle}
                disabled={!canRun}
                onClick={() =>
                  onRun({
                    limit: parsedLimit,
                    ...(photoStateSelection !== 'all' ? { photoState: photoStateSelection } : {})
                  })
                }
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {errorMessage ? <p style={{ ...mutedTextStyle, color: '#b00020' }}>{errorMessage}</p> : null}

          {result ? (
            <p style={mutedTextStyle}>
              Returned {result.items.length} similar photo{result.items.length === 1 ? '' : 's'} from{' '}
              {result.totalCandidatesConsidered} candidate photo{result.totalCandidatesConsidered === 1 ? '' : 's'}
              {result.photoStateFilter ? ` with state ${result.photoStateFilter}` : ''}.
            </p>
          ) : (
            <p style={mutedTextStyle}>Run a search to load similar photos.</p>
          )}

          {result && result.items.length > 0 ? (
            <div style={resultsGridStyle}>
              {result.items.map((item) => (
                <article key={item.asset.id} style={cardStyle}>
                  <img
                    src={getThumbnailMediaUrl(item.asset.id)}
                    alt={item.asset.filename}
                    style={thumbStyle}
                  />
                  <div style={cardBodyStyle}>
                    <div style={titleStyle} title={item.asset.filename}>
                      {item.asset.filename}
                    </div>
                    <div>Score: {item.score.toFixed(4)}</div>
                    <div>Class: {item.classification}</div>
                    <div>State: {item.asset.photoState ?? 'Unknown'}</div>
                    <div style={mutedTextStyle} title={item.asset.originalArchivePath ?? item.asset.filename}>
                      {item.asset.originalArchivePath ?? item.asset.filename}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
