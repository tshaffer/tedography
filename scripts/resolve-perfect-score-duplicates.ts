#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import type { MediaAsset } from '@tedography/domain';
import { findByIds } from '../apps/api/src/repositories/assetRepository.js';
import {
  listConfirmedDuplicatePairs,
  updateDuplicateCandidatePairReview,
  type FindDuplicateCandidatePairInput
} from '../apps/api/src/repositories/duplicateCandidatePairRepository.js';
import {
  findDuplicateGroupResolutionByKey,
  upsertDuplicateGroupResolution
} from '../apps/api/src/repositories/duplicateGroupResolutionRepository.js';
import { DuplicateCandidatePairModel, type DuplicateCandidatePairDocument } from '../apps/api/src/models/duplicateCandidatePairModel.js';
import { DuplicateGroupResolutionModel, type DuplicateGroupResolutionDocument } from '../apps/api/src/models/duplicateGroupResolutionModel.js';
import {
  buildDuplicateGroupKey,
  deriveDuplicateGroups,
  resolveSelectedCanonicalAssetId,
  selectProposedCanonicalAsset
} from '../apps/api/src/services/duplicateGroupService.js';

type CliArgs = {
  mongoUri: string;
  dbName?: string;
  out: string;
  apply: boolean;
  minScore: number;
  componentSizeMax?: number;
  onlyUnreviewed: boolean;
};

type ComponentResolutionStatus =
  | 'ready'
  | 'skip_missing_asset'
  | 'skip_missing_file_size'
  | 'skip_dimension_mismatch'
  | 'skip_missing_dimensions'
  | 'skip_existing_not_duplicate'
  | 'skip_existing_ignored'
  | 'skip_existing_confirmed_keeper_conflict'
  | 'skip_component_too_large';

type PerfectScoreComponentDecision = {
  componentKey: string;
  assetIds: string[];
  componentSize: number;
  proposedKeeperAssetId: string | null;
  proposedCanonicalAssetId: string | null;
  manualCanonicalAssetId: string | null;
  status: ComponentResolutionStatus;
  reason: string;
};

type PerfectScoreCsvRow = {
  pairKey: string;
  assetIdA: string;
  assetIdB: string;
  score: number;
  fileSizeA: number | null;
  fileSizeB: number | null;
  proposedKeeperAssetId: string | null;
  proposedNonKeeperAssetId: string | null;
  sameDimensions: boolean | null;
  componentKey: string;
  componentSize: number;
  action: string;
  reason: string;
  skippedReason: string | null;
};

type CandidatePairForResolution = DuplicateCandidatePairDocument & {
  pairKey: string;
};

const defaultOutPath = path.resolve(process.cwd(), 'scripts/output/perfect_score_duplicate_resolution.csv');

function canonicalizeAssetPair(assetIdA: string, assetIdB: string): [string, string] {
  return assetIdA.localeCompare(assetIdB) <= 0 ? [assetIdA, assetIdB] : [assetIdB, assetIdA];
}

function buildCanonicalAssetPairKey(assetIdA: string, assetIdB: string): string {
  const [left, right] = canonicalizeAssetPair(assetIdA, assetIdB);
  return `${left}::${right}`;
}

function buildPairKey(pair: FindDuplicateCandidatePairInput): string {
  return [pair.assetIdA, pair.assetIdB, pair.analysisVersion, pair.generationVersion].join('__');
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    mongoUri: process.env.MONGODB_URI ?? '',
    out: defaultOutPath,
    apply: false,
    minScore: 1.0,
    onlyUnreviewed: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    switch (argument) {
      case '--mongo-uri':
        args.mongoUri = nextValue ?? '';
        index += 1;
        break;
      case '--db-name':
        args.dbName = nextValue;
        index += 1;
        break;
      case '--out':
        args.out = path.resolve(nextValue ?? '');
        index += 1;
        break;
      case '--min-score':
        args.minScore = Number.parseFloat(nextValue ?? '1');
        index += 1;
        break;
      case '--component-size-max':
        args.componentSizeMax = Number.parseInt(nextValue ?? '', 10);
        index += 1;
        break;
      case '--only-unreviewed':
        args.onlyUnreviewed = true;
        break;
      case '--apply':
        args.apply = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!args.mongoUri.trim()) {
    throw new Error('Missing required --mongo-uri (or set MONGODB_URI).');
  }

  if (!Number.isFinite(args.minScore) || args.minScore <= 0) {
    throw new Error('--min-score must be a positive number.');
  }

  if (args.componentSizeMax !== undefined && (!Number.isInteger(args.componentSizeMax) || args.componentSizeMax <= 1)) {
    throw new Error('--component-size-max must be an integer greater than 1.');
  }

  return args;
}

