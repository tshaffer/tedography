#!/usr/bin/env tsx

/**
 * find-missing-transitive-duplicate-pairs.ts
 *
 * Finds "missing" duplicate candidate pairs implied by transitive confirmed-duplicate
 * relationships already present in duplicateCandidatePairs.
 *
 * Example:
 *   A-B confirmed duplicate
 *   B-C confirmed duplicate
 *   A-C does not exist as any pair row
 * => outputs A-C
 *
 * Output:
 *   CSV with assetIdA, assetIdB, componentSize, shortestPathLength, inferredViaPath
 *
 * Usage:
 *   pnpm tsx scripts/find-missing-transitive-duplicate-pairs.ts \
 *     --mongo-uri "$MONGO_URI" \
 *     --db-name tedography \
 *     --out ./scripts/output/missing_transitive_pairs.csv
 *
 * Notes:
 * - Uses duplicateCandidatePairs as the source.
 * - Only edges with outcome === 'confirmed_duplicate' are used to build the graph.
 * - A pair is considered "already explicit" if any row exists for that canonical pair,
 *   regardless of status/outcome.
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose, { Schema, type Model } from 'mongoose';

type DuplicateCandidatePairDoc = {
  assetIdA: string;
  assetIdB: string;
  status?: string | null;
  outcome?: string | null;
};

type CliArgs = {
  mongoUri: string;
  dbName: string;
  out: string;
  minComponentSize: number;
  maxPathLength?: number;
};

type MissingPairRow = {
  assetIdA: string;
  assetIdB: string;
  componentSize: number;
  shortestPathLength: number;
  inferredViaPath: string;
};

const duplicateCandidatePairSchema = new Schema<DuplicateCandidatePairDoc>(
  {
    assetIdA: { type: String, required: true },
    assetIdB: { type: String, required: true },
    status: { type: String, required: false },
    outcome: { type: String, required: false }
  },
  {
    collection: 'duplicateCandidatePairs',
    versionKey: false,
    strict: false
  }
);

function canonicalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function pairKey(a: string, b: string): string {
  const [x, y] = canonicalizePair(a, b);
  return `${x}::${y}`;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {
    dbName: 'tedography',
    out: path.resolve(process.cwd(), 'missing_transitive_pairs.csv'),
    minComponentSize: 3
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--mongo-uri':
        args.mongoUri = next;
        i += 1;
        break;
      case '--db-name':
        args.dbName = next;
        i += 1;
        break;
      case '--out':
        args.out = path.resolve(next);
        i += 1;
        break;
      case '--min-component-size':
        args.minComponentSize = Number(next);
        i += 1;
        break;
      case '--max-path-length':
        args.maxPathLength = Number(next);
        i += 1;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.mongoUri) {
    throw new Error('Missing required --mongo-uri');
  }

  return args as CliArgs;
}

function printHelp(): void {
  console.log(`
Usage:
  pnpm tsx scripts/find-missing-transitive-duplicate-pairs.ts \\
    --mongo-uri "$MONGO_URI" \\
    --db-name tedography \\
    --out ./scripts/output/missing_transitive_pairs.csv

Options:
  --mongo-uri <uri>            Mongo connection string (required)
  --db-name <name>             Database name (default: tedography)
  --out <path>                 Output CSV path
  --min-component-size <n>     Ignore components smaller than this (default: 3)
  --max-path-length <n>        Optional: only output missing pairs whose shortest
                               inferred path length is <= n
`);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath: string, rows: MissingPairRow[]): void {
  const header = [
    'assetIdA',
    'assetIdB',
    'componentSize',
    'shortestPathLength',
    'inferredViaPath'
  ];

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.assetIdA,
        row.assetIdB,
        row.componentSize,
        row.shortestPathLength,
        row.inferredViaPath
      ]
        .map(csvEscape)
        .join(',')
    )
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function buildConnectedComponents(adjacency: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;

    const stack = [start];
    const component: string[] = [];
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    component.sort();
    components.push(component);
  }

  return components;
}

function shortestPathWithinComponent(
  adjacency: Map<string, Set<string>>,
  start: string,
  target: string
): string[] | null {
  if (start === target) return [start];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const prev = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;

      visited.add(neighbor);
      prev.set(neighbor, current);

      if (neighbor === target) {
        const path: string[] = [target];
        let cursor = target;

        while (cursor !== start) {
          const p = prev.get(cursor);
          if (!p) break;
          path.push(p);
          cursor = p;
        }

        path.reverse();
        return path;
      }

      queue.push(neighbor);
    }
  }

  return null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  await mongoose.connect(args.mongoUri, {
    dbName: args.dbName
  });

  try {
    const DuplicateCandidatePair =
      (mongoose.models.DuplicateCandidatePair as Model<DuplicateCandidatePairDoc> | undefined) ??
      mongoose.model<DuplicateCandidatePairDoc>(
        'DuplicateCandidatePair',
        duplicateCandidatePairSchema
      );

    const allPairs = await DuplicateCandidatePair.find(
      {},
      {
        _id: 0,
        assetIdA: 1,
        assetIdB: 1,
        status: 1,
        outcome: 1
      }
    ).lean();

    const explicitPairKeys = new Set<string>();
    const adjacency = new Map<string, Set<string>>();

    for (const pair of allPairs) {
      const [a, b] = canonicalizePair(pair.assetIdA, pair.assetIdB);
      explicitPairKeys.add(pairKey(a, b));

      if (pair.outcome === 'confirmed_duplicate') {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
      }
    }

    const components = buildConnectedComponents(adjacency).filter(
      (component) => component.length >= args.minComponentSize
    );

    const missingRows: MissingPairRow[] = [];

    for (const component of components) {
      for (let i = 0; i < component.length; i += 1) {
        for (let j = i + 1; j < component.length; j += 1) {
          const a = component[i];
          const b = component[j];
          const key = pairKey(a, b);

          if (explicitPairKeys.has(key)) {
            continue;
          }

          const pathNodes = shortestPathWithinComponent(adjacency, a, b);
          if (!pathNodes || pathNodes.length < 3) {
            // length 2 would imply direct edge, which would already be explicit
            continue;
          }

          const shortestPathLength = pathNodes.length - 1;

          if (
            typeof args.maxPathLength === 'number' &&
            shortestPathLength > args.maxPathLength
          ) {
            continue;
          }

          missingRows.push({
            assetIdA: a,
            assetIdB: b,
            componentSize: component.length,
            shortestPathLength,
            inferredViaPath: pathNodes.join(' -> ')
          });
        }
      }
    }

    missingRows.sort((r1, r2) => {
      if (r1.componentSize !== r2.componentSize) {
        return r1.componentSize - r2.componentSize;
      }
      if (r1.shortestPathLength !== r2.shortestPathLength) {
        return r1.shortestPathLength - r2.shortestPathLength;
      }
      if (r1.assetIdA !== r2.assetIdA) {
        return r1.assetIdA.localeCompare(r2.assetIdA);
      }
      return r1.assetIdB.localeCompare(r2.assetIdB);
    });

    writeCsv(args.out, missingRows);

    console.log(`Wrote ${missingRows.length} missing transitive pair(s) to: ${args.out}`);
    console.log(`Components considered: ${components.length}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});