import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type {
  DuplicateActionExecutionListItem,
  DuplicateActionPlanListItem,
  DuplicateActionPlanStatus,
  DuplicateActionType
} from '@tedography/shared';
import {
  createDuplicateActionExecution,
  listDuplicateActionExecutions,
  retryDuplicateActionExecution
} from '../../api/duplicateActionExecutionApi';
import {
  buildDuplicateActionPlansExportUrl,
  generateDuplicateActionPlans,
  getDuplicateActionPlan,
  listDuplicateActionPlans,
  updateDuplicateActionPlan
} from '../../api/duplicateActionPlanApi';
import { DuplicateActionExecutionHistory } from './DuplicateActionExecutionHistory';
import { DuplicateActionPlanDetail } from './DuplicateActionPlanDetail';
import { DuplicateWorkspaceNav } from './DuplicateWorkspaceNav';

type PlanFilters = {
  planStatus: DuplicateActionPlanStatus | 'all';
  primaryActionType: DuplicateActionType | 'all';
  assetId: string;
};

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

const shellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  gap: '16px',
  minHeight: 'calc(100vh - 120px)'
};

const sidebarListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  maxHeight: 'calc(100vh - 200px)',
  overflow: 'auto'
};

const listItemButtonStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #d4d4d8',
  borderRadius: '12px',
  padding: '12px',
  textAlign: 'left',
  backgroundColor: '#fff',
  cursor: 'pointer'
};

const buttonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 14px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer',
  fontWeight: 600
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#0f4c5c',
  borderColor: '#0f4c5c',
  color: '#ffffff'
};

const mutedButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#f8fafc'
};

const warningButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#9a3412',
  borderColor: '#9a3412',
  color: '#ffffff'
};

const filterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '12px'
};

const filterFieldStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '14px'
};

const inputStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  backgroundColor: '#fff'
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  margin: '18px 0'
};

const summaryCardStyle: CSSProperties = {
  ...panelStyle,
  padding: '14px'
};

const secondaryMetaStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '14px'
};

const defaultFilters: PlanFilters = {
  planStatus: 'all',
  primaryActionType: 'all',
  assetId: ''
};

function renderSummaryCard(label: string, value: number, note?: string): ReactElement {
  return (
    <section style={summaryCardStyle}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ ...secondaryMetaStyle, marginTop: '4px' }}>{note}</div> : null}
    </section>
  );
}

