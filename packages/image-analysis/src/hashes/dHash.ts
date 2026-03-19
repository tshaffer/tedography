import { normalizeImage } from '../normalize/normalizeImage.js';

function toHexFromBits(bits: string): string {
  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return hex;
}

export async function computeDHash(filePath: string): Promise<string> {
  const normalized = await normalizeImage(filePath, 9, 8);
  let bits = '';

  for (let row = 0; row < normalized.height; row += 1) {
    for (let column = 0; column < normalized.width - 1; column += 1) {
      const left = normalized.pixels[row * normalized.width + column];
      const right = normalized.pixels[row * normalized.width + column + 1];
      if (left === undefined || right === undefined) {
        throw new Error('Normalized pixel data was incomplete while computing dHash.');
      }
      bits += left > right ? '1' : '0';
    }
  }

  return toHexFromBits(bits);
}
