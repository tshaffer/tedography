import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getAssetFileStat } from '../../api/assetApi';

const POLL_MS = 1500;

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1500,
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#1e1e1e',
  border: '1px solid #3a3a3a',
  borderRadius: '10px',
  padding: '24px 28px',
  maxWidth: '360px',
  width: '100%',
  color: '#f0f0f0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const titleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  margin: '0 0 8px',
};

const bodyStyle: CSSProperties = {
  fontSize: '13px',
  color: '#bbb',
  margin: '0 0 20px',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end',
};

const cancelBtnStyle: CSSProperties = {
  backgroundColor: '#2a2a2a',
  border: '1px solid #555',
  color: '#ccc',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '7px 14px',
};

const confirmBtnStyle: CSSProperties = {
  backgroundColor: '#2d6a4f',
  border: '1px solid #40916c',
  color: '#d8f3dc',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '7px 14px',
  fontWeight: 500,
};

type CropWatcherProps = {
  assetId: string;
  baselineMtime: number;
  onReimport: () => void;
  onCancel: () => void;
};

export function CropWatcher({ assetId, baselineMtime, onReimport, onCancel }: CropWatcherProps) {
  const [changed, setChanged] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (changed) {
      return;
    }

    intervalRef.current = window.setInterval(async () => {
      try {
        const stat = await getAssetFileStat(assetId);
        if (stat.mtimeMs > baselineMtime) {
          setChanged(true);
        }
      } catch {
        // ignore transient poll errors
      }
    }, POLL_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [assetId, baselineMtime, changed]);

  if (!changed) {
    return null;
  }

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <p style={titleStyle}>Apply crop?</p>
        <p style={bodyStyle}>
          Preview has saved changes to this photo. Reimport to apply the crop, or discard to leave
          it unchanged.
        </p>
        <div style={actionsStyle}>
          <button type="button" style={cancelBtnStyle} onClick={onCancel}>
            Discard
          </button>
          <button type="button" style={confirmBtnStyle} onClick={onReimport}>
            Reimport
          </button>
        </div>
      </div>
    </div>
  );
}