export function DuplicateActionPlansPage(): ReactElement {
  const [draftFilters, setDraftFilters] = useState<PlanFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<PlanFilters>(defaultFilters);
  const [items, setItems] = useState<DuplicateActionPlanListItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DuplicateActionPlanListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof listDuplicateActionPlans>>['summary'] | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [executions, setExecutions] = useState<DuplicateActionExecutionListItem[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);

  async function loadPlans(preferredPlanId?: string | null): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await listDuplicateActionPlans({
        ...(appliedFilters.planStatus !== 'all' ? { planStatus: appliedFilters.planStatus } : {}),
        ...(appliedFilters.primaryActionType !== 'all'
          ? { primaryActionType: appliedFilters.primaryActionType }
          : {}),
        ...(appliedFilters.assetId.trim() ? { assetId: appliedFilters.assetId.trim() } : {})
      });
      setItems(response.items);
      setSummary(response.summary);
      const nextPlanId =
        preferredPlanId && response.items.some((item) => item.planId === preferredPlanId)
          ? preferredPlanId
          : response.items[0]?.planId ?? null;
      setSelectedPlanId(nextPlanId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate action plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, [appliedFilters.assetId, appliedFilters.planStatus, appliedFilters.primaryActionType]);

  useEffect(() => {
    async function loadSelectedPlan(): Promise<void> {
      if (!selectedPlanId) {
        setSelectedPlan(null);
        setReviewNote('');
        setExecutions([]);
        return;
      }

      try {
        const [planResponse, executionResponse] = await Promise.all([
          getDuplicateActionPlan(selectedPlanId),
          listDuplicateActionExecutions({ planId: selectedPlanId })
        ]);
        setExecutionError(null);
        setExecutions(executionResponse.items);
        const response = planResponse;
        setSelectedPlan(response.item);
        setReviewNote(response.item.reviewNote ?? '');
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load duplicate action plan';
        setError(message);
        setExecutionError(message);
      }
    }

    void loadSelectedPlan();
  }, [selectedPlanId]);

  async function handleGeneratePlans(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await generateDuplicateActionPlans({ onlyMissing });
      setMessage(`Generated or refreshed ${response.generatedCount} plans. Skipped ${response.skippedCount}.`);
      await loadPlans(selectedPlanId);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate duplicate action plans');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePlan(planStatus: DuplicateActionPlanStatus): Promise<void> {
    if (!selectedPlan) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await updateDuplicateActionPlan(selectedPlan.planId, {
        planStatus,
        reviewNote
      });
      setSelectedPlan(response.item);
      setItems((previous) => previous.map((item) => (item.planId === response.item.planId ? response.item : item)));
      setMessage(`Updated plan ${response.item.planId} to ${response.item.planStatus}.`);
      await loadPlans(response.item.planId);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update duplicate action plan');
    } finally {
      setBusy(false);
    }
  }

  async function handleExecutePlan(): Promise<void> {
    if (!selectedPlan) {
      return;
    }

    const confirmed = window.confirm(
      `Execute approved quarantine move for plan ${selectedPlan.planId}? This performs real filesystem moves for ${selectedPlan.secondaryAssetIds.length} secondary asset(s).`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await createDuplicateActionExecution(selectedPlan.planId);
      setMessage(`Execution ${response.item.executionId} finished with status ${response.item.status}.`);
      await loadPlans(selectedPlan.planId);
      const executionResponse = await listDuplicateActionExecutions({ planId: selectedPlan.planId });
      setExecutions(executionResponse.items);
    } catch (executionError) {
      setExecutionError(
        executionError instanceof Error ? executionError.message : 'Failed to execute duplicate action plan'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryExecution(executionId: string): Promise<void> {
    const confirmed = window.confirm(
      `Retry failed or skipped items from execution ${executionId}? This performs real filesystem moves.`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setExecutionError(null);
    setMessage(null);

    try {
      const response = await retryDuplicateActionExecution(executionId);
      setMessage(`Retry execution ${response.item.executionId} finished with status ${response.item.status}.`);
      if (selectedPlan) {
        const executionResponse = await listDuplicateActionExecutions({ planId: selectedPlan.planId });
        setExecutions(executionResponse.items);
      }
    } catch (retryError) {
      setExecutionError(
        retryError instanceof Error ? retryError.message : 'Failed to retry duplicate action execution'
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedPlanIndex = useMemo(
    () => items.findIndex((item) => item.planId === selectedPlanId),
    [items, selectedPlanId]
  );

  const latestExecution = executions[0] ?? null;

  const summaryCards = summary
    ? [
        renderSummaryCard('Plans', summary.total),
        renderSummaryCard('Proposed', summary.statusCounts.proposed),
        renderSummaryCard('Needs Manual Review', summary.statusCounts.needs_manual_review),
        renderSummaryCard('Approved', summary.statusCounts.approved),
        renderSummaryCard('Eligible Later', summary.eligibleForFutureExecutionCount)
      ]
    : [];

  return (
    <div style={pageStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Duplicate Action Plans</h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b' }}>
            Generate safe dry-run archive plans for confirmed duplicate groups. No filesystem actions are executed here.
          </p>
          <DuplicateWorkspaceNav active="plans" />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={mutedButtonStyle} onClick={() => void loadPlans(selectedPlanId)}>
            Refresh
          </button>
        </div>
      </header>

      <section style={panelStyle}>
        <p style={{ marginTop: 0, color: '#9a3412', fontWeight: 700 }}>
          Real operation warning: execution from this page performs actual filesystem moves into quarantine.
        </p>
        <h2 style={{ marginTop: 0 }}>Plan Filters</h2>
        <div style={filterGridStyle}>
          <label style={filterFieldStyle}>
            <span>Plan Status</span>
            <select
              value={draftFilters.planStatus}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  planStatus: event.target.value as PlanFilters['planStatus']
                }))
              }
            >
              <option value="all">all</option>
              <option value="proposed">proposed</option>
              <option value="needs_manual_review">needs_manual_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Primary Action</span>
            <select
              value={draftFilters.primaryActionType}
              style={inputStyle}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  primaryActionType: event.target.value as PlanFilters['primaryActionType']
                }))
              }
            >
              <option value="all">all</option>
              <option value="PROPOSE_ARCHIVE_SECONDARY">PROPOSE_ARCHIVE_SECONDARY</option>
              <option value="NEEDS_MANUAL_REVIEW">NEEDS_MANUAL_REVIEW</option>
              <option value="KEEP_CANONICAL">KEEP_CANONICAL</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span>Asset ID</span>
            <input
              value={draftFilters.assetId}
              style={inputStyle}
              placeholder="Optional asset id"
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, assetId: event.target.value }))
              }
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => setAppliedFilters({ ...draftFilters, assetId: draftFilters.assetId.trim() })}
          >
            Apply Filters
          </button>
          <button type="button" style={mutedButtonStyle} onClick={() => {
            setDraftFilters(defaultFilters);
            setAppliedFilters(defaultFilters);
          }}>
            Reset Filters
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />
            Only generate missing plans
          </label>
          <button type="button" style={primaryButtonStyle} onClick={() => void handleGeneratePlans()} disabled={busy}>
            Generate Plans
          </button>
          <a
            href={buildDuplicateActionPlansExportUrl({
              ...(appliedFilters.planStatus !== 'all' ? { planStatus: appliedFilters.planStatus } : {}),
              ...(appliedFilters.primaryActionType !== 'all'
                ? { primaryActionType: appliedFilters.primaryActionType }
                : {}),
              ...(appliedFilters.assetId.trim() ? { assetId: appliedFilters.assetId.trim() } : {})
            })}
            style={{ ...mutedButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Export JSON Manifest
          </a>
        </div>
      </section>

      {summaryCards.length > 0 ? <div style={summaryGridStyle}>{summaryCards}</div> : null}
      {message ? <section style={panelStyle}>{message}</section> : null}
      {error ? <section style={panelStyle}>Failed to work with duplicate action plans: {error}</section> : null}
      {executionError ? <section style={panelStyle}>Execution error: {executionError}</section> : null}

      <div style={shellStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Plans</h2>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            {items.length} filtered plans
          </div>
          {loading ? <div>Loading plans...</div> : null}
          {!loading && items.length === 0 ? <div>No duplicate action plans match the current filter.</div> : null}
          <div style={sidebarListStyle}>
            {items.map((item) => (
              <button
                key={item.planId}
                type="button"
                style={{
                  ...listItemButtonStyle,
                  borderColor: selectedPlanId === item.planId ? '#0f4c5c' : '#d4d4d8'
                }}
                onClick={() => setSelectedPlanId(item.planId)}
              >
                <div style={{ fontWeight: 700 }}>{item.groupKey}</div>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  {item.planStatus}, {item.primaryActionType}
                </div>
                <div style={{ color: '#475569', fontSize: '13px', marginTop: '6px' }}>
                  Canonical: {item.canonicalAsset?.filename ?? item.canonicalAssetId}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main style={panelStyle}>
          {!selectedPlan ? (
            <div>Select a duplicate action plan to review its dry-run details.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedPlan.groupKey}</h2>
                  <div style={secondaryMetaStyle}>
                    Status {selectedPlan.planStatus}, readiness {selectedPlan.executionReadiness}
                  </div>
                </div>
                <div style={secondaryMetaStyle}>
                  Position {selectedPlanIndex >= 0 ? selectedPlanIndex + 1 : 0} of {items.length}
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <DuplicateActionPlanDetail plan={selectedPlan} />
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gap: '8px' }}>
                <label style={filterFieldStyle}>
                  <span>Review Note</span>
                  <textarea
                    value={reviewNote}
                    style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                    onChange={(event) => setReviewNote(event.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void handleUpdatePlan('approved')}
                  disabled={busy}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={warningButtonStyle}
                  onClick={() => void handleUpdatePlan('rejected')}
                  disabled={busy}
                >
                  Reject
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() => void handleUpdatePlan('needs_manual_review')}
                  disabled={busy}
                >
                  Mark Needs Manual Review
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void handleExecutePlan()}
                  disabled={
                    busy ||
                    selectedPlan.planStatus !== 'approved' ||
                    selectedPlan.executionReadiness !== 'eligible_for_future_execution'
                  }
                  title="Perform a real quarantine move for approved secondary duplicates."
                >
                  Execute Quarantine Move
                </button>
                <button
                  type="button"
                  style={mutedButtonStyle}
                  onClick={() => latestExecution ? void handleRetryExecution(latestExecution.executionId) : undefined}
                  disabled={
                    busy ||
                    !latestExecution ||
                    (latestExecution.status !== 'failed' && latestExecution.status !== 'partially_failed')
                  }
                >
                  Retry Failed Items
                </button>
              </div>

              <section style={{ marginTop: '18px' }}>
                <h3 style={{ marginTop: 0 }}>Execution History</h3>
                <DuplicateActionExecutionHistory items={executions} />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default DuplicateActionPlansPage;
