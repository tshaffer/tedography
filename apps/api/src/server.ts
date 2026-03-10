import cors from 'cors';
import express, { type Express } from 'express';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

const mockAssets: MediaAsset[] = [
  {
    id: 'asset-1',
    filename: '2025-08-17-yosemite-valley-001.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Unreviewed,
    captureDateTime: '2025-08-17T15:24:00.000Z',
    thumbnailUrl: 'https://picsum.photos/id/1025/480/320',
    width: 6000,
    height: 4000
  },
  {
    id: 'asset-2',
    filename: '2025-08-17-yosemite-valley-002.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Pending,
    captureDateTime: '2025-08-17T15:31:00.000Z',
    thumbnailUrl: 'https://picsum.photos/id/1036/480/320',
    width: 6016,
    height: 4016
  },
  {
    id: 'asset-3',
    filename: '2025-08-17-yosemite-valley-003.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Select,
    captureDateTime: '2025-08-17T15:44:00.000Z',
    thumbnailUrl: 'https://picsum.photos/id/1043/480/320',
    width: 6048,
    height: 4024
  },
  {
    id: 'asset-4',
    filename: '2025-08-17-waterfall-pan.mp4',
    mediaType: MediaType.Video,
    photoState: PhotoState.Reject,
    captureDateTime: '2025-08-17T16:02:00.000Z',
    thumbnailUrl: 'https://picsum.photos/id/1069/480/320',
    width: 3840,
    height: 2160
  },
  {
    id: 'asset-5',
    filename: '2025-09-03-family-hike-014.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Select,
    captureDateTime: '2025-09-03T19:18:00.000Z',
    thumbnailUrl: 'https://picsum.photos/id/1074/480/320',
    width: 5472,
    height: 3648
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
