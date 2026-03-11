import { createHash } from 'node:crypto';
import fs from 'node:fs';

export async function computeSha256ForFile(absolutePath: string): Promise<string> {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(absolutePath);

    stream.on('error', reject);
    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    stream.on('end', () => {
      resolve();
    });
  });

  return hash.digest('hex');
}
