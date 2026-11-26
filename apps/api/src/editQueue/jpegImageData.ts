import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

// Lightroom writes metadata (XMP, IPTC) into a JPEG without re-encoding it, so a
// catalogued working copy stops being byte-identical to its original while the
// picture itself is unchanged. Comparing everything except the metadata segments
// still proves which picture a file holds.

const START_OF_IMAGE = 0xd8;
const START_OF_SCAN = 0xda;
const COMMENT = 0xfe;
const FIRST_APP = 0xe0;
const LAST_APP = 0xef;

/** Markers that carry no length, or have no business appearing before the image data. */
function isUnexpectedMarker(marker: number): boolean {
  return marker <= 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

/**
 * SHA-256 of a JPEG's picture: every segment other than metadata (APPn and
 * comments), then everything from the first scan to the end of the file. Null if
 * the bytes are not a JPEG that can be walked as far as its image data.
 */
export function jpegImageDigest(data: Buffer): string | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== START_OF_IMAGE) {
    return null;
  }
  const hash = createHash('sha256');
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      return null;
    }
    const marker = data[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (isUnexpectedMarker(marker)) {
      return null;
    }
    const length = data.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > data.length) {
      return null;
    }
    if (marker === START_OF_SCAN) {
      hash.update(data.subarray(offset));
      return hash.digest('hex');
    }
    const isMetadata = marker === COMMENT || (marker >= FIRST_APP && marker <= LAST_APP);
    if (!isMetadata) {
      hash.update(data.subarray(offset, end));
    }
    offset = end;
  }
  return null;
}

const JPEG_EXTENSION = /\.jpe?g$/i;

/** True only when both files are readable as JPEGs and hold the same picture. */
export async function isSameJpegPicture(originalPath: string, candidatePath: string): Promise<boolean> {
  if (!JPEG_EXTENSION.test(originalPath) || !JPEG_EXTENSION.test(candidatePath)) {
    return false;
  }
  const original = jpegImageDigest(await fs.readFile(originalPath));
  return original != null && original === jpegImageDigest(await fs.readFile(candidatePath));
}
