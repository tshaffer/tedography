import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  PRESENTATION_CHANNEL_NAME,
  type PresentationMessage,
} from '../../utilities/presentationChannel.js';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls.js';

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const imgStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  userSelect: 'none',
};

const waitingStyle: CSSProperties = {
  color: '#555',
  fontFamily: 'Arial, sans-serif',
  fontSize: '18px',
  textAlign: 'center',
};

export function PresentationPage() {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(PRESENTATION_CHANNEL_NAME);
    channelRef.current = channel;

    channel.addEventListener('message', (event: MessageEvent<PresentationMessage>) => {
      const msg = event.data;
      if (msg.type === 'photo') {
        setAssetId(msg.assetId);
        setVersion(msg.version ?? null);
      } else if (msg.type === 'current') {
        if (msg.assetId) {
          setAssetId(msg.assetId);
          setVersion(msg.version ?? null);
        }
      } else if (msg.type === 'clear') {
        setAssetId(null);
        setVersion(null);
      }
    });

    // Ask the main window for its current state.
    channel.postMessage({ type: 'hello' } satisfies PresentationMessage);

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = 'Tedography — Presentation';
  }, []);

  const src = assetId ? getDisplayMediaUrl(assetId, version) : null;

  return (
    <div style={rootStyle}>
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          style={imgStyle}
          draggable={false}
        />
      ) : (
        <div style={waitingStyle}>
          Waiting for Tedography…
          <br />
          <span style={{ fontSize: '13px', color: '#444', marginTop: '8px', display: 'block' }}>
            Select a photo in the main window to display it here.
          </span>
        </div>
      )}
    </div>
  );
}
