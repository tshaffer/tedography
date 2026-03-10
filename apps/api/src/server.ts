import cors from 'cors';
import express, { type Express } from 'express';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

const mockAssets: MediaAsset[] = [
  {
    id: 'asset-1',
    filename: 'IMG_1001.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Unreviewed,
    captureDateTime: '2025-07-04T16:20:00.000Z'
  },
  {
    id: 'asset-2',
    filename: 'IMG_1002.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Select,
    captureDateTime: '2025-09-14T08:45:00.000Z'
  },
  {
    id: 'asset-3',
    filename: 'VID_2001.mp4',
    mediaType: MediaType.Video,
    photoState: PhotoState.Pending,
    captureDateTime: '2025-11-21T22:10:00.000Z'
  }
];

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    // Keep both fields for backward compatibility across frontend iterations.
    console.log('[src] Health check received');
    res.json({ ok: true, status: 'ok', service: 'tedography-api' });
  });

  app.get('/api/assets', (_req, res) => {
    res.json(mockAssets);
  });

  return app;
}
