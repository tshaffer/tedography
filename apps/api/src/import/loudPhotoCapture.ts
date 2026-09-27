import fs from 'node:fs/promises';

/**
 * A LoudPhoto capture's metadata.json sidecar, as written by the app's
 * CaptureExporter when a photo + linked audio pair is exported and
 * AirDropped/Messaged over. `photoFilename`/`audioFilename` reflect the
 * app's own internal storage names, not the exported basenames on disk —
 * they're informational only. Pairing here goes strictly by co-located
 * basename (photo.ext + photo.json + photo.m4a sharing one name), which is
 * robust regardless of what those two fields say.
 */
interface LoudPhotoSidecar {
  id: string;
  photoFilename: string;
  configuredDurationSeconds: number;
  audioDurationSeconds?: number | null;
  audioFilename?: string | null;
}

function isLoudPhotoSidecar(value: unknown): value is LoudPhotoSidecar {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.photoFilename === 'string' &&
    typeof record.configuredDurationSeconds === 'number'
  );
}

function stripExtension(path: string): string {
  return path.replace(/\.[^./\\]+$/, '');
}

export interface LoudPhotoCaptureMatch {
  audioAbsolutePath: string;
  audioRelativePath: string;
  audioFileFormat: string;
  audioDurationSeconds: number | null;
}

/**
 * Given an already-confirmed-supported photo file, checks whether it's part
 * of a LoudPhoto capture bundle — i.e. a co-located `<basename>.json`
 * sidecar with LoudPhoto's shape, plus a co-located `<basename>.m4a` audio
 * file. Returns null for an ordinary photo (including one with an
 * AI-edit sidecar, which has a different shape).
 */
export async function findLoudPhotoCaptureMatch(input: {
  photoAbsolutePath: string;
  photoRelativePath: string;
}): Promise<LoudPhotoCaptureMatch | null> {
  const sidecarAbsolutePath = `${stripExtension(input.photoAbsolutePath)}.json`;

  let parsedSidecar: unknown;
  try {
    const raw = await fs.readFile(sidecarAbsolutePath, 'utf-8');
    parsedSidecar = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isLoudPhotoSidecar(parsedSidecar)) {
    return null;
  }

  const audioAbsolutePath = `${stripExtension(input.photoAbsolutePath)}.m4a`;
  const audioStat = await fs.stat(audioAbsolutePath).catch(() => null);
  if (!audioStat || !audioStat.isFile()) {
    return null;
  }

  return {
    audioAbsolutePath,
    audioRelativePath: `${stripExtension(input.photoRelativePath)}.m4a`,
    audioFileFormat: 'm4a',
    audioDurationSeconds:
      typeof parsedSidecar.audioDurationSeconds === 'number' ? parsedSidecar.audioDurationSeconds : null
  };
}

/** The sidecar and audio file paths a matched capture consumes, so callers
 * can exclude them from showing up as their own (unsupported) scan entries. */
export function getLoudPhotoCaptureConsumedRelativePaths(input: {
  photoRelativePath: string;
  audioRelativePath: string;
}): string[] {
  return [`${stripExtension(input.photoRelativePath)}.json`, input.audioRelativePath];
}
