import cors from 'cors';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockMediaDir = path.resolve(__dirname, '../mock-media');

const mockAssets: MediaAsset[] = [
  {
    id: 'asset-1',
    filename: '2025-08-17-yosemite-valley-001.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Unreviewed,
    captureDateTime: '2025-08-17T15:24:00.000Z',
    thumbnailUrl: '/media/IMG_3284.JPG',
    width: 4032,
    height: 3024
  },
  {
    id: 'asset-2',
    filename: '2025-08-17-yosemite-valley-002.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Pending,
    captureDateTime: '2025-08-17T15:31:00.000Z',
    thumbnailUrl: '/media/IMG_3285.JPG',
    width: 4032,
    height: 3024
  },
  {
    id: 'asset-3',
    filename: '2025-08-17-yosemite-valley-003.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Select,
    captureDateTime: '2025-08-17T15:44:00.000Z',
    thumbnailUrl: '/media/IMG_3286.JPG',
    width: 4032,
    height: 3024
  },
  {
    id: 'asset-4',
    filename: '2025-08-17-waterfall-pan.mp4',
    mediaType: MediaType.Video,
    photoState: PhotoState.Reject,
    captureDateTime: '2025-08-17T16:02:00.000Z',
    thumbnailUrl: '/media/IMG_3287.JPG',
    width: 3024,
    height: 5032
  },
  {
    id: 'asset-5',
    filename: '2025-09-03-family-hike-014.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Select,
    captureDateTime: '2025-09-03T19:18:00.000Z',
    thumbnailUrl: '/media/IMG_3321.PNG',
    width: 1206,
    height: 2622
  }
];

function parsePhotoState(value: unknown): PhotoState | null {
  if (typeof value !== 'string') {
    return null;
  }

  const validStates = Object.values(PhotoState);
  if (!validStates.includes(value as PhotoState)) {
    return null;
  }

  return value as PhotoState;
}

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/media', express.static(mockMediaDir));

  app.get('/api/health', (_req, res) => {
    // Keep both fields for backward compatibility across frontend iterations.
    console.log('[src] Health check received');
    res.json({ ok: true, status: 'ok', service: 'tedography-api' });
  });

  app.get('/api/assets', (_req, res) => {
    res.json(mockAssets);
  });

  app.patch('/api/assets/:id/photoState', (req, res) => {
    const photoState = parsePhotoState((req.body as { photoState?: unknown }).photoState);
    if (!photoState) {
      res.status(400).json({ error: 'photoState must be one of Unreviewed, Pending, Select, Reject' });
      return;
    }

    const asset = mockAssets.find((candidate) => candidate.id === req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    asset.photoState = photoState;
    res.json(asset);
  });

  return app;
}
