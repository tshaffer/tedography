import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

function createMockAsset(input: {
  id: string;
  filename: string;
  mediaType: MediaType;
  photoState: PhotoState;
  captureDateTime: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}): MediaAsset {
  return {
    id: input.id,
    filename: input.filename,
    mediaType: input.mediaType,
    photoState: input.photoState,
    captureDateTime: input.captureDateTime,
    width: input.width,
    height: input.height,
    importedAt: '2026-01-01T00:00:00.000Z',
    originalStorageRootId: 'mock-media',
    originalArchivePath: input.thumbnailUrl.replace('/media/', 'mock-media/'),
    originalFileSizeBytes: 0,
    originalContentHash: `mock-hash-${input.id}`,
    originalFileFormat: 'jpg',
    displayStorageType: 'archive-root',
    displayStorageRootId: 'mock-media',
    displayArchivePath: input.thumbnailUrl.replace('/media/', 'mock-media/'),
    displayDerivedPath: null,
    displayFileFormat: 'jpg',
    thumbnailUrl: input.thumbnailUrl
  };
}

export const mockAssets: MediaAsset[] = [
  createMockAsset({
    id: 'asset-1',
    filename: '2025-08-17-yosemite-valley-001.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.New,
    captureDateTime: '2025-08-17T15:24:00.000Z',
    thumbnailUrl: '/media/IMG_3284.JPG',
    width: 4032,
    height: 3024
  }),
  createMockAsset({
    id: 'asset-2',
    filename: '2025-08-17-yosemite-valley-002.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Pending,
    captureDateTime: '2025-08-17T15:31:00.000Z',
    thumbnailUrl: '/media/IMG_3285.JPG',
    width: 4032,
    height: 3024
  }),
  createMockAsset({
    id: 'asset-3',
    filename: '2025-08-17-yosemite-valley-003.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Keep,
    captureDateTime: '2025-08-17T15:44:00.000Z',
    thumbnailUrl: '/media/IMG_3286.JPG',
    width: 4032,
    height: 3024
  }),
  createMockAsset({
    id: 'asset-4',
    filename: '2025-08-17-waterfall-pan.mp4',
    mediaType: MediaType.Video,
    photoState: PhotoState.Discard,
    captureDateTime: '2025-08-17T16:02:00.000Z',
    thumbnailUrl: '/media/IMG_3287.JPG',
    width: 3024,
    height: 5032
  }),
  createMockAsset({
    id: 'asset-5',
    filename: '2025-09-03-family-hike-014.jpg',
    mediaType: MediaType.Photo,
    photoState: PhotoState.Keep,
    captureDateTime: '2025-09-03T19:18:00.000Z',
    thumbnailUrl: '/media/IMG_3321.PNG',
    width: 1206,
    height: 2622
  })
];
