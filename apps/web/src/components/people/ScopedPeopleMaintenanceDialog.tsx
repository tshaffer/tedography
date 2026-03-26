import { type CSSProperties } from 'react';
import type { PeopleScopedAssetSummaryResponse } from '../../api/peoplePipelineApi';

interface ScopedPeopleMaintenanceDialogProps {
  open: boolean;
  scopeLabel: string;
  scopeSourceLabel: string;
  assetCount: number;
  summary: PeopleScopedAssetSummaryResponse | null;
  summaryLoading: boolean;
  busyAction: null | 'process' | 'reprocess';
  errorMessage: string | null;
  noticeMessage: string | null;
  onClose: () => void;
  onRunRecognition: () => void;
  onReprocessRecognition: () => void;
  onOpenReview: () => void;
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
  width: 'min(760px, 100%)',
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
  opacity: 0.55,
  cursor: 'not-allowed'
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px'
};

const badgeStyle: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #d5dbe3',
  backgroundColor: '#f8fafc',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 700
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px'
};

const summaryCardStyle: CSSProperties = {
  border: '1px solid #d7dce2',
  borderRadius: '12px',
  backgroundColor: '#f8fafc',
  padding: '12px'
};

const summaryLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#556677',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px'
};

export function ScopedPeopleMaintenanceDialog({
  open,
  scopeLabel,
  scopeSourceLabel,
  assetCount,
  summary,
  summaryLoading,
  busyAction,
  errorMessage,
  noticeMessage,
  onClose,
  onRunRecognition,
  onReprocessRecognition,
  onOpenReview
}: ScopedPeopleMaintenanceDialogProps) {
  if (!open) {
    return null;
  }

  const isBusy = busyAction !== null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <section style={panelStyle}>
          <div style={headerRowStyle}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '30px' }}>Scoped People Tools</h2>
              <div style={{ fontSize: '13px', color: '#5b6673' }}>
                Run people recognition or jump into review for a manageable subset instead of the whole archive.
              </div>
            </div>
            <button type="button" style={buttonStyle} onClick={onClose}>
              Done
            </button>
          </div>

          <div style={badgeRowStyle}>
            <span style={badgeStyle}>Scope: {scopeSourceLabel}</span>
            <span style={badgeStyle}>{assetCount} assets</span>
          </div>

          <div style={{ fontSize: '14px', color: '#163246', marginBottom: '12px' }}>{scopeLabel}</div>

          {assetCount > 150 ? (
            <div style={{ fontSize: '12px', color: '#8a5200', marginBottom: '12px' }}>
              Large scope: this first version processes assets by iterating the existing per-asset people pipeline.
            </div>
          ) : null}

          {errorMessage ? <p style={{ color: '#a32222', marginBottom: 0 }}>{errorMessage}</p> : null}
          {noticeMessage ? <p style={{ color: '#15603a', marginBottom: 0 }}>{noticeMessage}</p> : null}
        </section>

        <section style={panelStyle}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#163246', marginBottom: '10px' }}>
            People status in this scope
          </div>
          {summaryLoading ? (
            <div style={{ color: '#5b6673', fontSize: '13px' }}>Loading scoped people summary...</div>
          ) : summary ? (
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>Assets In Scope</span>
                <strong>{summary.totalAssets}</strong>
              </div>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>With Confirmed People</span>
                <strong>{summary.assetsWithConfirmedPeople}</strong>
              </div>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>Without Confirmed People</span>
                <strong>{summary.assetsWithoutConfirmedPeople}</strong>
              </div>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>Assets With Reviewable Faces</span>
                <strong>{summary.assetsWithReviewableFaces}</strong>
              </div>
              <div style={summaryCardStyle}>
                <span style={summaryLabelStyle}>Reviewable Detections</span>
                <strong>{summary.totalReviewableDetections}</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: '#5b6673', fontSize: '13px' }}>No scoped people summary is available yet.</div>
          )}
        </section>

        <section style={panelStyle}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#163246', marginBottom: '10px' }}>
            Actions
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={isBusy ? disabledButtonStyle : primaryButtonStyle}
              disabled={isBusy}
              onClick={onRunRecognition}
            >
              {busyAction === 'process' ? 'Running People...' : `Run People Recognition (${assetCount})`}
            </button>
            <button
              type="button"
              style={isBusy ? disabledButtonStyle : buttonStyle}
              disabled={isBusy}
              onClick={onReprocessRecognition}
            >
              {busyAction === 'reprocess' ? 'Reprocessing...' : `Reprocess People Recognition (${assetCount})`}
            </button>
            <button
              type="button"
              style={isBusy ? disabledButtonStyle : buttonStyle}
              disabled={isBusy}
              onClick={onOpenReview}
            >
              Review Faces In Scope
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#5b6673' }}>
            Confirmed people are based on derived <code>mediaAsset.people</code>. Reviewable faces are unresolved detections and stay separate until reviewed.
          </div>
        </section>
      </div>
    </div>
  );
}
