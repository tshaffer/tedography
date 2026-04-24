import type { AlbumTreeNode, MediaAsset } from '@tedography/domain';
import type {
  YearAlbumCoverageAssetItem,
  YearAlbumCoverageDiagnosticType,
  YearAlbumCoverageResult,
  YearAlbumCoverageSummary
} from '@tedography/shared';
import { log } from '../logger.js';
import { listAlbumTreeNodes } from '../repositories/albumTreeRepository.js';
import { listAssetsForAlbumCoverage } from '../repositories/assetRepository.js';

type CoverageAssetSource = Pick<MediaAsset, 'id' | 'filename' | 'captureDateTime' | 'albumIds'>;

type YearCoverageContext = {
  yearGroup: AlbumTreeNode;
  leafAlbums: AlbumTreeNode[];
  miscellanyAlbumId: string | null;
  assets: CoverageAssetSource[];
};

const yearGroupLabelPattern = /^\d{4}$/;

export class YearAlbumCoverageNotFoundError extends Error {
  constructor(yearGroupId: string) {
    super(`Year group "${yearGroupId}" was not found.`);
    this.name = 'YearAlbumCoverageNotFoundError';
  }
}

export class YearAlbumCoverageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YearAlbumCoverageValidationError';
  }
}

function isYearGroupNode(node: AlbumTreeNode): boolean {
  return node.nodeType === 'Group' && yearGroupLabelPattern.test(node.label.trim());
}

function isMiscellanyAlbumLabel(label: string): boolean {
  return label.trim().localeCompare('Miscellany', undefined, { sensitivity: 'base' }) === 0;
}

function compareAlbumNodes(left: AlbumTreeNode, right: AlbumTreeNode): number {
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

function buildChildrenByParent(nodes: AlbumTreeNode[]): Map<string | null, AlbumTreeNode[]> {
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const nextChildren = childrenByParent.get(node.parentId) ?? [];
    nextChildren.push(node);
    childrenByParent.set(node.parentId, nextChildren);
  }

  for (const [parentId, children] of childrenByParent.entries()) {
    childrenByParent.set(parentId, [...children].sort(compareAlbumNodes));
  }

  return childrenByParent;
}

function listDescendantLeafAlbums(nodes: AlbumTreeNode[], yearGroupId: string): AlbumTreeNode[] {
  const childrenByParent = buildChildrenByParent(nodes);
  const leafAlbums: AlbumTreeNode[] = [];
  const stack = [...(childrenByParent.get(yearGroupId) ?? [])].reverse();

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (node.nodeType === 'Album') {
      leafAlbums.push(node);
      continue;
    }

    const children = childrenByParent.get(node.id) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) {
        stack.push(child);
      }
    }
  }

  return leafAlbums;
}

function resolveMiscellanyAlbumId(yearGroup: AlbumTreeNode, leafAlbums: AlbumTreeNode[]): string | null {
  const candidates = leafAlbums
    .filter((album) => isMiscellanyAlbumLabel(album.label))
    .sort(compareAlbumNodes);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length > 1) {
    const selectedCandidate = candidates[0];
    if (!selectedCandidate) {
      return null;
    }

    log.warn(
      `Multiple Miscellany album candidates found under year group "${yearGroup.label}" (${yearGroup.id}); using "${selectedCandidate.label}" (${selectedCandidate.id}) and ignoring ${candidates
        .slice(1)
        .map((candidate) => `"${candidate.label}" (${candidate.id})`)
        .join(', ')}`
    );
  }

  return candidates[0]?.id ?? null;
}

function buildCoverageItem(
  asset: CoverageAssetSource,
  leafAlbumsById: Map<string, AlbumTreeNode>,
  miscellanyAlbumId: string | null
): YearAlbumCoverageAssetItem | null {
  const membershipsInYear = (asset.albumIds ?? [])
    .flatMap((albumId) => {
      const album = leafAlbumsById.get(albumId);
      if (!album) {
        return [];
      }

      return [
        {
          albumId: album.id,
          albumLabel: album.label,
          isMiscellany: miscellanyAlbumId !== null && album.id === miscellanyAlbumId
        }
      ];
    })
    .sort((left, right) => left.albumLabel.localeCompare(right.albumLabel, undefined, { numeric: true, sensitivity: 'base' }) || left.albumId.localeCompare(right.albumId));

  if (membershipsInYear.length === 0) {
    return null;
  }

  const nonMiscellanyAlbumCountInYear = membershipsInYear.filter((membership) => !membership.isMiscellany).length;
  const isInMiscellany = membershipsInYear.some((membership) => membership.isMiscellany);
  const isInAnyNonMiscellanyAlbum = nonMiscellanyAlbumCountInYear > 0;

  return {
    mediaAssetId: asset.id,
    filename: asset.filename,
    captureDateTime: asset.captureDateTime ?? null,
    membershipsInYear,
    nonMiscellanyAlbumCountInYear,
    isInMiscellany,
    isOnlyInMiscellany: isInMiscellany && !isInAnyNonMiscellanyAlbum,
    isInAnyNonMiscellanyAlbum
  };
}

