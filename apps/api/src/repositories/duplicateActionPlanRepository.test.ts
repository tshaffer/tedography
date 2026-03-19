import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateActionPlanFilter } from './duplicateActionPlanRepository.js';

test('buildDuplicateActionPlanFilter includes status, action type, and asset id', () => {
  assert.deepEqual(
    buildDuplicateActionPlanFilter({
      planStatus: 'approved',
      primaryActionType: 'PROPOSE_ARCHIVE_SECONDARY',
      assetId: 'asset-123'
    }),
    {
      planStatus: 'approved',
      primaryActionType: 'PROPOSE_ARCHIVE_SECONDARY',
      $or: [{ canonicalAssetId: 'asset-123' }, { secondaryAssetIds: 'asset-123' }]
    }
  );
});
