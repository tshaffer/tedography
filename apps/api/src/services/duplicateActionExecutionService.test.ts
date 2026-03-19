import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MediaType, PhotoState, type MediaAsset } from '@tedography/domain';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/tedography-test';
process.env.TEDOGRAPHY_DERIVED_ROOT ??= os.tmpdir();
process.env.TEDOGRAPHY_STORAGE_ROOTS ??= `archive|Archive|${os.tmpdir()}`;
process.env.TEDOGRAPHY_DUPLICATE_QUARANTINE_SUBDIR ??= '.tedography-quarantine/duplicates';

const {
  buildDuplicateQuarantineArchivePath,
  determineExecutionStatus,
  getDuplicateActionExecutionEligibilityError,
  moveAssetToQuarantineWithDependencies
} = await import('./duplicateActionExecutionService.js');

function createAsset(input: Partial<MediaAsset> & Pick<MediaAsset, 'id'>): MediaAsset {
  return {
    id: input.id,
    filename: input.filename ?? `${input.id}.jpg`,
    mediaType: input.mediaType ?? MediaType.Photo,
    photoState: input.photoState ?? PhotoState.New,
    importedAt: input.importedAt ?? '2026-01-01T00:00:00.000Z',
    originalStorageRootId: input.originalStorageRootId ?? 'archive',
    originalArchivePath: input.originalArchivePath ?? `photos/${input.id}.jpg`,
    originalFileSizeBytes: input.originalFileSizeBytes ?? 100,
    originalContentHash: input.originalContentHash ?? `${input.id}-hash`,
    originalFileFormat: input.originalFileFormat ?? 'jpg',
    displayStorageType: input.displayStorageType ?? 'archive-root',
    displayStorageRootId: input.displayStorageRootId ?? 'archive',
    displayArchivePath: input.displayArchivePath ?? `photos/${input.id}.jpg`,
    displayFileFormat: input.displayFileFormat ?? 'jpg',
    ...(input.displayDerivedPath !== undefined ? { displayDerivedPath: input.displayDerivedPath } : {}),
    ...(input.thumbnailStorageType !== undefined ? { thumbnailStorageType: input.thumbnailStorageType } : {}),
    ...(input.thumbnailDerivedPath !== undefined ? { thumbnailDerivedPath: input.thumbnailDerivedPath } : {}),
    ...(input.thumbnailFileFormat !== undefined ? { thumbnailFileFormat: input.thumbnailFileFormat } : {})
  };
}

test('buildDuplicateQuarantineArchivePath is deterministic and asset-specific', () => {
  assert.equal(
    buildDuplicateQuarantineArchivePath({
      quarantineSubdir: '.tedography-quarantine/duplicates',
      groupKey: 'group-1',
      assetId: 'asset-a',
      sourceArchivePath: 'photos/2024/IMG_0001.JPG'
    }),
    '.tedography-quarantine/duplicates/group-1/asset-a/IMG_0001.JPG'
  );
});

test('getDuplicateActionExecutionEligibilityError blocks invalid execution states', () => {
  assert.equal(
    getDuplicateActionExecutionEligibilityError({
      planStatus: 'proposed',
      executionReadiness: 'eligible_for_future_execution',
      groupResolutionStatus: 'confirmed',
      currentCanonicalAssetId: 'asset-a',
      planCanonicalAssetId: 'asset-a',
      hasCompletedExecution: false
    }),
    'Only approved plans can be executed.'
  );

  assert.equal(
    getDuplicateActionExecutionEligibilityError({
      planStatus: 'approved',
      executionReadiness: 'eligible_for_future_execution',
      groupResolutionStatus: 'confirmed',
      currentCanonicalAssetId: 'asset-a',
      planCanonicalAssetId: 'asset-a',
      hasCompletedExecution: true
    }),
    'This plan has already been executed successfully.'
  );

  assert.equal(
    getDuplicateActionExecutionEligibilityError({
      planStatus: 'approved',
      executionReadiness: 'eligible_for_future_execution',
      groupResolutionStatus: 'confirmed',
      currentCanonicalAssetId: 'asset-a',
      planCanonicalAssetId: 'asset-a',
      hasCompletedExecution: false,
      latestExecutionStatus: 'running'
    }),
    'This plan already has an execution in progress.'
  );

  assert.equal(
    getDuplicateActionExecutionEligibilityError({
      planStatus: 'approved',
      executionReadiness: 'eligible_for_future_execution',
      groupResolutionStatus: 'confirmed',
      currentCanonicalAssetId: 'asset-a',
      planCanonicalAssetId: 'asset-a',
      hasCompletedExecution: false
    }),
    null
  );
});

