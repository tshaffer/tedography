import { PhotoState, type MediaAsset } from '@tedography/domain';
import { extractMetadata } from '@tedography/media-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { DuplicateGroupResolutionModel } from '../models/duplicateGroupResolutionModel.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

const DEFAULT_RUNS_ROOT = '/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS';
const UNKNOWN_CAPTURE_PHOTO_TAKEN_TIMESTAMP = '-63104400';
const UNKNOWN_CAPTURE_PHOTO_TAKEN_FORMATTED = 'Jan 1, 1968, 3:00:00 PM UTC';
const MEDIA_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.bmp',
  '.dng',
  '.mp4',
  '.mov',
  '.avi',
  '.m4v',
  '.3gp',
  '.mts',
  '.m2ts',
  '.webm'
] as const;

interface UnknownCaptureReviewMatch {
  sidecarPath: string;
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  verifiedDimensions: boolean;
  hasStructuredPhotoTakenTime: boolean;
  hasExactUnknownCapturePhotoTakenTime: boolean;
  photoTakenTime?: unknown;
}

interface UnknownCaptureReviewItem {
  asset: Pick<
    MediaAsset,
    'id' | 'filename' | 'mediaType' | 'photoState' | 'captureDateTime' | 'width' | 'height' | 'originalArchivePath'
  >;
  basenameMatchedSidecarCount: number;
  verifiedMatchCount: number;
  possibleUnconfirmedDuplicate: boolean;
  matches: UnknownCaptureReviewMatch[];
}

interface ListUnknownCaptureReviewItemsResponse {
  runsRoot: string;
  itemCount: number;
  items: UnknownCaptureReviewItem[];
}

type SidecarCandidate = UnknownCaptureReviewMatch;

type AssetRecord = Pick<
  MediaAsset,
  'id' | 'filename' | 'mediaType' | 'photoState' | 'captureDateTime' | 'width' | 'height' | 'originalArchivePath'
>;

function isTakeoutSidecarFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.startsWith('._')) {
    return false;
  }
  if (lower.endsWith('.supplemental-metadata.json')) {
    return true;
  }
  return MEDIA_EXTENSIONS.some((extension) => lower.endsWith(`${extension}.json`));
}

function hasStructuredPhotoTakenTimeValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const timestamp = (value as { timestamp?: unknown }).timestamp;
  const formatted = (value as { formatted?: unknown }).formatted;

  return (
    typeof timestamp === 'string' &&
    timestamp.length > 0 &&
    typeof formatted === 'string' &&
    formatted.length > 0
  );
}

function hasExactUnknownCapturePhotoTakenTimeValue(value: unknown): boolean {
  if (!hasStructuredPhotoTakenTimeValue(value)) {
    return false;
  }

  const timestamp = (value as { timestamp: string }).timestamp;
  const formatted = (value as { formatted: string }).formatted;

  return (
    timestamp === UNKNOWN_CAPTURE_PHOTO_TAKEN_TIMESTAMP &&
    formatted === UNKNOWN_CAPTURE_PHOTO_TAKEN_FORMATTED
  );
}

function getSidecarMediaPath(sidecarPath: string): string | null {
  const lower = sidecarPath.toLowerCase();

  if (lower.endsWith('.supplemental-metadata.json')) {
    const candidate = sidecarPath.slice(0, -'.supplemental-metadata.json'.length);
    return fs.existsSync(candidate) ? candidate : null;
  }

  if (lower.endsWith('.json')) {
    const candidate = sidecarPath.slice(0, -'.json'.length);
    return fs.existsSync(candidate) ? candidate : null;
  }

  return null;
}

function dimensionsMatchAsset(
  asset: Pick<AssetRecord, 'width' | 'height'>,
  match: Pick<UnknownCaptureReviewMatch, 'mediaWidth' | 'mediaHeight'>
): boolean {
  return (
    typeof asset.width === 'number' &&
    typeof asset.height === 'number' &&
    typeof match.mediaWidth === 'number' &&
    typeof match.mediaHeight === 'number' &&
    asset.width === match.mediaWidth &&
    asset.height === match.mediaHeight
  );
}

function walk(dirPath: string, visitor: (fullPath: string) => void): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visitor);
    } else if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

async function buildSidecarIndex(runsRoot: string): Promise<Map<string, SidecarCandidate[]>> {
  const byBaseName = new Map<string, SidecarCandidate[]>();
  const sidecarPaths: string[] = [];

  walk(runsRoot, (fullPath) => {
    if (isTakeoutSidecarFilename(path.basename(fullPath))) {
      sidecarPaths.push(fullPath);
    }
  });

  for (const sidecarPath of sidecarPaths) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as unknown;
    } catch {
      continue;
    }

    const photoTakenTime =
      parsed !== null &&
      typeof parsed === 'object' &&
      Object.prototype.hasOwnProperty.call(parsed, 'photoTakenTime')
        ? (parsed as Record<string, unknown>).photoTakenTime
        : undefined;

    const mediaPath = getSidecarMediaPath(sidecarPath);
    let mediaWidth: number | null = null;
    let mediaHeight: number | null = null;
    if (mediaPath) {
      const metadata = await extractMetadata(mediaPath);
      mediaWidth = typeof metadata.width === 'number' ? metadata.width : null;
      mediaHeight = typeof metadata.height === 'number' ? metadata.height : null;
    }

    const match: SidecarCandidate = {
      sidecarPath,
      mediaPath,
      mediaWidth,
      mediaHeight,
      verifiedDimensions: false,
      hasStructuredPhotoTakenTime: hasStructuredPhotoTakenTimeValue(photoTakenTime),
      hasExactUnknownCapturePhotoTakenTime: hasExactUnknownCapturePhotoTakenTimeValue(photoTakenTime),
      ...(photoTakenTime !== undefined ? { photoTakenTime } : {})
    };

    const baseName = path.basename(sidecarPath);
    const list = byBaseName.get(baseName) ?? [];
    list.push(match);
    byBaseName.set(baseName, list);
  }

  return byBaseName;
}

