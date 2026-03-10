import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PhotoState, type MediaAsset } from '@tedography/domain';

type AssetFilter = 'All' | PhotoState;

const filterOptions: AssetFilter[] = [
  'All',
  PhotoState.Unreviewed,
  PhotoState.Pending,
  PhotoState.Select,
  PhotoState.Reject
];

const pageStyle: CSSProperties = {
  fontFamily: 'Arial, sans-serif',
  margin: '24px auto',
  maxWidth: '1100px',
  padding: '0 16px'
};

const controlsStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  marginBottom: '16px'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
};

const cardStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '8px',
  overflow: 'hidden',
  backgroundColor: '#fff'
};

const imageStyle: CSSProperties = {
  aspectRatio: '3 / 2',
  backgroundColor: '#f1f1f1',
  display: 'block',
  objectFit: 'cover',
  width: '100%'
};

const cardBodyStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '10px'
};

function formatCaptureDate(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return parsed.toLocaleString();
}

function AssetCard({ asset }: { asset: MediaAsset }) {
  return (
    <article style={cardStyle}>
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt={asset.filename} style={imageStyle} loading="lazy" />
      ) : (
        <div style={imageStyle} />
      )}
      <div style={cardBodyStyle}>
        <strong>{asset.filename}</strong>
        <span>State: {asset.photoState}</span>
        <span>Type: {asset.mediaType}</span>
        <span>Captured: {formatCaptureDate(asset.captureDateTime)}</span>
      </div>
    </article>
  );
}

export default function App() {
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetFilter>('All');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.status === 'string') {
          setHealthStatus(data.status);
          return;
        }
        setHealthStatus(data.ok ? 'ok' : 'error');
      })
      .catch(() => setHealthStatus('error'));
  }, []);

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Request failed with status ${r.status}`);
        }
        return r.json() as Promise<MediaAsset[]>;
      })
      .then((data) => {
        setAssets(data);
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          setAssetsError(error.message);
          return;
        }
        setAssetsError('Unknown error');
      })
      .finally(() => {
        setAssetsLoading(false);
      });
  }, []);

  const filteredAssets = useMemo(() => {
    if (filter === 'All') {
      return assets;
    }

    return assets.filter((asset) => asset.photoState === filter);
  }, [assets, filter]);

  return (
    <div style={pageStyle}>
      <h1>Tedography</h1>
      <p>API status: {healthStatus}</p>

      <div style={controlsStyle}>
        <label htmlFor="asset-filter">Photo state:</label>
        <select
          id="asset-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AssetFilter)}
        >
          {filterOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {assetsLoading ? <p>Loading assets...</p> : null}
      {assetsError ? <p>Failed to load assets: {assetsError}</p> : null}
      {!assetsLoading && !assetsError ? (
        filteredAssets.length > 0 ? (
          <div style={gridStyle}>
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        ) : (
          <p>No assets match this filter.</p>
        )
      ) : null}
    </div>
  );
}
