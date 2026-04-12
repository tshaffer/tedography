/**
 * Report albums containing photos in selected capture-time buckets.
 *
 * Run from the Tedography repo root:
 *   pnpm tsx scripts/reportAlbumsByCaptureBuckets.ts
 *
 * Environment:
 *   This script uses the real Tedography API Mongo connection/config path via
 *   apps/api/src/db.ts, so it expects the same required environment variables
 *   as the API configuration, including at least:
 *   - MONGODB_URI
 *   - TEDOGRAPHY_DERIVED_ROOT
 */

import mongoose from 'mongoose';
import { MediaType, type AlbumTreeNode, type MediaAsset } from '../packages/domain/dist/index.js';
import { connectToMongo } from '../apps/api/dist/db.js';
import { AlbumTreeNodeModel } from '../apps/api/dist/models/albumTreeNodeModel.js';
import { MediaAssetModel } from '../apps/api/dist/models/mediaAssetModel.js';

type BucketKey = 'no-capture' | 'year-1969' | 'years-1970-1986';
type AlbumCategoryKey = 'collections' | 'imports-from-takeout' | 'neither';

type AlbumSummary = {
  albumId: string;
  albumLabel: string;
  parentId: string | null;
  matchingPhotoCount: number;
};

type BucketCategorySummary = Record<AlbumCategoryKey, AlbumSummary[]>;

const COLLECTIONS_GROUP_LABEL = 'Collections';
const IMPORTS_GROUP_LABEL = 'Imports from Takeout';

function printHeading(title: string): void {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
}

