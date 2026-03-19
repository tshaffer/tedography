import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DuplicateActionExecutionListItem } from '@tedography/shared';
import { DuplicateActionExecutionHistory } from './DuplicateActionExecutionHistory';

function createExecution(status: DuplicateActionExecutionListItem['status']): DuplicateActionExecutionListItem {
  return {
    executionId: `exec-${status}`,
    planId: 'group-1',
    groupKey: 'group-1',
    operation: 'MOVE_TO_QUARANTINE',
    status,
    itemResults: [
      {
        assetId: 'asset-b',
        sourceStorageRootId: 'archive',
        sourceArchivePath: 'photos/asset-b.jpg',
        destinationStorageRootId: 'archive',
        destinationArchivePath: '.tedography-quarantine/duplicates/group-1/asset-b/asset-b.jpg',
        status: status === 'completed' ? 'succeeded' : 'failed',
        errorMessage: status === 'completed' ? null : 'source missing'
      }
    ],
    succeededCount: status === 'completed' ? 1 : 0,
    failedCount: status === 'completed' ? 0 : 1,
    skippedCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z'
  };
}

test('DuplicateActionExecutionHistory renders execution status and per-item results', () => {
  const markup = renderToStaticMarkup(
    <DuplicateActionExecutionHistory items={[createExecution('completed')]} />
  );

  assert.match(markup, /exec-completed/);
  assert.match(markup, /MOVE_TO_QUARANTINE|completed/);
  assert.match(markup, /asset-b/);
  assert.match(markup, /photos\/asset-b\.jpg/);
});
