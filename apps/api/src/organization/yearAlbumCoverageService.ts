import type { AlbumTreeNode, MediaAsset } from '@tedography/domain';
import type {
  YearAlbumCoverageAssetItem,
  YearAlbumCoverageDiagnosticType,
  YearAlbumCoverageMetadata,
  YearAlbumCoverageRecognitionMode,
  YearAlbumCoverageResult,
  YearAlbumCoverageSummary
} from '@tedography/shared';
import { log } from '../logger.js';
import { listAlbumTreeNodesForCoverage } from '../repositories/albumTreeRepository.js';
import { listAssetsForAlbumCoverage } from '../repositories/assetRepository.js';

type CoverageAlbumNode = Pick<
  AlbumTreeNode,
  'id' | 'label' | 'nodeType' | 'parentId' | 'sortOrder' | 'semanticKind'
>;
type CoverageAssetSource = Pick<MediaAsset, 'id' | 'filename' | 'captureDateTime' | 'albumIds'>;

type YearCoverageContext = {
  yearGroup: CoverageAlbumNode;
  yearGroupRecognitionMode: YearAlbumCoverageRecognitionMode;
  leafAlbums: CoverageAlbumNode[];
  metadata: YearAlbumCoverageMetadata;
  assets: CoverageAssetSource[];
};

type YearGroupRecognition = {
  recognized: true;
  mode: YearAlbumCoverageRecognitionMode;
};

type MiscellanyCandidate = {
  album: CoverageAlbumNode;
  detectionMode: Exclude<YearAlbumCoverageMetadata['miscellanyDetectionMode'], 'none'>;
};

const inferredYearGroupLabelPattern = /^\d{4}$/;
const inferredMiscellanyNormalizedLabels = new Set(['miscellany', 'misc', 'yearmisc', 'yearmiscellany']);

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

function normalizeLabelForSemanticInference(label: string): string {
  return label.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

function compareAlbumNodes(left: CoverageAlbumNode, right: CoverageAlbumNode): number {
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

function buildChildrenByParent(nodes: CoverageAlbumNode[]): Map<string | null, CoverageAlbumNode[]> {
  const childrenByParent = new Map<string | null, CoverageAlbumNode[]>();

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

function recognizeYearGroup(node: CoverageAlbumNode): YearGroupRecognition | null {
  if (node.nodeType !== 'Group') {
    return null;
  }

  if (node.semanticKind === 'YearGroup') {
    return { recognized: true, mode: 'explicit' };
  }

  if (inferredYearGroupLabelPattern.test(node.label.trim())) {
    return { recognized: true, mode: 'inferred-label' };
  }

  return null;
}

function buildInvalidYearGroupMessage(node: CoverageAlbumNode): string {
  return `Selected node "${node.label}" (${node.nodeType}) is not recognized as a year group. Year groups must either have semanticKind "YearGroup" or use a 4-digit year label.`;
}

function listDescendantLeafAlbums(nodes: CoverageAlbumNode[], yearGroupId: string): CoverageAlbumNode[] {
  const childrenByParent = buildChildrenByParent(nodes);
  const leafAlbums: CoverageAlbumNode[] = [];
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

function recognizeMiscellanyCandidate(album: CoverageAlbumNode): MiscellanyCandidate | null {
  if (album.nodeType !== 'Album') {
    return null;
  }

  if (album.semanticKind === 'Miscellany') {
    return { album, detectionMode: 'explicit' };
  }

  const normalizedLabel = normalizeLabelForSemanticInference(album.label);
  if (inferredMiscellanyNormalizedLabels.has(normalizedLabel)) {
    return { album, detectionMode: 'inferred-label' };
  }

  return null;
}

function compareMiscellanyCandidates(left: MiscellanyCandidate, right: MiscellanyCandidate): number {
  if (left.detectionMode !== right.detectionMode) {
    return left.detectionMode === 'explicit' ? -1 : 1;
  }

  return compareAlbumNodes(left.album, right.album);
}

function resolveMiscellanyMetadata(
  yearGroup: CoverageAlbumNode,
  leafAlbums: CoverageAlbumNode[],
  yearGroupRecognitionMode: YearAlbumCoverageRecognitionMode
): YearAlbumCoverageMetadata {
  const candidates = leafAlbums
    .flatMap((album) => {
      const candidate = recognizeMiscellanyCandidate(album);
      return candidate ? [candidate] : [];
    })
    .sort(compareMiscellanyCandidates);

  const selectedCandidate = candidates[0] ?? null;
  const ignoredCandidateIds = candidates.slice(1).map((candidate) => candidate.album.id);
  const multipleMiscellanyCandidatesDetected = candidates.length > 1;

  if (selectedCandidate && multipleMiscellanyCandidatesDetected) {
    log.warn(
      `Multiple Miscellany candidates found under year group "${yearGroup.label}" (${yearGroup.id}); selected "${selectedCandidate.album.label}" (${selectedCandidate.album.id}) via ${selectedCandidate.detectionMode} detection and ignored ${candidates
        .slice(1)
        .map((candidate) => `"${candidate.album.label}" (${candidate.album.id}) via ${candidate.detectionMode}`)
        .join(', ')}`
    );
  }

  return {
    yearGroupRecognitionMode,
    hasMiscellanyAlbum: selectedCandidate !== null,
    miscellanyDetectionMode: selectedCandidate?.detectionMode ?? 'none',
    multipleMiscellanyCandidatesDetected,
    ...(selectedCandidate ? { selectedMiscellanyAlbumId: selectedCandidate.album.id } : {}),
    ...(ignoredCandidateIds.length > 0 ? { ignoredMiscellanyCandidateAlbumIds: ignoredCandidateIds } : {})
  };
}

function buildCoverageItem(
  asset: CoverageAssetSource,
  leafAlbumsById: Map<string, CoverageAlbumNode>,
  selectedMiscellanyAlbumId: string | undefined
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
          isMiscellany: selectedMiscellanyAlbumId === album.id
        }
      ];
    })
    .sort(
      (left, right) =>
        left.albumLabel.localeCompare(right.albumLabel, undefined, {
          numeric: true,
          sensitivity: 'base'
        }) || left.albumId.localeCompare(right.albumId)
    );

  if (membershipsInYear.length === 0) {
    return null;
  }

  const nonMiscellanyAlbumCountInYear = membershipsInYear.reduce(
    (count, membership) => count + (membership.isMiscellany ? 0 : 1),
    0
  );
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

    const filenameComparison = (left.filename ?? '').localeCompare(right.filename ?? '', undefined, {
      numeric: true,
      sensitivity: 'base'
    });
    if (filenameComparison !== 0) {
      return filenameComparison;
    }

    return left.mediaAssetId.localeCompare(right.mediaAssetId);
  });
}

