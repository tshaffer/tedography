import mongoose from 'mongoose';
import type { AlbumTreeNode, MediaAsset } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import {
  createAlbumTreeNode,
  listAlbumTreeNodes,
  moveAlbumTreeNode
} from '../repositories/albumTreeRepository.js';
import { moveAssetsToAlbum } from '../repositories/assetRepository.js';

interface ScriptOptions {
  write: boolean;
}

interface MigrationSummary {
  yearGroupsExamined: number;
  yearGroupsChanged: number;
  unfiledAlbumsCreated: number;
  assetsMoved: number;
}

const yearGroupPattern = /^\d{4}$/;
const miscellanyLabel = 'Miscellany';
const unfiledLabel = 'Unfiled';

function parseArgs(argv: string[]): ScriptOptions {
  let write = false;

  for (const rawArg of argv.slice(2)) {
    const arg = rawArg.trim();
    if (!arg) {
      continue;
    }

    if (arg === '--write') {
      write = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { write };
}

function printUsage(): void {
  console.log(`Migrate year-group Miscellany albums into Unfiled albums.

Usage:
  pnpm --filter @tedography/api exec tsx src/tools/migrateYearMiscellanyToUnfiled.ts
  pnpm --filter @tedography/api exec tsx src/tools/migrateYearMiscellanyToUnfiled.ts --write

Options:
  --write    Persist changes. Without this flag, the script runs in dry-run mode.
`);
}

function compareSiblingNodes(left: AlbumTreeNode, right: AlbumTreeNode): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const labelComparison = left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id.localeCompare(right.id);
}

function pickDeterministicAlbumCandidate(
  candidates: AlbumTreeNode[],
  yearLabel: string,
  targetLabel: string
): AlbumTreeNode | null {
  if (candidates.length === 0) {
    return null;
  }

  const ordered = [...candidates].sort(compareSiblingNodes);
  const selected = ordered[0] ?? null;
  if (!selected) {
    return null;
  }

  if (ordered.length > 1) {
    log.warn(
      `Year ${yearLabel} has multiple direct child albums named "${targetLabel}". Using "${selected.id}" and ignoring ${ordered
        .slice(1)
        .map((node) => `"${node.id}"`)
        .join(', ')}`
    );
  }

  return selected;
}

async function listAssetIdsInAlbum(albumId: string): Promise<string[]> {
  const assets = await MediaAssetModel.find(
    { albumIds: albumId },
    { _id: 0, id: 1 }
  ).lean<Array<Pick<MediaAsset, 'id'>>>();

  return assets.map((asset) => asset.id);
}

async function ensureUnfiledAlbumAtEnd(input: {
  yearGroup: AlbumTreeNode;
  directChildren: AlbumTreeNode[];
  existingUnfiledAlbum: AlbumTreeNode | null;
  write: boolean;
}): Promise<{ album: AlbumTreeNode; created: boolean; repositionedToEnd: boolean }> {
  const albumChildren = input.directChildren
    .filter((node) => node.nodeType === 'Album')
    .sort(compareSiblingNodes);

  if (!input.existingUnfiledAlbum) {
    if (!input.write) {
      const placeholderId = `dry-run:create-unfiled:${input.yearGroup.id}`;
      return {
        album: {
          id: placeholderId,
          label: unfiledLabel,
          nodeType: 'Album',
          parentId: input.yearGroup.id,
          sortOrder: (albumChildren.length + 1) * 10,
          childOrderMode: null,
          createdAt: 'dry-run',
          updatedAt: 'dry-run'
        },
        created: true,
        repositionedToEnd: false
      };
    }

    const createdAlbum = await createAlbumTreeNode({
      label: unfiledLabel,
      nodeType: 'Album',
      parentId: input.yearGroup.id
    });
    return {
      album: createdAlbum,
      created: true,
      repositionedToEnd: false
    };
  }

  const currentIndex = albumChildren.findIndex((node) => node.id === input.existingUnfiledAlbum?.id);
  const targetIndex = Math.max(0, albumChildren.length - 1);
  if (currentIndex === targetIndex || currentIndex < 0) {
    return {
      album: input.existingUnfiledAlbum,
      created: false,
      repositionedToEnd: false
    };
  }

  if (!input.write) {
    return {
      album: {
        ...input.existingUnfiledAlbum,
        sortOrder: (albumChildren.length + 1) * 10
      },
      created: false,
      repositionedToEnd: true
    };
  }

  const movedAlbum = await moveAlbumTreeNode(
    input.existingUnfiledAlbum.id,
    input.yearGroup.id,
    targetIndex
  );
  if (!movedAlbum) {
    throw new Error(`Failed to reposition existing Unfiled album ${input.existingUnfiledAlbum.id}`);
  }

  return {
    album: movedAlbum,
    created: false,
    repositionedToEnd: true
  };
}

async function runMigration(options: ScriptOptions): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    yearGroupsExamined: 0,
    yearGroupsChanged: 0,
    unfiledAlbumsCreated: 0,
    assetsMoved: 0
  };

  const nodes = await listAlbumTreeNodes();
  const yearGroups = nodes
    .filter((node) => node.nodeType === 'Group' && yearGroupPattern.test(node.label.trim()))
    .sort(compareSiblingNodes);

  for (const yearGroup of yearGroups) {
    summary.yearGroupsExamined += 1;
    log.info(`Examining year group "${yearGroup.label}" (${yearGroup.id})`);

    const directChildren = nodes
      .filter((node) => node.parentId === yearGroup.id)
      .sort(compareSiblingNodes);
    const miscellanyCandidates = directChildren.filter(
      (node) => node.nodeType === 'Album' && node.label === miscellanyLabel
    );
    const miscellanyAlbum = pickDeterministicAlbumCandidate(
      miscellanyCandidates,
      yearGroup.label,
      miscellanyLabel
    );

    if (!miscellanyAlbum) {
      log.info(`Skipping year ${yearGroup.label}: no direct child album named "${miscellanyLabel}"`);
      continue;
    }

    const unfiledCandidates = directChildren.filter(
      (node) => node.nodeType === 'Album' && node.label === unfiledLabel
    );
    const existingUnfiledAlbum = pickDeterministicAlbumCandidate(
      unfiledCandidates,
      yearGroup.label,
      unfiledLabel
    );
    const assetIdsToMove = await listAssetIdsInAlbum(miscellanyAlbum.id);
    const unfiledResult = await ensureUnfiledAlbumAtEnd({
      yearGroup,
      directChildren,
      existingUnfiledAlbum,
      write: options.write
    });

    const willChange =
      unfiledResult.created || unfiledResult.repositionedToEnd || assetIdsToMove.length > 0;

    log.info(
      `${options.write ? '[write]' : '[dry-run]'} year=${yearGroup.label} miscellany=${miscellanyAlbum.id} unfiled=${unfiledResult.album.id} assetsToMove=${assetIdsToMove.length}${unfiledResult.created ? ' createUnfiled=yes' : existingUnfiledAlbum ? ' createUnfiled=no(existing)' : ''}${unfiledResult.repositionedToEnd ? ' repositionUnfiled=yes' : ''}`
    );

    if (!willChange) {
      log.info(`No changes needed for year ${yearGroup.label}`);
      continue;
    }

    summary.yearGroupsChanged += 1;
    if (unfiledResult.created) {
      summary.unfiledAlbumsCreated += 1;
    }
    summary.assetsMoved += assetIdsToMove.length;

    if (!options.write) {
      continue;
    }

    if (assetIdsToMove.length > 0) {
      await moveAssetsToAlbum(assetIdsToMove, unfiledResult.album.id);
      log.info(
        `Moved ${assetIdsToMove.length} asset${assetIdsToMove.length === 1 ? '' : 's'} from "${miscellanyLabel}" (${miscellanyAlbum.id}) to "${unfiledLabel}" (${unfiledResult.album.id}) for year ${yearGroup.label}`
      );
    } else {
      log.info(`No assets to move for year ${yearGroup.label}; left "${miscellanyLabel}" in place`);
    }
  }

  return summary;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  log.info(`Starting Miscellany -> Unfiled migration in ${options.write ? 'write' : 'dry-run'} mode`);

  await connectToMongo();

  try {
    const summary = await runMigration(options);
    log.info(
      `Migration complete. yearGroupsExamined=${summary.yearGroupsExamined} yearGroupsChanged=${summary.yearGroupsChanged} unfiledAlbumsCreated=${summary.unfiledAlbumsCreated} assetsMoved=${summary.assetsMoved}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