function getCandidateSidecarBaseNames(asset: Pick<AssetRecord, 'filename' | 'originalArchivePath'>): string[] {
  const baseNames = new Set<string>();
  const filenameCandidates = [
    asset.filename,
    asset.originalArchivePath ? path.basename(asset.originalArchivePath) : undefined
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const fileName of filenameCandidates) {
    baseNames.add(`${fileName}.supplemental-metadata.json`);
    baseNames.add(`${fileName}.json`);
  }

  return Array.from(baseNames);
}

function getConfirmedSuppressedDuplicateAssetIds(
  resolutions: Array<{
    assetIds: string[];
    proposedCanonicalAssetId: string;
    manualCanonicalAssetId?: string | null;
  }>
): Set<string> {
  const suppressed = new Set<string>();

  for (const resolution of resolutions) {
    const selectedCanonicalAssetId =
      resolution.manualCanonicalAssetId &&
      resolution.assetIds.includes(resolution.manualCanonicalAssetId)
        ? resolution.manualCanonicalAssetId
        : resolution.proposedCanonicalAssetId;

    for (const assetId of resolution.assetIds) {
      if (assetId !== selectedCanonicalAssetId) {
        suppressed.add(assetId);
      }
    }
  }

  return suppressed;
}

function getAssetIdsInDuplicateGroups(resolutions: Array<{ assetIds: string[] }>): Set<string> {
  const ids = new Set<string>();
  for (const resolution of resolutions) {
    for (const assetId of resolution.assetIds) {
      ids.add(assetId);
    }
  }
  return ids;
}

export async function listUnknownCaptureReviewItems(input?: {
  runsRoot?: string;
}): Promise<ListUnknownCaptureReviewItemsResponse> {
  const runsRoot = input?.runsRoot?.trim() || DEFAULT_RUNS_ROOT;
  if (!fs.existsSync(runsRoot)) {
    throw new Error(`Runs root does not exist: ${runsRoot}`);
  }

  const sidecarIndex = await buildSidecarIndex(runsRoot);

  const confirmedResolutions = (await DuplicateGroupResolutionModel.find(
    { resolutionStatus: 'confirmed' },
    { _id: 0, assetIds: 1, proposedCanonicalAssetId: 1, manualCanonicalAssetId: 1 }
  ).lean()) as Array<{
    assetIds: string[];
    proposedCanonicalAssetId: string;
    manualCanonicalAssetId?: string | null;
  }>;
  const proposedResolutions = (await DuplicateGroupResolutionModel.find(
    { resolutionStatus: 'proposed' },
    { _id: 0, assetIds: 1 }
  ).lean()) as Array<{ assetIds: string[] }>;

  const confirmedSuppressedDuplicateAssetIds = getConfirmedSuppressedDuplicateAssetIds(confirmedResolutions);
  const confirmedDuplicateAssetIds = getAssetIdsInDuplicateGroups(confirmedResolutions);
  const proposedDuplicateAssetIds = getAssetIdsInDuplicateGroups(proposedResolutions);
  const possibleUnconfirmedDuplicateAssetIds = new Set(
    Array.from(proposedDuplicateAssetIds).filter((assetId) => !confirmedDuplicateAssetIds.has(assetId))
  );

  const queryParts: Array<Record<string, unknown>> = [
    {
      $or: [{ captureDateTime: { $exists: false } }, { captureDateTime: null }, { captureDateTime: '' }]
    },
    { photoState: { $ne: PhotoState.Discard } }
  ];
  if (confirmedSuppressedDuplicateAssetIds.size > 0) {
    queryParts.push({ id: { $nin: Array.from(confirmedSuppressedDuplicateAssetIds) } });
  }

  const assets = (await MediaAssetModel.find(
    { $and: queryParts },
    {
      _id: 0,
      id: 1,
      filename: 1,
      mediaType: 1,
      photoState: 1,
      captureDateTime: 1,
      width: 1,
      height: 1,
      originalArchivePath: 1
    }
  )
    .sort({ originalArchivePath: 1, filename: 1, id: 1 })
    .lean()) as AssetRecord[];

  const items: UnknownCaptureReviewItem[] = [];

  for (const asset of assets) {
    const basenameMatches = getCandidateSidecarBaseNames(asset).flatMap(
      (baseName) => sidecarIndex.get(baseName) ?? []
    );

    if (basenameMatches.length === 0) {
      continue;
    }

    const matches = basenameMatches.map((match) => ({
      ...match,
      verifiedDimensions: dimensionsMatchAsset(asset, match)
    }));
    const verifiedMatchCount = matches.filter((match) => match.verifiedDimensions).length;
    if (verifiedMatchCount === 0) {
      continue;
    }

    items.push({
      asset,
      basenameMatchedSidecarCount: matches.length,
      verifiedMatchCount,
      possibleUnconfirmedDuplicate: possibleUnconfirmedDuplicateAssetIds.has(asset.id),
      matches
    });
  }

  return {
    runsRoot,
    itemCount: items.length,
    items
  };
}
