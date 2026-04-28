import type { CSSProperties } from 'react';
import type { PeopleRecognitionRunSummary } from '@tedography/shared';

interface PeopleRecognitionRunSummaryDialogProps {
  open: boolean;
  summary: PeopleRecognitionRunSummary;
  isRefreshing?: boolean;
  onClose: () => void;
  onReviewSuggestedMatches: () => void;
  onReviewUnmatchedFaces: () => void;
  onReviewIgnoredFaces: () => void;
  onShowNoFaceAssets: () => void;
  onShowFailedAssets: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1500,
  padding: '20px'
};

const dialogStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  maxHeight: 'min(90vh, 860px)',
  overflow: 'auto',
  borderRadius: '16px',
  border: '1px solid #d7dce2',
  backgroundColor: '#f3f4f6',
  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.24)',
  padding: '16px'
};

const panelStyle: CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #d7dce2',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '14px',
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)'
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '12px'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #c6d0da',
  borderRadius: '8px',
  backgroundColor: '#f7f9fb',
  color: '#163246',
  fontSize: '13px',
  fontWeight: 700,
  padding: '8px 12px',
  cursor: 'pointer'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f5f73',
  color: '#fff',
  borderColor: '#0f5f73'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.45,
  cursor: 'not-allowed'
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '5px 0',
  borderBottom: '1px solid #f0f2f5'
};

function SummaryRow({
  label,
  count,
  indent = 0,
  level = 'primary',
  warnIfNonZero = false
}: {
  label: string;
  count: number;
  indent?: number;
  level?: 'primary' | 'secondary' | 'tertiary';
  warnIfNonZero?: boolean;
}) {
  const isPrimary = level === 'primary';
  const isTertiary = level === 'tertiary';

  const labelStyle: CSSProperties = {
    fontSize: isPrimary ? '14px' : isTertiary ? '12px' : '13px',
    fontWeight: isPrimary ? 600 : isTertiary ? 400 : 500,
    color: isTertiary ? '#556677' : '#163246',
    paddingLeft: `${indent * 18}px`
  };

  const countStyle: CSSProperties = {
    fontSize: isPrimary ? '14px' : isTertiary ? '12px' : '13px',
    fontWeight: isPrimary ? 700 : 600,
    color: warnIfNonZero && count > 0 ? '#b00020' : isTertiary ? '#556677' : '#163246',
    minWidth: '32px',
    textAlign: 'right'
  };

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={countStyle}>{count}</span>
    </div>
  );
}

