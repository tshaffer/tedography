import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';

export interface ConvertToDisplayJpegInput {
  sourceAbsolutePath: string;
  targetAbsolutePath: string;
  forceRegenerate?: boolean;
}

function runSipsConvert(sourceAbsolutePath: string, targetAbsolutePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'sips',
      ['-s', 'format', 'jpeg', sourceAbsolutePath, '--out', targetAbsolutePath],
      (error, _stdout, stderr) => {
        if (error) {
          const stderrMessage = stderr?.trim();
          reject(
            new Error(
              stderrMessage.length > 0
                ? `Display JPEG conversion failed: ${stderrMessage}`
                : `Display JPEG conversion failed: ${error.message}`
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

/**
 * Converts a source image (HEIC, TIFF, NEF, DNG, ...) to a JPEG for use as an
 * asset's full-size display file, via macOS `sips`. Format-agnostic — driven
 * entirely by `buildDisplayFilePlan`'s decision that a format needs a derived
 * display file.
 */
export async function convertToDisplayJpeg(input: ConvertToDisplayJpegInput): Promise<void> {
  if (!input.forceRegenerate && (await hasReusableTarget(input.targetAbsolutePath))) {
    return;
  }

  const parentDirectory = path.dirname(input.targetAbsolutePath);
  await fs.mkdir(parentDirectory, { recursive: true });

  await runSipsConvert(input.sourceAbsolutePath, input.targetAbsolutePath);

  if (!(await hasReusableTarget(input.targetAbsolutePath))) {
    throw new Error('Display JPEG conversion did not produce a usable JPG output file');
  }
}
