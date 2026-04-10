/// <reference types="node" />
/**
 * rotate-image-90cw.ts
 *
 * Rotates an image 90 degrees clockwise and writes the result to a separate output path.
 * The input file is never modified.
 *
 * Usage:
 *   cd /Users/tedshaffer/Documents/Projects/tedography
 *   pnpm exec tsx scripts/rotate-image-90cw.ts \
 *     "/path/to/input.jpg" \
 *     "/path/to/output.jpg"
 *
 * Notes:
 *   - Requires macOS `sips`.
 *   - Creates the output directory if it does not already exist.
 *   - Refuses to use the same path for input and output.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`Error: ${message}`);
    console.error('');
  }

  console.error('Usage:');
  console.error('  pnpm exec tsx scripts/rotate-image-90cw.ts <input-file> <output-file>');
  process.exit(1);
}

function main(): void {
  const [, , inputPathArg, outputPathArg] = process.argv;

  if (!inputPathArg || !outputPathArg) {
    printUsageAndExit('Both input-file and output-file are required.');
  }

  const inputPath = path.resolve(inputPathArg);
  const outputPath = path.resolve(outputPathArg);

  if (!fs.existsSync(inputPath)) {
    printUsageAndExit(`Input file does not exist: ${inputPath}`);
  }

  const inputStat = fs.statSync(inputPath);
  if (!inputStat.isFile()) {
    printUsageAndExit(`Input path is not a file: ${inputPath}`);
  }

  if (inputPath === outputPath) {
    printUsageAndExit('Input and output paths must be different.');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const result = spawnSync(
    'sips',
    ['--rotate', '90', inputPath, '--out', outputPath],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    throw new Error(stderr || stdout || `sips failed with exit code ${result.status}`);
  }

  console.log(`Wrote rotated image to: ${outputPath}`);
}

main();
