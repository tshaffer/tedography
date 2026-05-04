import 'dotenv/config';
import path from 'node:path';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${name}`
    );
  }

  return value;
}

function requireAbsolutePathEnv(name: string): string {
  const value = requireEnv(name).trim();
  if (value.length === 0) {
    throw new Error(`[config] ${name} must be non-empty`);
  }

  if (!path.isAbsolute(value)) {
    throw new Error(`[config] ${name} must be an absolute path`);
  }

  return value;
}

function parseOptionalAbsolutePathEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!path.isAbsolute(trimmed)) {
    throw new Error(`[config] ${name} must be an absolute path`);
  }

  return trimmed;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry: ${fieldName} must be non-empty`);
  }

  return trimmed;
}

export interface StorageRootConfig {
  id: string;
  label: string;
  absolutePath: string;
}

export interface PeoplePipelineConfig {
  enabled: boolean;
  engine: 'rekognition' | 'none' | 'mock';
  minDetectionConfidence: number;
  minFaceAreaPercent: number;
  minCropWidthPx: number;
  minCropHeightPx: number;
  autoMatchThreshold: number;
  reviewThreshold: number;
  storeFaceCrops: boolean;
  pipelineVersion: string;
  rekognition: {
    region: string | null;
    collectionId: string | null;
    maxAttempts: number;
    faceMatchThreshold: number | null;
    maxResults: number;
  };
}

function parseStorageRoots(value: string | undefined): StorageRootConfig[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  const entries = value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const roots: StorageRootConfig[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const parts = entry.split('|');
    if (parts.length !== 3) {
      throw new Error(
        `[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry: expected id|label|absolutePath, got "${entry}"`
      );
    }

    const [rawId, rawLabel, rawAbsolutePath] = parts;
    const id = requireNonEmpty(rawId ?? '', 'id');
    const label = requireNonEmpty(rawLabel ?? '', 'label');
    const absolutePath = requireNonEmpty(rawAbsolutePath ?? '', 'absolutePath');

    if (!path.isAbsolute(absolutePath)) {
      throw new Error(
        `[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry for id "${id}": absolutePath must be absolute`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(`[config] Duplicate TEDOGRAPHY_STORAGE_ROOTS id: "${id}"`);
    }

    seenIds.add(id);
    roots.push({ id, label, absolutePath });
  }

  return roots;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  throw new Error(`[config] Invalid boolean value: "${value}"`);
}

function parsePositiveNumberEnv(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`[config] ${name} must be a non-negative number`);
  }

  return parsed;
}

function parsePeoplePipelineEngine(value: string | undefined): PeoplePipelineConfig['engine'] {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return 'mock';
  }

  if (
    normalized === 'rekognition' ||
    normalized === 'none' ||
    normalized === 'mock'
  ) {
    return normalized;
  }

  throw new Error(`[config] Unsupported TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE: "${value}"`);
}

function parseNonEmptyStringEnv(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const config = {
  mongoUri: requireEnv('MONGODB_URI'),
  storageRoots: parseStorageRoots(process.env.TEDOGRAPHY_STORAGE_ROOTS),
  derivedRoot: requireAbsolutePathEnv('TEDOGRAPHY_DERIVED_ROOT'),
  unrotatedRoot: parseOptionalAbsolutePathEnv('TEDOGRAPHY_UNROTATED_ROOT'),
  peoplePipeline: {
    enabled: parseBooleanEnv(process.env.TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED, false),
    engine: parsePeoplePipelineEngine(process.env.TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE),
    minDetectionConfidence: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_MIN_DETECTION_CONFIDENCE,
      0.85,
      'TEDOGRAPHY_PEOPLE_PIPELINE_MIN_DETECTION_CONFIDENCE'
    ),
    minFaceAreaPercent: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_MIN_FACE_AREA_PERCENT,
      1.5,
      'TEDOGRAPHY_PEOPLE_PIPELINE_MIN_FACE_AREA_PERCENT'
    ),
    minCropWidthPx: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_WIDTH_PX,
      120,
      'TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_WIDTH_PX'
    ),
    minCropHeightPx: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_HEIGHT_PX,
      120,
      'TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_HEIGHT_PX'
    ),
    autoMatchThreshold: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_AUTO_MATCH_THRESHOLD,
      0.97,
      'TEDOGRAPHY_PEOPLE_PIPELINE_AUTO_MATCH_THRESHOLD'
    ),
    reviewThreshold: parsePositiveNumberEnv(
      process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REVIEW_THRESHOLD,
      0.8,
      'TEDOGRAPHY_PEOPLE_PIPELINE_REVIEW_THRESHOLD'
    ),
    storeFaceCrops: parseBooleanEnv(process.env.TEDOGRAPHY_PEOPLE_PIPELINE_STORE_FACE_CROPS, false),
    pipelineVersion:
      (process.env.TEDOGRAPHY_PEOPLE_PIPELINE_VERSION ?? 'people-pipeline-v1').trim() || 'people-pipeline-v1',
    rekognition: {
      region:
        parseNonEmptyStringEnv(process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_REGION) ??
        parseNonEmptyStringEnv(process.env.AWS_REGION) ??
        parseNonEmptyStringEnv(process.env.AWS_DEFAULT_REGION),
      collectionId: parseNonEmptyStringEnv(process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_COLLECTION_ID),
      maxAttempts: parsePositiveNumberEnv(
        process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_ATTEMPTS,
        3,
        'TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_ATTEMPTS'
      ),
      faceMatchThreshold: process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_FACE_MATCH_THRESHOLD
        ? parsePositiveNumberEnv(
            process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_FACE_MATCH_THRESHOLD,
            0,
            'TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_FACE_MATCH_THRESHOLD'
          )
        : null,
      maxResults: parsePositiveNumberEnv(
        process.env.TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_RESULTS,
        5,
        'TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_RESULTS'
      )
    }
  } satisfies PeoplePipelineConfig,

  port: Number(process.env.PORT ?? 4000),
  aiQueueExportPath: parseOptionalAbsolutePathEnv('TEDOGRAPHY_AI_QUEUE_EXPORT_PATH'),
};
