import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MediaAsset } from '@tedography/domain';
import { RekognitionClient, type RekognitionDetectedLabel } from '../people/rekognitionClient.js';
import { resolveDisplayAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';

export interface LabelDetectionFileResult {
  assetId: string;
  filename: string;
  labels: RekognitionDetectedLabel[];
  error: string | null;
}

export interface LabelDetectionReport {
  generatedAt: string;
  assetCount: number;
  minConfidence: number;
  files: LabelDetectionFileResult[];
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const docsDir = path.join(projectRoot, 'Docs');

export async function detectLabelsForAssets(
  assets: MediaAsset[],
  minConfidence = 70
): Promise<{ report: LabelDetectionReport; outputPath: string }> {
  const client = new RekognitionClient();
  const files: LabelDetectionFileResult[] = [];

  for (const asset of assets) {
    const imagePath = resolveDisplayAbsolutePathForAsset(asset);
    try {
      const labels = await client.detectLabels(imagePath, { minConfidence });
      files.push({ assetId: asset.id, filename: asset.filename, labels, error: null });
    } catch (err) {
      files.push({
        assetId: asset.id,
        filename: asset.filename,
        labels: [],
        error: err instanceof Error ? err.message : 'Detection failed',
      });
    }
  }

  const report: LabelDetectionReport = {
    generatedAt: new Date().toISOString(),
    assetCount: assets.length,
    minConfidence,
    files,
  };

  await fs.mkdir(docsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFilename = `label-detection-${timestamp}.json`;
  const outputPath = path.join(docsDir, outputFilename);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  return { report, outputPath };
}
