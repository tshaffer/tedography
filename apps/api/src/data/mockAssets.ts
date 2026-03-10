import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

export const mockAssets: MediaAsset[] = [
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