function printSubheading(title: string): void {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function parseCaptureDateTime(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getCaptureBucket(asset: Pick<MediaAsset, 'captureDateTime'>): BucketKey | null {
  const parsed = parseCaptureDateTime(asset.captureDateTime);
  if (!parsed) {
    return 'no-capture';
  }

  const year = parsed.getUTCFullYear();
  if (year === 1969) {
    return 'year-1969';
  }

  if (year >= 1970 && year <= 1986) {
    return 'years-1970-1986';
  }

  return null;
}

function buildNodesById(nodes: AlbumTreeNode[]): Map<string, AlbumTreeNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function findGroupByLabel(nodes: AlbumTreeNode[], label: string): AlbumTreeNode | null {
  return (
    nodes.find((node) => node.nodeType === 'Group' && node.label.trim() === label.trim()) ?? null
  );
}

function isDescendantOf(
  nodeId: string,
  ancestorId: string,
  nodesById: Map<string, AlbumTreeNode>
): boolean {
  let current = nodesById.get(nodeId) ?? null;
  const visited = new Set<string>();

  while (current && current.parentId) {
    if (visited.has(current.id)) {
      return false;
    }

    visited.add(current.id);
    if (current.parentId === ancestorId) {
      return true;
    }

    current = nodesById.get(current.parentId) ?? null;
  }

  return false;
}

function classifyAlbum(
  albumId: string,
  collectionsRootId: string | null,
  importsRootId: string | null,
  nodesById: Map<string, AlbumTreeNode>
): AlbumCategoryKey {
  if (collectionsRootId && isDescendantOf(albumId, collectionsRootId, nodesById)) {
    return 'collections';
  }

  if (importsRootId && isDescendantOf(albumId, importsRootId, nodesById)) {
    return 'imports-from-takeout';
  }

  return 'neither';
}

function sortAlbumSummaries(items: AlbumSummary[]): AlbumSummary[] {
  return [...items].sort((left, right) => {
    const labelComparison = left.albumLabel.localeCompare(right.albumLabel);
    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.albumId.localeCompare(right.albumId);
  });
}

function printAlbumSummaries(title: string, items: AlbumSummary[]): void {
  printSubheading(`${title} (${items.length})`);
  if (items.length === 0) {
    console.log('None');
    return;
  }

  for (const item of sortAlbumSummaries(items)) {
    console.log(`- albumId: ${item.albumId}`);
    console.log(`  albumLabel: ${item.albumLabel}`);
    console.log(`  parentId: ${item.parentId ?? 'null'}`);
    console.log(`  matchingPhotoCount: ${item.matchingPhotoCount}`);
  }
}

async function loadAlbumNodes(): Promise<AlbumTreeNode[]> {
  return AlbumTreeNodeModel.find({}, { _id: 0 })
    .sort({ sortOrder: 1, label: 1 })
    .lean<AlbumTreeNode[]>();
}

async function loadPhotoAlbumMemberships(): Promise<Array<Pick<MediaAsset, 'captureDateTime' | 'albumIds'>>> {
  return MediaAssetModel.find(
    { mediaType: MediaType.Photo },
    { _id: 0, captureDateTime: 1, albumIds: 1 }
  ).lean<Array<Pick<MediaAsset, 'captureDateTime' | 'albumIds'>>>();
}

function buildBucketSummary(
  bucket: BucketKey,
  albumNodes: AlbumTreeNode[],
  photoAssets: Array<Pick<MediaAsset, 'captureDateTime' | 'albumIds'>>
): BucketCategorySummary {
  const nodesById = buildNodesById(albumNodes);
  const albumNodesById = new Map(
    albumNodes.filter((node) => node.nodeType === 'Album').map((node) => [node.id, node])
  );
  const collectionsRoot = findGroupByLabel(albumNodes, COLLECTIONS_GROUP_LABEL);
  const importsRoot = findGroupByLabel(albumNodes, IMPORTS_GROUP_LABEL);

  const matchingCountByAlbumId = new Map<string, number>();

  for (const asset of photoAssets) {
    if (getCaptureBucket(asset) !== bucket) {
      continue;
    }

    for (const albumId of asset.albumIds ?? []) {
      if (!albumNodesById.has(albumId)) {
        continue;
      }

      matchingCountByAlbumId.set(albumId, (matchingCountByAlbumId.get(albumId) ?? 0) + 1);
    }
  }

  const result: BucketCategorySummary = {
    collections: [],
    'imports-from-takeout': [],
    neither: []
  };

  for (const [albumId, matchingPhotoCount] of matchingCountByAlbumId.entries()) {
    const albumNode = albumNodesById.get(albumId);
    if (!albumNode) {
      continue;
    }

    const category = classifyAlbum(
      albumId,
      collectionsRoot?.id ?? null,
      importsRoot?.id ?? null,
      nodesById
    );

    result[category].push({
      albumId: albumNode.id,
      albumLabel: albumNode.label,
      parentId: albumNode.parentId ?? null,
      matchingPhotoCount
    });
  }

  return result;
}

function printBucketReport(title: string, summary: BucketCategorySummary): void {
  printHeading(title);
  printAlbumSummaries(`Descendants of "${COLLECTIONS_GROUP_LABEL}"`, summary.collections);
  printAlbumSummaries(`Descendants of "${IMPORTS_GROUP_LABEL}"`, summary['imports-from-takeout']);
  printAlbumSummaries('Neither', summary.neither);
}

async function main(): Promise<void> {
  console.log('Connecting through Tedography Mongoose...');
  await connectToMongo();

  try {
    const [albumNodes, photoAssets] = await Promise.all([loadAlbumNodes(), loadPhotoAlbumMemberships()]);

    printBucketReport(
      'Albums With One Or More Photos With No Capture DateTime',
      buildBucketSummary('no-capture', albumNodes, photoAssets)
    );
    printBucketReport(
      'Albums With One Or More Photos With Capture DateTime In Year 1969',
      buildBucketSummary('year-1969', albumNodes, photoAssets)
    );
    printBucketReport(
      'Albums With One Or More Photos With Capture DateTime In Years 1970 Through 1986',
      buildBucketSummary('years-1970-1986', albumNodes, photoAssets)
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error running reportAlbumsByCaptureBuckets');
  }

  process.exitCode = 1;
});
