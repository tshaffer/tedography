import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';

export interface GenerateThumbnailInput {
  sourceAbsolutePath: string;
  targetAbsolutePath: string;
}

const THUMBNAIL_MAX_BOUND = 400;

function runSipsThumbnail(
  sourceAbsolutePath: string,
  targetAbsolutePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // v1: use macOS sips for a small maintainable thumbnail pipeline.
    execFile(
      'sips',
      [
        '-s',
        'format',
        'jpeg',
        '-Z',
        String(THUMBNAIL_MAX_BOUND),
        sourceAbsolutePath,
        '--out',
        targetAbsolutePath
      ],
      (error, _stdout, stderr) => {
        if (error) {
          const stderrMessage = stderr?.trim();
          reject(
            new Error(
              stderrMessage.length > 0
                ? `Thumbnail generation failed: ${stderrMessage}`
                : `Thumbnail generation failed: ${error.message}`
            )
          );
          return;
        }

        resolve();
      }
    );
  });
}

async function hasReusableTarget(targetAbsolutePath: string): Promise<boolean> {
  try {
    const targetStat = await fs.stat(targetAbsolutePath);
    return targetStat.isFile() && targetStat.size > 0;
  } catch {
    return false;
  }
}

export async function generateJpegThumbnail(input: GenerateThumbnailInput): Promise<void> {
  if (await hasReusableTarget(input.targetAbsolutePath)) {
    return;
  }

  const parentDirectory = path.dirname(input.targetAbsolutePath);
  await fs.mkdir(parentDirectory, { recursive: true });

  await runSipsThumbnail(input.sourceAbsolutePath, input.targetAbsolutePath);

  if (!(await hasReusableTarget(input.targetAbsolutePath))) {
    throw new Error('Thumbnail generation did not produce a usable JPG output file');
  }
}