function printHelp(): void {
  console.log(`
Usage:
  pnpm --filter @tedography/api exec tsx ../../scripts/resolve-perfect-score-duplicates.ts \\
    --out ./scripts/output/perfect_score_duplicate_resolution.csv

  pnpm --filter @tedography/api exec tsx ../../scripts/resolve-perfect-score-duplicates.ts \\
    --out ./scripts/output/perfect_score_duplicate_resolution.csv \\
    --apply

Options:
  --mongo-uri <uri>            Mongo connection string. Defaults to MONGODB_URI.
  --db-name <name>             Optional Mongo database name override.
  --out <path>                 Output CSV path. Default: scripts/output/perfect_score_duplicate_resolution.csv
  --apply                      Persist pair reviews and group keeper selections.
  --min-score <n>              Candidate score threshold. Default: 1.0
  --component-size-max <n>     Skip connected components larger than this size.
  --only-unreviewed            Only auto-resolve currently unreviewed candidate pairs.
`);
}

function csvEscape(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath: string, rows: PerfectScoreCsvRow[]): void {
  const header = [
    'pairKey',
    'assetIdA',
    'assetIdB',
    'score',
    'fileSizeA',
    'fileSizeB',
    'proposedKeeperAssetId',
    'proposedNonKeeperAssetId',
    'sameDimensions',
    'componentKey',
    'componentSize',
    'action',
    'reason',
    'skippedReason'
  ];

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.pairKey,
        row.assetIdA,
        row.assetIdB,
        row.score,
        row.fileSizeA,
        row.fileSizeB,
        row.proposedKeeperAssetId,
        row.proposedNonKeeperAssetId,
        row.sameDimensions,
        row.componentKey,
        row.componentSize,
        row.action,
        row.reason,
        row.skippedReason
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function sameDimensionsForPair(assetA: MediaAsset | undefined, assetB: MediaAsset | undefined): boolean | null {
  if (!assetA || !assetB) {
    return null;
  }

  if (
    assetA.width === undefined ||
    assetA.width === null ||
    assetA.height === undefined ||
    assetA.height === null ||
    assetB.width === undefined ||
    assetB.width === null ||
    assetB.height === undefined ||
    assetB.height === null
  ) {
    return null;
  }

  return assetA.width === assetB.width && assetA.height === assetB.height;
}

function getResolvedCanonicalAssetId(resolution: DuplicateGroupResolutionDocument): string {
  return resolveSelectedCanonicalAssetId({
    assetIds: resolution.assetIds,
    proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
    manualCanonicalAssetId: resolution.manualCanonicalAssetId ?? null
  });
}

function buildAssetMap(assets: MediaAsset[]): Map<string, MediaAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export function evaluatePerfectScoreComponent(input: {
  assetIds: string[];
  assets: MediaAsset[];
  candidatePairs: CandidatePairForResolution[];
  confirmedResolutions: DuplicateGroupResolutionDocument[];
  componentSizeMax?: number;
}): PerfectScoreComponentDecision {
  const componentKey = buildDuplicateGroupKey(input.assetIds);
  const componentSize = input.assetIds.length;
  const assetMap = buildAssetMap(input.assets);

  if (input.componentSizeMax !== undefined && componentSize > input.componentSizeMax) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_component_too_large',
      reason: `Skipped component with ${componentSize} assets because it exceeds --component-size-max=${input.componentSizeMax}.`
    };
  }

  if (input.assetIds.some((assetId) => !assetMap.has(assetId))) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_missing_asset',
      reason: 'Skipped component because one or more mediaAssets rows are missing.'
    };
  }

  const assetsInComponent = input.assetIds
    .map((assetId) => assetMap.get(assetId) ?? null)
    .filter((asset): asset is MediaAsset => asset !== null);

  if (
    assetsInComponent.some(
      (asset) =>
        asset.originalFileSizeBytes === undefined ||
        asset.originalFileSizeBytes === null ||
        asset.originalFileSizeBytes <= 0
    )
  ) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_missing_file_size',
      reason: 'Skipped component because one or more assets are missing file size metadata.'
    };
  }

  if (
    assetsInComponent.some(
      (asset) =>
        asset.width === undefined ||
        asset.width === null ||
        asset.height === undefined ||
        asset.height === null
    )
  ) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_missing_dimensions',
      reason: 'Skipped component because one or more assets are missing dimensions.'
    };
  }

  const baselineWidth = assetsInComponent[0]?.width ?? null;
  const baselineHeight = assetsInComponent[0]?.height ?? null;
  const dimensionsMismatch = assetsInComponent.some(
    (asset) => asset.width !== baselineWidth || asset.height !== baselineHeight
  );
  if (dimensionsMismatch) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_dimension_mismatch',
      reason: 'Skipped component because asset dimensions differ.'
    };
  }

  if (input.candidatePairs.some((pair) => pair.outcome === 'not_duplicate')) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_existing_not_duplicate',
      reason: 'Skipped component because at least one candidate pair is already reviewed as not_duplicate.'
    };
  }

  if (input.candidatePairs.some((pair) => pair.outcome === 'ignored')) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_existing_ignored',
      reason: 'Skipped component because at least one candidate pair is already ignored.'
    };
  }

  const sortedByFileSize = [...assetsInComponent].sort((left, right) => {
    const fileSizeDelta = (right.originalFileSizeBytes ?? 0) - (left.originalFileSizeBytes ?? 0);
    if (fileSizeDelta !== 0) {
      return fileSizeDelta;
    }

    return left.id.localeCompare(right.id);
  });

  const preferredKeeper = sortedByFileSize[0];
  const largestFileSize = preferredKeeper?.originalFileSizeBytes ?? null;
  const usedLargestFileSizeTiebreak =
    largestFileSize !== null &&
    sortedByFileSize.filter((asset) => asset.originalFileSizeBytes === largestFileSize).length > 1;

  if (!preferredKeeper) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_missing_asset',
      reason: 'Skipped component because one or more mediaAssets rows are missing.'
    };
  }

  const conflictingConfirmedResolution = input.confirmedResolutions.find(
    (resolution) => getResolvedCanonicalAssetId(resolution) !== preferredKeeper.id
  );
  if (conflictingConfirmedResolution) {
    return {
      componentKey,
      assetIds: input.assetIds,
      componentSize,
      proposedKeeperAssetId: null,
      proposedCanonicalAssetId: null,
      manualCanonicalAssetId: null,
      status: 'skip_existing_confirmed_keeper_conflict',
      reason: `Skipped component because existing confirmed keeper ${getResolvedCanonicalAssetId(conflictingConfirmedResolution)} conflicts with heuristic keeper ${preferredKeeper.id}.`
    };
  }

  const proposedCanonicalAsset = selectProposedCanonicalAsset(assetsInComponent).canonicalAssetId;

  return {
    componentKey,
    assetIds: input.assetIds,
    componentSize,
    proposedKeeperAssetId: preferredKeeper.id,
    proposedCanonicalAssetId: proposedCanonicalAsset,
    manualCanonicalAssetId: preferredKeeper.id === proposedCanonicalAsset ? null : preferredKeeper.id,
    status: 'ready',
    reason:
      componentSize === 2
        ? usedLargestFileSizeTiebreak
          ? `Selected keeper by deterministic tiebreak after largest-file tie for this perfect-score duplicate pair (lexicographically smallest asset id among tied largest-file assets: ${preferredKeeper.id}).`
          : 'Selected the larger file as keeper for this perfect-score duplicate pair.'
        : usedLargestFileSizeTiebreak
          ? `Selected one keeper for the connected perfect-score duplicate component by deterministic tiebreak after largest-file tie (lexicographically smallest asset id among tied largest-file assets: ${preferredKeeper.id}).`
          : 'Selected one keeper for the connected perfect-score duplicate component by preferring the larger file.'
  };
}

