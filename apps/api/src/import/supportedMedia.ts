import path from 'node:path';
import { MediaType } from '@tedography/domain';

const photoExtensions = new Set(['.jpg', '.jpeg', '.png', '.heic', '.nef', '.dng', '.tif', '.tiff']);
const videoExtensions = new Set(['.mov', '.mp4', '.m4v']);

export function getMediaSupport(filename: string): {
  extension: string | null;
  isSupportedMedia: boolean;
  mediaType: MediaType | 'Unknown';
} {
  const extension = path.extname(filename).toLowerCase();
  const normalizedExtension = extension.length > 0 ? extension : null;

  if (normalizedExtension && photoExtensions.has(normalizedExtension)) {
    return {
      extension: normalizedExtension,
      isSupportedMedia: true,
      mediaType: MediaType.Photo
    };
  }

  if (normalizedExtension && videoExtensions.has(normalizedExtension)) {
    return {
      extension: normalizedExtension,
      isSupportedMedia: true,
      mediaType: MediaType.Video
    };
  }

  return {
    extension: normalizedExtension,
    isSupportedMedia: false,
    mediaType: 'Unknown'
  };
}

export function isIgnorableFileName(name: string): boolean {
  if (name === '.DS_Store') {
    return true;
  }

  if (name.startsWith('._')) {
    return true;
  }

  if (name.startsWith('.')) {
    return true;
  }

  return false;
}
