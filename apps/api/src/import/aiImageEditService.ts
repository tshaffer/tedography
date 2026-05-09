import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, type Content } from '@google/genai';
import type { MediaAsset } from '@tedography/domain';
import { config } from '../config.js';
import { resolveOriginalAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';

export interface GeminiEditResult {
  assetId: string;
  filename: string;
  outputPath: string | null;
  error: string | null;
}

function mimeTypeForFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === 'png') return 'image/png';
  if (f === 'webp') return 'image/webp';
  if (f === 'heic' || f === 'heif') return 'image/heic';
  return 'image/jpeg';
}

export async function editImageWithGemini(
  asset: MediaAsset,
  prompt: string,
  outputDir: string
): Promise<GeminiEditResult> {
  const apiKey = config.googleApiKey;
  if (!apiKey) {
    return { assetId: asset.id, filename: asset.filename, outputPath: null, error: 'GOOGLE_API_KEY is not configured' };
  }

  const srcPath = resolveOriginalAbsolutePathForAsset(asset);

  const baseName = asset.filename.replace(/\.[^.]+$/, '');
  const outputFilename = `${baseName}_gemini.jpg`;
  const outputPath = path.join(outputDir, outputFilename);

  try {
    const imageBuffer = await fs.readFile(srcPath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = mimeTypeForFormat(asset.originalFileFormat);

    const genAI = new GoogleGenAI({ apiKey });

    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          { text: prompt || 'Edit this image.' },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ];

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: { responseModalities: ['IMAGE'] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const outputBuffer = Buffer.from(part.inlineData.data, 'base64');
        await fs.writeFile(outputPath, outputBuffer);
        return { assetId: asset.id, filename: asset.filename, outputPath, error: null };
      }
    }

    return { assetId: asset.id, filename: asset.filename, outputPath: null, error: 'Gemini returned no image in response' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { assetId: asset.id, filename: asset.filename, outputPath: null, error: message };
  }
}
