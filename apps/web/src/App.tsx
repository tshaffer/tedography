import { useEffect, useState } from 'react';
import type { MediaAsset } from '@tedography/domain';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('loading');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(data => {
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

  return (
    <div>
      <h1>Tedography</h1>
      <p>API status: {healthStatus}</p>

      <h2>Assets</h2>
      {assetsLoading ? <p>Loading assets...</p> : null}
      {assetsError ? <p>Failed to load assets: {assetsError}</p> : null}
      {!assetsLoading && !assetsError ? (
        <ul>
          {assets.map((asset) => (
            <li key={asset.id}>
              <strong>{asset.filename}</strong> | {asset.mediaType} | {asset.photoState} |{' '}
              {asset.captureDateTime}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