function buildCsvRowsForComponent(input: {
  componentDecision: PerfectScoreComponentDecision;
  candidatePairs: CandidatePairForResolution[];
  assetMap: Map<string, MediaAsset>;
  apply: boolean;
}): PerfectScoreCsvRow[] {
  const { componentDecision, candidatePairs, assetMap, apply } = input;

  return candidatePairs.map((pair) => {
    const assetA = assetMap.get(pair.assetIdA);
    const assetB = assetMap.get(pair.assetIdB);
    const proposedNonKeeperAssetId =
      componentDecision.proposedKeeperAssetId === pair.assetIdA
        ? pair.assetIdB
        : componentDecision.proposedKeeperAssetId === pair.assetIdB
          ? pair.assetIdA
          : null;

    return {
      pairKey: pair.pairKey,
      assetIdA: pair.assetIdA,
      assetIdB: pair.assetIdB,
      score: pair.score,
      fileSizeA: assetA?.originalFileSizeBytes ?? null,
      fileSizeB: assetB?.originalFileSizeBytes ?? null,
      proposedKeeperAssetId: componentDecision.proposedKeeperAssetId,
      proposedNonKeeperAssetId,
      sameDimensions: sameDimensionsForPair(assetA, assetB),
      componentKey: componentDecision.componentKey,
      componentSize: componentDecision.componentSize,
      action:
        componentDecision.status === 'ready'
          ? apply
            ? 'apply_confirm_duplicate_and_keeper'
            : 'dry_run_confirm_duplicate_and_keeper'
          : 'skip',
      reason: componentDecision.reason,
      skippedReason: componentDecision.status === 'ready' ? null : componentDecision.reason
    };
  });
}

