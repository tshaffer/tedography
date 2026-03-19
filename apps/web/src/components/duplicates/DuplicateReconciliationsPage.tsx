import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DuplicateReconciliationListItem, DuplicateReconciliationStatus } from '@tedography/shared';
import {
  generateDuplicateReconciliations,
  getDuplicateReconciliation,
  listDuplicateReconciliations
} from '../../api/duplicateReconciliationApi';
import { DuplicateReconciliationDetail } from './DuplicateReconciliationDetail';
import { DuplicateWorkspaceNav } from './DuplicateWorkspaceNav';

type ReconciliationFilters = {
  status: DuplicateReconciliationStatus | 'all';
  assetId: string;
  groupKey: string;
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

const filterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '12px'
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

function renderSummaryCard(label: string, value: number, note?: string): ReactElement {
  return (
    <section style={{ ...panelStyle, padding: '14px' }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{note}</div> : null}
    </section>
  );
}

export function DuplicateReconciliationsPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<ReconciliationFilters>({
    status: 'all',
    assetId: searchParams.get('assetId') ?? '',
    groupKey: searchParams.get('groupKey') ?? ''
  });
  const [appliedFilters, setAppliedFilters] = useState<ReconciliationFilters>({
    status: 'all',
    assetId: searchParams.get('assetId') ?? '',
    groupKey: searchParams.get('groupKey') ?? ''
  });
  const [items, setItems] = useState<DuplicateReconciliationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DuplicateReconciliationListItem | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof listDuplicateReconciliations>>['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);

  async function loadItems(preferredId?: string | null): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await listDuplicateReconciliations({
        ...(appliedFilters.status !== 'all' ? { status: appliedFilters.status } : {}),
        ...(appliedFilters.assetId.trim() ? { assetId: appliedFilters.assetId.trim() } : {}),
        ...(appliedFilters.groupKey.trim() ? { groupKey: appliedFilters.groupKey.trim() } : {})
      });
      setItems(response.items);
      setSummary(response.summary);
      const nextId =
        preferredId && response.items.some((item) => item.reconciliationId === preferredId)
          ? preferredId
          : response.items[0]?.reconciliationId ?? null;
      setSelectedId(nextId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load duplicate reconciliations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [appliedFilters.assetId, appliedFilters.groupKey, appliedFilters.status]);

  useEffect(() => {
    async function loadSelected(): Promise<void> {
      if (!selectedId) {
        setSelectedItem(null);
        return;
      }

      try {
        const response = await getDuplicateReconciliation(selectedId);
        setSelectedItem(response.item);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reconciliation detail');
      }
    }

    void loadSelected();
  }, [selectedId]);

  async function handleGenerate(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await generateDuplicateReconciliations({ onlyMissing });
      setMessage(`Generated or refreshed ${response.generatedCount} reconciliations. Skipped ${response.skippedCount}.`);
      await loadItems(selectedId);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate duplicate reconciliations'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>Duplicate Reconciliations</h1>
          <p style={{ marginTop: '8px', color: '#475569', maxWidth: '800px' }}>
            Phase 10 auto-applies only safe additive metadata. Today that means album associations are unioned onto the canonical asset with per-group provenance.
          </p>
          <DuplicateWorkspaceNav active="reconciliations" />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" style={primaryButtonStyle} onClick={() => void handleGenerate()} disabled={busy}>
            {busy ? 'Generating…' : 'Generate Reconciliations'}
          </button>
        </div>
      </div>

      <section style={{ ...panelStyle, marginTop: '16px' }}>
        <div style={filterGridStyle}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as ReconciliationFilters['status']
                }))
              }
              style={inputStyle}
            >
              <option value="all">All</option>
              <option value="auto_applied">Auto Applied</option>
              <option value="no_changes">No Changes</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
            <span>Asset ID</span>
            <input
              value={draftFilters.assetId}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, assetId: event.target.value }))
              }
              style={inputStyle}
              placeholder="Optional asset id"
            />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
            <span>Group Key</span>
            <input
              value={draftFilters.groupKey}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, groupKey: event.target.value }))
              }
              style={inputStyle}
              placeholder="Optional group key"
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={buttonStyle} onClick={() => setAppliedFilters(draftFilters)}>
            Apply Filters
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            Only missing reconciliation records
          </label>
        </div>
        {message ? <p style={{ color: '#136f2d', marginBottom: 0 }}>{message}</p> : null}
        {error ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{error}</p> : null}
      </section>

      {summary ? (
        <section style={summaryGridStyle}>
          {renderSummaryCard('Total Records', summary.total)}
          {renderSummaryCard('Auto Applied', summary.statusCounts.auto_applied)}
          {renderSummaryCard('No Changes', summary.statusCounts.no_changes)}
          {renderSummaryCard('Added Album Links', summary.totalAddedAlbumAssociations)}
        </section>
      ) : null}

      <section style={shellStyle}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0, fontSize: '20px' }}>Reconciliation Queue</h2>
          <div style={{ color: '#64748b', marginBottom: '12px', fontSize: '14px' }}>
            {loading ? 'Loading…' : `${items.length} record${items.length === 1 ? '' : 's'} in current filter`}
          </div>
          <div style={sidebarListStyle}>
            {items.map((item) => (
              <button
                type="button"
                key={item.reconciliationId}
                style={{
                  ...listItemButtonStyle,
                  borderColor: item.reconciliationId === selectedId ? '#0f4c5c' : '#d4d4d8',
                  boxShadow:
                    item.reconciliationId === selectedId ? '0 0 0 2px rgba(15, 76, 92, 0.14)' : 'none'
                }}
                onClick={() => setSelectedId(item.reconciliationId)}
              >
                <div style={{ fontWeight: 700 }}>{item.canonicalAsset?.filename ?? item.canonicalAssetId}</div>
                <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{item.status}</div>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{item.groupKey}</div>
              </button>
            ))}
            {!loading && items.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '14px' }}>No reconciliation records match the current filter.</div>
            ) : null}
          </div>
        </aside>
        <section style={{ display: 'grid', gap: '16px' }}>
          <DuplicateReconciliationDetail reconciliation={selectedItem} />
        </section>
      </section>
    </main>
  );
}
