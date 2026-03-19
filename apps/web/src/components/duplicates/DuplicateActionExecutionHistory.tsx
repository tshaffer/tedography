import React, { type CSSProperties, type ReactElement } from 'react';
import type { DuplicateActionExecutionListItem } from '@tedography/shared';

const cardStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '12px'
};

const secondaryMetaStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '14px'
};

interface DuplicateActionExecutionHistoryProps {
  items: DuplicateActionExecutionListItem[];
}

export function DuplicateActionExecutionHistory({
  items
}: DuplicateActionExecutionHistoryProps): ReactElement {
  if (items.length === 0) {
    return <div style={secondaryMetaStyle}>No execution runs recorded for this plan yet.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.map((execution) => (
        <article key={execution.executionId} style={cardStyle}>
          <div style={{ fontWeight: 700 }}>{execution.executionId}</div>
          <div style={secondaryMetaStyle}>
            {execution.status} • succeeded {execution.succeededCount} • failed {execution.failedCount} • skipped {execution.skippedCount}
          </div>
          <div style={secondaryMetaStyle}>
            Started: {execution.startedAt ?? 'n/a'} • Completed: {execution.completedAt ?? 'n/a'}
          </div>
          <ul>
            {execution.itemResults.map((result) => (
              <li key={`${execution.executionId}-${result.assetId}`}>
                {result.assetId}: {result.status} • {result.sourceArchivePath} → {result.destinationArchivePath}
                {result.errorMessage ? ` • ${result.errorMessage}` : ''}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export default DuplicateActionExecutionHistory;