function classifyCoverageAssets(context: YearCoverageContext): YearAlbumCoverageAssetItem[] {
  const leafAlbumsById = new Map(context.leafAlbums.map((album) => [album.id, album]));

  return sortCoverageItems(
    context.assets.flatMap((asset) => {
      const item = buildCoverageItem(
        asset,
        leafAlbumsById,
        context.metadata.selectedMiscellanyAlbumId
      );
      return item ? [item] : [];
    })
  );
}

async function loadYearCoverageContext(yearGroupId: string): Promise<YearCoverageContext> {
  const nodes = await listAlbumTreeNodesForCoverage();
  const yearGroup = nodes.find((node) => node.id === yearGroupId) ?? null;
  if (!yearGroup) {
    throw new YearAlbumCoverageNotFoundError(yearGroupId);
  }

  const yearGroupRecognition = recognizeYearGroup(yearGroup);
  if (!yearGroupRecognition) {
    throw new YearAlbumCoverageValidationError(buildInvalidYearGroupMessage(yearGroup));
  }

  const leafAlbums = listDescendantLeafAlbums(nodes, yearGroup.id);
  const metadata = resolveMiscellanyMetadata(yearGroup, leafAlbums, yearGroupRecognition.mode);
  const assets =
    leafAlbums.length > 0 ? await listAssetsForAlbumCoverage(leafAlbums.map((album) => album.id)) : [];

  return {
    yearGroup,
    yearGroupRecognitionMode: yearGroupRecognition.mode,
    leafAlbums,
    metadata,
    assets
  };
}

async function getYearAlbumCoverageAnalysis(yearGroupId: string): Promise<{
  context: YearCoverageContext;
  items: YearAlbumCoverageAssetItem[];
}> {
  const context = await loadYearCoverageContext(yearGroupId);
  return {
    context,
    items: classifyCoverageAssets(context)
  };
}

export async function getYearAlbumCoverageSummary(
  yearGroupId: string
): Promise<YearAlbumCoverageSummary> {
  const { context, items } = await getYearAlbumCoverageAnalysis(yearGroupId);
  const counts = items.reduce(
    (result, item) => ({
      assetsInMiscellany: result.assetsInMiscellany + (item.isInMiscellany ? 1 : 0),
      assetsOnlyInMiscellany: result.assetsOnlyInMiscellany + (item.isOnlyInMiscellany ? 1 : 0),
      assetsNotInAnyNonMiscellanyAlbum:
        result.assetsNotInAnyNonMiscellanyAlbum + (item.isInAnyNonMiscellanyAlbum ? 0 : 1),
      assetsInOneOrMoreNonMiscellanyAlbums:
        result.assetsInOneOrMoreNonMiscellanyAlbums + (item.isInAnyNonMiscellanyAlbum ? 1 : 0)
    }),
    {
      assetsInMiscellany: 0,
      assetsOnlyInMiscellany: 0,
      assetsNotInAnyNonMiscellanyAlbum: 0,
      assetsInOneOrMoreNonMiscellanyAlbums: 0
    }
  );

  return {
    yearGroupId: context.yearGroup.id,
    yearLabel: context.yearGroup.label,
    metadata: context.metadata,
    totalAssetsInYear: items.length,
    assetsInMiscellany: counts.assetsInMiscellany,
    assetsOnlyInMiscellany: counts.assetsOnlyInMiscellany,
    assetsNotInAnyNonMiscellanyAlbum: counts.assetsNotInAnyNonMiscellanyAlbum,
    assetsInOneOrMoreNonMiscellanyAlbums: counts.assetsInOneOrMoreNonMiscellanyAlbums
  };
}

export async function getYearAlbumCoverageAssets(
  yearGroupId: string,
  diagnosticType: YearAlbumCoverageDiagnosticType
): Promise<YearAlbumCoverageResult> {
  const { context, items: allItems } = await getYearAlbumCoverageAnalysis(yearGroupId);
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
    metadata: context.metadata,
    diagnosticType,
    totalCount: items.length,
    items
  };
}