function sortCoverageItems(items: YearAlbumCoverageAssetItem[]): YearAlbumCoverageAssetItem[] {
  return [...items].sort((left, right) => {
    const leftTimestamp =
      typeof left.captureDateTime === 'string' && left.captureDateTime.trim().length > 0
        ? new Date(left.captureDateTime).getTime()
        : Number.POSITIVE_INFINITY;
    const rightTimestamp =
      typeof right.captureDateTime === 'string' && right.captureDateTime.trim().length > 0
        ? new Date(right.captureDateTime).getTime()
        : Number.POSITIVE_INFINITY;

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    const leftFilename = left.filename ?? '';
    const rightFilename = right.filename ?? '';
    const filenameComparison = leftFilename.localeCompare(rightFilename, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (filenameComparison !== 0) {
      return filenameComparison;
    }

    return left.mediaAssetId.localeCompare(right.mediaAssetId);
  });
}

async function loadYearCoverageContext(yearGroupId: string): Promise<YearCoverageContext> {
  const nodes = await listAlbumTreeNodes();
  const yearGroup = nodes.find((node) => node.id === yearGroupId) ?? null;
  if (!yearGroup) {
    throw new YearAlbumCoverageNotFoundError(yearGroupId);
  }

  if (!isYearGroupNode(yearGroup)) {
    throw new YearAlbumCoverageValidationError('Selected node is not a year group.');
  }

  const leafAlbums = listDescendantLeafAlbums(nodes, yearGroup.id);
  const miscellanyAlbumId = resolveMiscellanyAlbumId(yearGroup, leafAlbums);
  const assets =
    leafAlbums.length > 0 ? await listAssetsForAlbumCoverage(leafAlbums.map((album) => album.id)) : [];

  return {
    yearGroup,
    leafAlbums,
    miscellanyAlbumId,
    assets
  };
}

function classifyCoverageAssets(context: YearCoverageContext): YearAlbumCoverageAssetItem[] {
  const leafAlbumsById = new Map(context.leafAlbums.map((album) => [album.id, album]));

  return sortCoverageItems(
    context.assets.flatMap((asset) => {
      const item = buildCoverageItem(asset, leafAlbumsById, context.miscellanyAlbumId);
      return item ? [item] : [];
    })
  );
}

export async function getYearAlbumCoverageSummary(
  yearGroupId: string
): Promise<YearAlbumCoverageSummary> {
  const context = await loadYearCoverageContext(yearGroupId);
  const items = classifyCoverageAssets(context);

  return {
    yearGroupId: context.yearGroup.id,
    yearLabel: context.yearGroup.label,
    totalAssetsInYear: items.length,
    assetsInMiscellany: items.filter((item) => item.isInMiscellany).length,
    assetsOnlyInMiscellany: items.filter((item) => item.isOnlyInMiscellany).length,
    assetsNotInAnyNonMiscellanyAlbum: items.filter((item) => !item.isInAnyNonMiscellanyAlbum).length,
    assetsInOneOrMoreNonMiscellanyAlbums: items.filter((item) => item.isInAnyNonMiscellanyAlbum).length
  };
}

export async function getYearAlbumCoverageAssets(
  yearGroupId: string,
  diagnosticType: YearAlbumCoverageDiagnosticType
): Promise<YearAlbumCoverageResult> {
  const context = await loadYearCoverageContext(yearGroupId);
  const allItems = classifyCoverageAssets(context);

  const items = allItems.filter((item) => {
    if (diagnosticType === 'only-in-miscellany') {
      return item.isOnlyInMiscellany;
    }

    if (diagnosticType === 'not-in-any-non-miscellany') {
      return !item.isInAnyNonMiscellanyAlbum;
    }

    return item.isInAnyNonMiscellanyAlbum;
  });

  return {
    yearGroupId: context.yearGroup.id,
    yearLabel: context.yearGroup.label,
    diagnosticType,
    totalCount: items.length,
    items
  };
}