export function PeopleRecognitionRunSummaryDialog({
  open,
  summary,
  isRefreshing = false,
  onClose,
  onReviewSuggestedMatches,
  onReviewUnmatchedFaces,
  onReviewIgnoredFaces,
  onShowNoFaceAssets,
  onShowFailedAssets
}: PeopleRecognitionRunSummaryDialogProps) {
  if (!open) {
    return null;
  }

  const {
    scopeLabel,
    scopeType,
    requestedAssetIds,
    processedAssetIds,
    assetIdsWithSuggestedMatches,
    assetIdsWithConfirmedPeople,
    assetIdsWithUnmatchedFaces,
    assetIdsWithUserIgnoredFaces,
    assetIdsWithPipelineIgnoredFaces,
    assetIdsWithNoFacesDetected,
    failedAssetIds,
    notProcessedAssetIds
  } = summary;

  // Unique set of processed assets needing at least one human decision.
  // Pipeline-auto-ignored faces count as pending (user hasn't reviewed them);
  // user-ignored faces do not (deliberate decision already made).
  const pendingSet = new Set([
    ...assetIdsWithSuggestedMatches,
    ...assetIdsWithUnmatchedFaces,
    ...assetIdsWithPipelineIgnoredFaces
  ]);
  const pendingAttentionCount = pendingSet.size;
  const noChangesNeededCount = processedAssetIds.length - pendingAttentionCount;

  // Confirmed People split: fully resolved vs. still has pending faces.
  const confirmedNoPendingCount = assetIdsWithConfirmedPeople.filter((id) => !pendingSet.has(id)).length;
  const confirmedWithPendingCount = assetIdsWithConfirmedPeople.filter((id) => pendingSet.has(id)).length;

  const suggested = assetIdsWithSuggestedMatches.length;
  const unmatched = assetIdsWithUnmatchedFaces.length;
  const userIgnored = assetIdsWithUserIgnoredFaces.length;
  const pipelineIgnored = assetIdsWithPipelineIgnoredFaces.length;
  const noFaces = assetIdsWithNoFacesDetected.length;
  const failed = failedAssetIds.length;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <section style={panelStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px' }}>People Recognition Run Summary</h2>
              <div style={{ fontSize: '13px', color: '#5b6673' }}>People Recognition Run Complete</div>
            </div>
            <button type="button" style={buttonStyle} onClick={onClose}>
              Done
            </button>
          </div>
          <div style={badgeRowStyle}>
            <span style={badgeStyle}>Scope: {scopeType}</span>
            <span style={badgeStyle}>{scopeLabel}</span>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#163246' }}>Results</div>
            {isRefreshing ? (
              <div style={{ fontSize: '12px', color: '#5b6673' }}>Refreshing…</div>
            ) : null}
          </div>

          <SummaryRow label="Assets Submitted" count={requestedAssetIds.length} level="primary" />
          <SummaryRow label="Assets Processed" count={processedAssetIds.length} level="primary" />
          <SummaryRow label="No Changes Needed or Suggested" count={noChangesNeededCount} level="secondary" indent={1} />
          <SummaryRow label="Confirmed People" count={confirmedNoPendingCount} level="tertiary" indent={2} />
          <SummaryRow label="User Ignored Faces" count={userIgnored} level="tertiary" indent={2} />
          <SummaryRow label="Pending Attention" count={pendingAttentionCount} level="secondary" indent={1} />
          <SummaryRow label="Confirmed People" count={confirmedWithPendingCount} level="tertiary" indent={2} />
          <SummaryRow label="Auto-Ignored by Engine" count={pipelineIgnored} level="tertiary" indent={2} />
          <SummaryRow label="Suggested Matches" count={suggested} level="tertiary" indent={2} />
          <SummaryRow label="Unmatched Faces" count={unmatched} level="tertiary" indent={2} />
          <SummaryRow label="Failed" count={failed} level="primary" warnIfNonZero />
          <SummaryRow label="Not Processed" count={notProcessedAssetIds.length} level="primary" />
        </section>

        <section style={panelStyle}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#163246', marginBottom: '10px' }}>
            Review Next
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={suggested > 0 && !isRefreshing ? primaryButtonStyle : disabledButtonStyle}
              disabled={suggested === 0 || isRefreshing}
              onClick={onReviewSuggestedMatches}
            >
              Review Suggested Matches ({suggested})
            </button>
            <button
              type="button"
              style={unmatched > 0 && !isRefreshing ? primaryButtonStyle : disabledButtonStyle}
              disabled={unmatched === 0 || isRefreshing}
              onClick={onReviewUnmatchedFaces}
            >
              Review Unmatched Faces ({unmatched})
            </button>
            <button
              type="button"
              style={pipelineIgnored > 0 && !isRefreshing ? buttonStyle : disabledButtonStyle}
              disabled={pipelineIgnored === 0 || isRefreshing}
              onClick={onReviewIgnoredFaces}
            >
              Review Auto-Ignored Faces ({pipelineIgnored})
            </button>
            <button
              type="button"
              style={noFaces > 0 && !isRefreshing ? buttonStyle : disabledButtonStyle}
              disabled={noFaces === 0 || isRefreshing}
              onClick={onShowNoFaceAssets}
            >
              Show No-Face Assets ({noFaces})
            </button>
            <button
              type="button"
              style={failed > 0 && !isRefreshing ? buttonStyle : disabledButtonStyle}
              disabled={failed === 0 || isRefreshing}
              onClick={onShowFailedAssets}
            >
              Show Failed Assets ({failed})
            </button>
            <button type="button" style={buttonStyle} onClick={onClose}>
              Return to Album
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