test('determineExecutionStatus distinguishes complete, partial, and full failure outcomes', () => {
  assert.equal(
    determineExecutionStatus([
      {
        assetId: 'a',
        sourceStorageRootId: 'archive',
        sourceArchivePath: 'a.jpg',
        destinationStorageRootId: 'archive',
        destinationArchivePath: 'q/a.jpg',
        status: 'succeeded',
        errorMessage: null
      }
    ]),
    'completed'
  );

  assert.equal(
    determineExecutionStatus([
      {
        assetId: 'a',
        sourceStorageRootId: 'archive',
        sourceArchivePath: 'a.jpg',
        destinationStorageRootId: 'archive',
        destinationArchivePath: 'q/a.jpg',
        status: 'succeeded',
        errorMessage: null
      },
      {
        assetId: 'b',
        sourceStorageRootId: 'archive',
        sourceArchivePath: 'b.jpg',
        destinationStorageRootId: 'archive',
        destinationArchivePath: 'q/b.jpg',
        status: 'failed',
        errorMessage: 'boom'
      }
    ]),
    'partially_failed'
  );

  assert.equal(
    determineExecutionStatus([
      {
        assetId: 'b',
        sourceStorageRootId: 'archive',
        sourceArchivePath: 'b.jpg',
        destinationStorageRootId: 'archive',
        destinationArchivePath: 'q/b.jpg',
        status: 'failed',
        errorMessage: 'boom'
      }
    ]),
    'failed'
  );
});

test('moveAssetToQuarantineWithDependencies moves a file and updates archive paths', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tedography-dup-exec-'));
  const sourceRelativePath = 'photos/asset-a.jpg';
  const sourceAbsolutePath = path.join(tempRoot, sourceRelativePath);
  await fs.mkdir(path.dirname(sourceAbsolutePath), { recursive: true });
  await fs.writeFile(sourceAbsolutePath, 'hello');

  const updates: Array<{ originalArchivePath: string; displayArchivePath?: string | null }> = [];

  const result = await moveAssetToQuarantineWithDependencies({
    asset: createAsset({ id: 'asset-a', originalArchivePath: sourceRelativePath, displayArchivePath: sourceRelativePath }),
    groupKey: 'group-1',
    quarantineSubdir: '.tedography-quarantine/duplicates',
    resolveStorageRootAbsolutePath: () => tempRoot,
    updateAssetArchivePath: async (input) => {
      updates.push({
        originalArchivePath: input.originalArchivePath,
        ...(input.displayArchivePath !== undefined ? { displayArchivePath: input.displayArchivePath } : {})
      });
      return createAsset({
        id: 'asset-a',
        originalArchivePath: input.originalArchivePath,
        displayArchivePath: input.displayArchivePath ?? input.originalArchivePath
      });
    }
  });

  assert.equal(result.status, 'succeeded');
  assert.match(result.destinationArchivePath, /\.tedography-quarantine\/duplicates\/group-1\/asset-a\/asset-a\.jpg$/);
  assert.equal(await fs.readFile(path.join(tempRoot, result.destinationArchivePath), 'utf8'), 'hello');
  await assert.rejects(fs.access(sourceAbsolutePath));
  assert.deepEqual(updates, [
    {
      originalArchivePath: result.destinationArchivePath,
      displayArchivePath: result.destinationArchivePath
    }
  ]);
});

test('moveAssetToQuarantineWithDependencies records failure and restores source when metadata update fails', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tedography-dup-exec-rollback-'));
  const sourceRelativePath = 'photos/asset-b.jpg';
  const sourceAbsolutePath = path.join(tempRoot, sourceRelativePath);
  await fs.mkdir(path.dirname(sourceAbsolutePath), { recursive: true });
  await fs.writeFile(sourceAbsolutePath, 'hello');

  const result = await moveAssetToQuarantineWithDependencies({
    asset: createAsset({ id: 'asset-b', originalArchivePath: sourceRelativePath, displayArchivePath: sourceRelativePath }),
    groupKey: 'group-2',
    quarantineSubdir: '.tedography-quarantine/duplicates',
    resolveStorageRootAbsolutePath: () => tempRoot,
    updateAssetArchivePath: async () => {
      throw new Error('db update failed');
    }
  });

  assert.equal(result.status, 'failed');
  assert.match(result.errorMessage ?? '', /db update failed/i);
  assert.equal(await fs.readFile(sourceAbsolutePath, 'utf8'), 'hello');
});
