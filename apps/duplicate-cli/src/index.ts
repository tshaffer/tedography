import 'dotenv/config';

import { runGenerateCandidatesCommand } from './commands/generateCandidatesCommand.js';
import { runInspectCommand } from './commands/inspectCommand.js';
import { runScanCommand } from './commands/scanCommand.js';
import { runStatsCommand } from './commands/statsCommand.js';

function printUsage(): void {
  console.log('Usage:');
  console.log('  duplicate-cli scan --asset-scope all');
  console.log('  duplicate-cli scan --asset-scope missing-analysis');
  console.log('  duplicate-cli generate-candidates');
  console.log('  duplicate-cli generate-candidates --asset-id <id>');
  console.log('  duplicate-cli inspect --asset-id <id>');
  console.log('  duplicate-cli inspect --path "<path>"');
  console.log('  duplicate-cli stats');
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printUsage();
    return;
  }

  if (command === 'scan') {
    const assetScopeFlagIndex = rest.indexOf('--asset-scope');
    const assetScope =
      assetScopeFlagIndex >= 0 ? rest[assetScopeFlagIndex + 1] : 'missing-analysis';

    if (assetScope !== 'all' && assetScope !== 'missing-analysis') {
      throw new Error('scan requires --asset-scope all|missing-analysis');
    }

    await runScanCommand({ assetScope });
    return;
  }

  if (command === 'stats') {
    await runStatsCommand();
    return;
  }

  if (command === 'generate-candidates') {
    const analysisVersionFlagIndex = rest.indexOf('--analysis-version');
    const generationVersionFlagIndex = rest.indexOf('--generation-version');
    const limitFlagIndex = rest.indexOf('--limit');
    const assetIdFlagIndex = rest.indexOf('--asset-id');

    const analysisVersion =
      analysisVersionFlagIndex >= 0 ? rest[analysisVersionFlagIndex + 1] : undefined;
    const generationVersion =
      generationVersionFlagIndex >= 0 ? rest[generationVersionFlagIndex + 1] : undefined;
    const assetId = assetIdFlagIndex >= 0 ? rest[assetIdFlagIndex + 1] : undefined;
    const limitValue = limitFlagIndex >= 0 ? rest[limitFlagIndex + 1] : undefined;
    const onlyMissing = rest.includes('--only-missing');
    const limit =
      limitValue !== undefined && limitValue.trim().length > 0
        ? Number.parseInt(limitValue, 10)
        : undefined;

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
      throw new Error('generate-candidates requires --limit to be a positive integer');
    }

    const generateOptions: {
      analysisVersion?: string;
      generationVersion?: string;
      limit?: number;
      assetId?: string;
      onlyMissing?: boolean;
    } = {};

    if (analysisVersion !== undefined) {
      generateOptions.analysisVersion = analysisVersion;
    }
    if (generationVersion !== undefined) {
      generateOptions.generationVersion = generationVersion;
    }
    if (limit !== undefined) {
      generateOptions.limit = limit;
    }
    if (assetId !== undefined) {
      generateOptions.assetId = assetId;
    }
    if (onlyMissing) {
      generateOptions.onlyMissing = true;
    }

    await runGenerateCandidatesCommand(generateOptions);
    return;
  }

  if (command === 'inspect') {
    const assetIdFlagIndex = rest.indexOf('--asset-id');
    const pathFlagIndex = rest.indexOf('--path');
    const assetId = assetIdFlagIndex >= 0 ? rest[assetIdFlagIndex + 1] : undefined;
    const assetPath = pathFlagIndex >= 0 ? rest[pathFlagIndex + 1] : undefined;
    const inspectOptions: { assetId?: string; path?: string } = {};

    if (assetId !== undefined) {
      inspectOptions.assetId = assetId;
    }
    if (assetPath !== undefined) {
      inspectOptions.path = assetPath;
    }

    await runInspectCommand(inspectOptions);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown duplicate-cli error');
  process.exitCode = 1;
});
