import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateReconciliationFilter } from './duplicateReconciliationRepository.js';

test('buildDuplicateReconciliationFilter includes group, asset, and status filters', () => {
  assert.deepEqual(
    buildDuplicateReconciliationFilter({
      groupKey: 'group-1',
      assetId: 'asset-a',
      status: 'auto_applied'
    }),
    {
      groupKey: 'group-1',
      status: 'auto_applied',
      $or: [{ canonicalAssetId: 'asset-a' }, { sourceSecondaryAssetIds: 'asset-a' }]
    }
  );
});
