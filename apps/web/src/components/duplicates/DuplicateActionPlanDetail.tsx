import React, { type CSSProperties, type ReactElement } from 'react';
import type { DuplicateActionPlanListItem } from '@tedography/shared';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: '12px'
};

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px'
};

const cardStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  backgroundColor: '#fff',
  overflow: 'hidden'
};

const imageWrapStyle: CSSProperties = {
  height: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
};

const imageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain'
};

const bodyStyle: CSSProperties = {
  padding: '12px',
  display: 'grid',
  gap: '6px',
  fontSize: '14px'
};

interface DuplicateActionPlanDetailProps {
  plan: DuplicateActionPlanListItem;
}

export function DuplicateActionPlanDetail({ plan }: DuplicateActionPlanDetailProps): ReactElement {
  return (
    <div style={sectionStyle}>
      <section>
        <strong>Group:</strong> {plan.groupKey}
      </section>
      <section>
        <strong>Plan Status:</strong> {plan.planStatus}
      </section>
      <section>
        <strong>Primary Action:</strong> {plan.primaryActionType}
      </section>
      <section>
        <strong>Execution Readiness:</strong> {plan.executionReadiness}
      </section>
      <section>
        <strong>Rationale</strong>
        <ul>
          {plan.rationale.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
      <section>
        <strong>Canonical Asset</strong>
        {plan.canonicalAsset ? (
          <div style={cardGridStyle}>
            <article style={cardStyle}>
              <div style={imageWrapStyle}>
                <img
                  src={getDisplayMediaUrl(plan.canonicalAsset.id)}
                  alt={plan.canonicalAsset.filename}
                  style={imageStyle}
                />
              </div>
              <div style={bodyStyle}>
                <strong>{plan.canonicalAsset.filename}</strong>
                <div>Asset ID: {plan.canonicalAsset.id}</div>
                <div>Original Path: {plan.canonicalAsset.originalArchivePath ?? 'n/a'}</div>
              </div>
            </article>
          </div>
        ) : (
          <div>Canonical asset metadata unavailable.</div>
        )}
      </section>
      <section>
        <strong>Secondary Assets</strong>
        <div style={cardGridStyle}>
          {plan.secondaryAssets.map((asset) => {
            const actionItem = plan.actionItems.find((item) => item.assetId === asset.id);
            return (
              <article key={asset.id} style={cardStyle}>
                <div style={imageWrapStyle}>
                  <img src={getDisplayMediaUrl(asset.id)} alt={asset.filename} style={imageStyle} />
                </div>
                <div style={bodyStyle}>
                  <strong>{asset.filename}</strong>
                  <div>Asset ID: {asset.id}</div>
                  <div>Original Path: {asset.originalArchivePath ?? 'n/a'}</div>
                  <div>Planned Action: {actionItem?.actionType ?? 'n/a'}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section>
        <strong>Action Items</strong>
        <ul>
          {plan.actionItems.map((item) => (
            <li key={`${item.assetId}-${item.actionType}`}>
              {item.assetId}: {item.actionType} - {item.rationale.join(' ')}
            </li>
          ))}
        </ul>
      </section>
      {plan.reviewNote ? (
        <section>
          <strong>Review Note:</strong> {plan.reviewNote}
        </section>
      ) : null}
    </div>
  );
}

export default DuplicateActionPlanDetail;