async function loadCandidatePairs(args: CliArgs): Promise<CandidatePairForResolution[]> {
  const rawPairs = await DuplicateCandidatePairModel.find(
    {
      score: { $gte: args.minScore },
      ...(args.onlyUnreviewed ? { status: 'unreviewed' } : {})
    },
    { _id: 0 }
  )
    .sort({ score: -1, updatedAt: -1, assetIdA: 1, assetIdB: 1, analysisVersion: 1, generationVersion: 1 })
    .lean<DuplicateCandidatePairDocument[]>();

  return rawPairs.map((pair) => ({
    ...pair,
    pairKey: buildPairKey(pair)
  }));
}

export async function runPerfectScoreDuplicateResolution(args: CliArgs): Promise<{
  csvRows: PerfectScoreCsvRow[];
  appliedPairUpdates: number;
  appliedGroupResolutions: number;
}> {
  await mongoose.connect(args.mongoUri, args.dbName ? { dbName: args.dbName } : undefined);

  try {
    const candidatePairs = await loadCandidatePairs(args);
    const confirmedPairs = await listConfirmedDuplicatePairs();

    const graphEdges = new Map<string, { assetIdA: string; assetIdB: string }>();
    for (const pair of confirmedPairs) {
      graphEdges.set(buildCanonicalAssetPairKey(pair.assetIdA, pair.assetIdB), {
        assetIdA: pair.assetIdA,
        assetIdB: pair.assetIdB
      });
    }

    for (const pair of candidatePairs) {
      if (pair.outcome === 'not_duplicate' || pair.outcome === 'ignored') {
        continue;
      }

      graphEdges.set(buildCanonicalAssetPairKey(pair.assetIdA, pair.assetIdB), {
        assetIdA: pair.assetIdA,
        assetIdB: pair.assetIdB
      });
    }

    const derivedGroups = deriveDuplicateGroups(Array.from(graphEdges.values()));
    const componentByAssetId = new Map<string, string[]>();
    for (const group of derivedGroups) {
      for (const assetId of group.assetIds) {
        componentByAssetId.set(assetId, group.assetIds);
      }
    }

    const assetIds = Array.from(
      new Set([
        ...candidatePairs.flatMap((pair) => [pair.assetIdA, pair.assetIdB]),
        ...confirmedPairs.flatMap((pair) => [pair.assetIdA, pair.assetIdB])
      ])
    );
    const assets = await findByIds(assetIds);
    const assetMap = buildAssetMap(assets);
    const confirmedResolutions = await DuplicateGroupResolutionModel.find(
      { resolutionStatus: 'confirmed' },
      { _id: 0 }
    ).lean<DuplicateGroupResolutionDocument[]>();

    const processedComponentKeys = new Set<string>();
    const csvRows: PerfectScoreCsvRow[] = [];
    let appliedPairUpdates = 0;
    let appliedGroupResolutions = 0;

    for (const pair of candidatePairs) {
      const assetIdsInComponent = componentByAssetId.get(pair.assetIdA);
      if (!assetIdsInComponent || !assetIdsInComponent.includes(pair.assetIdB)) {
        continue;
      }

      const componentKey = buildDuplicateGroupKey(assetIdsInComponent);
      if (processedComponentKeys.has(componentKey)) {
        continue;
      }
      processedComponentKeys.add(componentKey);

      const componentCandidatePairs = candidatePairs.filter(
        (candidate) =>
          assetIdsInComponent.includes(candidate.assetIdA) &&
          assetIdsInComponent.includes(candidate.assetIdB)
      );

      const assetsInComponent = assetIdsInComponent
        .map((assetId) => assetMap.get(assetId))
        .filter((asset): asset is MediaAsset => asset !== undefined);

      const relevantConfirmedResolutions = confirmedResolutions.filter((resolution) =>
        resolution.assetIds.some((assetId) => assetIdsInComponent.includes(assetId))
      );

      const componentDecision = evaluatePerfectScoreComponent({
        assetIds: assetIdsInComponent,
        assets: assetsInComponent,
        candidatePairs: componentCandidatePairs,
        confirmedResolutions: relevantConfirmedResolutions,
        ...(args.componentSizeMax !== undefined ? { componentSizeMax: args.componentSizeMax } : {})
      });

      csvRows.push(
        ...buildCsvRowsForComponent({
          componentDecision,
          candidatePairs: componentCandidatePairs,
          assetMap,
          apply: args.apply
        })
      );

      if (!args.apply || componentDecision.status !== 'ready' || !componentDecision.proposedKeeperAssetId || !componentDecision.proposedCanonicalAssetId) {
        continue;
      }

      for (const candidatePair of componentCandidatePairs) {
        const updated = await updateDuplicateCandidatePairReview({
          assetIdA: candidatePair.assetIdA,
          assetIdB: candidatePair.assetIdB,
          analysisVersion: candidatePair.analysisVersion,
          generationVersion: candidatePair.generationVersion,
          status: 'reviewed',
          outcome: 'confirmed_duplicate'
        });

        if (updated) {
          appliedPairUpdates += 1;
        }
      }

      const groupKey = componentDecision.componentKey;
      const existingResolution = await findDuplicateGroupResolutionByKey(groupKey);
      if (
        !existingResolution ||
        existingResolution.resolutionStatus !== 'confirmed' ||
        getResolvedCanonicalAssetId(existingResolution) !== componentDecision.proposedKeeperAssetId
      ) {
        await upsertDuplicateGroupResolution({
          groupKey,
          assetIds: componentDecision.assetIds,
          proposedCanonicalAssetId: componentDecision.proposedCanonicalAssetId,
          manualCanonicalAssetId: componentDecision.manualCanonicalAssetId,
          resolutionStatus: 'confirmed'
        });
        appliedGroupResolutions += 1;
      }
    }

    writeCsv(args.out, csvRows);

    return {
      csvRows,
      appliedPairUpdates,
      appliedGroupResolutions
    };
  } finally {
    await mongoose.disconnect();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const result = await runPerfectScoreDuplicateResolution(args);

  const skippedCount = result.csvRows.filter((row) => row.action === 'skip').length;
  const readyCount = result.csvRows.length - skippedCount;

  console.log(`Wrote ${result.csvRows.length} row(s) to ${args.out}`);
  console.log(`${readyCount} row(s) ready; ${skippedCount} row(s) skipped.`);

  if (args.apply) {
    console.log(`Applied ${result.appliedPairUpdates} duplicateCandidatePairs review update(s).`);
    console.log(`Applied ${result.appliedGroupResolutions} duplicateGroupResolutions update(s).`);
  } else {
    console.log('Dry run only. Re-run with --apply to persist reviewed pairs and keeper selections.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
