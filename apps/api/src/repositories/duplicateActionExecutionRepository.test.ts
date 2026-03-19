import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateActionExecutionFilter } from './duplicateActionExecutionRepository.js';

test('buildDuplicateActionExecutionFilter includes plan id and status', () => {
  assert.deepEqual(
    buildDuplicateActionExecutionFilter({
      planId: 'group-1',
      status: 'failed'
    }),
    {
      planId: 'group-1',
      status: 'failed'
    }
  );
});
