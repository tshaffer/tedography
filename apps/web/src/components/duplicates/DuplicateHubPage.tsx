import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { getDuplicateCandidatePairSummary, listDuplicateGroups } from '../../api/duplicateCandidatePairApi';
import { listDuplicateActionPlans } from '../../api/duplicateActionPlanApi';
import { listDuplicateReconciliations } from '../../api/duplicateReconciliationApi';
import { DuplicateWorkspaceNav } from './DuplicateWorkspaceNav';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '20px',
  boxSizing: 'border-box',
  background: '#f4f1ea',
  color: '#1e293b',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: '14px',
  backgroundColor: '#fffdf9',
  padding: '18px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
};

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
  marginTop: '18px'
};

const cardStyle: CSSProperties = {
  ...panelStyle,
  textDecoration: 'none',
  color: '#1e293b',
  display: 'grid',
  gap: '8px'
};

const countStyle: CSSProperties = {
  fontSize: '30px',
  fontWeight: 700,
  color: '#0f4c5c'
};

type HubCounts = {
  reviewCount: number | null;
  groupCount: number | null;
  planCount: number | null;
  reconciliationCount: number | null;
};

const defaultCounts: HubCounts = {
  reviewCount: null,
  groupCount: null,
  planCount: null,
  reconciliationCount: null
};

function formatCount(value: number | null): string {
  return value === null ? '—' : String(value);
}

export function DuplicateHubPage(): ReactElement {
  const [counts, setCounts] = useState<HubCounts>(defaultCounts);

  useEffect(() => {
    async function loadCounts(): Promise<void> {
      try {
        const [reviewSummary, groupsResponse, plansResponse, reconciliationsResponse] = await Promise.all([
          getDuplicateCandidatePairSummary(),
          listDuplicateGroups(),
          listDuplicateActionPlans(),
          listDuplicateReconciliations()
        ]);

        setCounts({
          reviewCount: reviewSummary.statusCounts.unreviewed,
          groupCount: groupsResponse.totalGroups,
          planCount: plansResponse.total,
          reconciliationCount: reconciliationsResponse.total
        });
      } catch {
        setCounts(defaultCounts);
      }
    }

    void loadCounts();
  }, []);

  return (
    <main style={pageStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>Duplicates</h1>
          <p style={{ margin: '8px 0 0 0', color: '#475569', maxWidth: '820px' }}>
            Use this workspace to work through the duplicate backlog, confirm canonical keepers, review archive plans, and inspect metadata reconciliation after execution.
          </p>
          <DuplicateWorkspaceNav active="overview" />
        </div>
        <Link
          to="/"
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          Back to Tedography
        </Link>
      </header>

      <section style={cardGridStyle}>
        <Link to="/duplicates/review" style={cardStyle}>
          <div style={countStyle}>{formatCount(counts.reviewCount)}</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Pair Review</div>
          <div style={{ color: '#475569' }}>
            Work through candidate pairs quickly with queue filters and one-pair-at-a-time review.
          </div>
        </Link>
        <Link to="/duplicates/groups" style={cardStyle}>
          <div style={countStyle}>{formatCount(counts.groupCount)}</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Groups</div>
          <div style={{ color: '#475569' }}>
            Confirm proposed canonical assets, override keepers, and inspect resolved duplicate groups.
          </div>
        </Link>
        <Link to="/duplicates/plans" style={cardStyle}>
          <div style={countStyle}>{formatCount(counts.planCount)}</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Plans</div>
          <div style={{ color: '#475569' }}>
            Review archive action plans, approvals, and execution history for real quarantine moves.
          </div>
        </Link>
        <Link to="/duplicates/reconciliations" style={cardStyle}>
          <div style={countStyle}>{formatCount(counts.reconciliationCount)}</div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Reconciliations</div>
          <div style={{ color: '#475569' }}>
            Inspect metadata provenance and see what safe additive metadata was merged onto the canonical asset.
          </div>
        </Link>
      </section>
    </main>
  );
}
