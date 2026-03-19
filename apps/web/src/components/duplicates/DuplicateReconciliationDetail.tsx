import React, { type CSSProperties, type ReactElement } from 'react';
import type { DuplicateReconciliationListItem } from '@tedography/shared';

interface DuplicateReconciliationDetailProps {
  reconciliation: DuplicateReconciliationListItem | null;
}

const sectionStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '12px',
  backgroundColor: '#fff',
  padding: '16px'
};

const mutedTextStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '14px'
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '12px'
};

const cardStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  backgroundColor: '#f8fafc',
  padding: '12px'
};

function formatArray(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '—';
}

export function DuplicateReconciliationDetail({
  reconciliation
}: DuplicateReconciliationDetailProps): ReactElement {
  if (!reconciliation) {
    return (
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Reconciliation Detail</h3>
        <p style={{ marginBottom: 0, ...mutedTextStyle }}>Select a reconciliation record to inspect its provenance.</p>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Reconciliation Detail</h3>
      <div style={{ ...mutedTextStyle, marginBottom: '12px' }}>
        Group <strong>{reconciliation.groupKey}</strong> · Status <strong>{reconciliation.status}</strong>
      </div>
      <div style={listStyle}>
        <article style={cardStyle}>
          <div><strong>Canonical Asset</strong>: {reconciliation.canonicalAsset?.filename ?? reconciliation.canonicalAssetId}</div>
          <div style={mutedTextStyle}>Sources: {formatArray(reconciliation.sourceSecondaryAssets.map((asset) => asset.filename))}</div>
          <div style={mutedTextStyle}>Plan Status: {reconciliation.actionPlanStatus ?? 'n/a'}</div>
          <div style={mutedTextStyle}>Latest Completed Execution: {reconciliation.latestCompletedExecutionStatus ?? 'n/a'}</div>
        </article>
        {reconciliation.entries.map((entry) => (
          <article style={cardStyle} key={entry.fieldName}>
            <div><strong>{entry.fieldName}</strong> · {entry.status}</div>
            <div style={mutedTextStyle}>Original Canonical Value: {formatArray(entry.originalCanonicalValue)}</div>
            <div style={mutedTextStyle}>Reconciled Value: {formatArray(entry.reconciledValue)}</div>
            <div style={mutedTextStyle}>Added Values: {formatArray(entry.addedValues)}</div>
            <div style={mutedTextStyle}>Contributors: {formatArray(entry.contributedAssetIds)}</div>
            <div style={{ ...mutedTextStyle, marginTop: '6px' }}>{entry.rationale.join(' ')}</div>
          </article>
        ))}
        {reconciliation.rationale.length > 0 ? (
          <article style={cardStyle}>
            <div><strong>Group Rationale</strong></div>
            <div style={{ ...mutedTextStyle, marginTop: '6px' }}>{reconciliation.rationale.join(' ')}</div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
