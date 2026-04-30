import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { Keyword, KeywordTreeNode } from '@tedography/domain';
import {
  createKeyword,
  deleteKeyword,
  listKeywordTree,
  listKeywords,
  updateKeywordLabel,
  updateKeywordParent
} from '../../api/keywordApi';
import {
  buildKeywordMap,
  collectKeywordDescendantIds,
  formatKeywordPathLabel,
  sortKeywordsByPath
} from '../../utilities/keywords';

const sectionStyle: CSSProperties = {
  borderTop: '1px solid #efefef',
  paddingTop: '12px',
  marginTop: '12px',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column'
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '14px'
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#666'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '12px',
  flex: 1,
  minHeight: 0
};

const bodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)',
  gap: '12px',
  minHeight: 0,
  flex: 1
};

const treePanelStyle: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: '8px',
  padding: '10px',
  overflow: 'auto'
};

const treeListStyle: CSSProperties = {
  display: 'grid',
  gap: '1px'
};

const treeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: '12px',
  gap: '2px'
};

const expandToggleStyle: CSSProperties = {
  width: '20px',
  minWidth: '20px',
  height: '20px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: 0,
  fontSize: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#888',
  flexShrink: 0
};

const expandSpacerStyle: CSSProperties = {
  width: '20px',
  minWidth: '20px',
  flexShrink: 0
};

const treeButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: 'left',
  appearance: 'none',
  WebkitAppearance: 'none',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '3px 8px',
  fontSize: '13px'
};

const selectedTreeButtonStyle: CSSProperties = {
  ...treeButtonStyle,
  backgroundColor: '#eef4ff',
  boxShadow: 'inset 0 0 0 1px #c7dafd'
};

const controlGroupStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  border: '1px solid #ececec',
  borderRadius: '8px',
  padding: '10px'
};

const controlRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

const inputStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #c8c8c8',
  fontSize: '13px'
};

const selectStyle: CSSProperties = {
  ...inputStyle
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '2px 8px',
  fontSize: '11px',
  border: '1px solid #d7d7d7',
  backgroundColor: '#fafafa',
  color: '#555'
};

interface KeywordHierarchySectionProps {
  open: boolean;
  onKeywordsChanged?: (() => void) | undefined;
}


function renderTreeRows(
  nodes: KeywordTreeNode[],
  selectedKeywordId: string | null,
  expandedIds: Set<string>,
  onSelect: (keywordId: string) => void,
  onToggleExpand: (keywordId: string) => void,
  depth = 0
): ReactElement[] {
  return nodes.flatMap((node) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    const rows: ReactElement[] = [
      <div key={node.id} style={{ ...treeRowStyle, paddingLeft: `${depth * 18}px` }}>
        {hasChildren ? (
          <button
            type="button"
            style={expandToggleStyle}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onToggleExpand(node.id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={expandSpacerStyle} />
        )}
        <button
          type="button"
          style={selectedKeywordId === node.id ? selectedTreeButtonStyle : treeButtonStyle}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(node.id)}
          title={node.label}
        >
          {node.label}
        </button>
      </div>
    ];

    if (hasChildren && isExpanded) {
      rows.push(...renderTreeRows(node.children, selectedKeywordId, expandedIds, onSelect, onToggleExpand, depth + 1));
    }

    return rows;
  });
}

export function KeywordHierarchySection({ open, onKeywordsChanged }: KeywordHierarchySectionProps) {
  const [tree, setTree] = useState<KeywordTreeNode[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState('');
  const [newRootLabel, setNewRootLabel] = useState('');
  const [newChildLabel, setNewChildLabel] = useState('');
  const [pendingParentKeywordId, setPendingParentKeywordId] = useState<string>('__none__');
  const [actionBusy, setActionBusy] = useState<null | 'rename' | 'create-root' | 'create-child' | 'reparent' | 'delete'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);

  function toggleExpand(id: string): void {
    setExpandedIds((current) => {
      const base = current ?? new Set<string>();
      const next = new Set(base);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function refreshKeywords(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [treeResponse, listResponse] = await Promise.all([listKeywordTree(), listKeywords()]);
      const sortedKeywords = sortKeywordsByPath(listResponse.items);
      setTree(treeResponse.items);
      setKeywords(sortedKeywords);
      setSelectedKeywordId((current) =>
        current && sortedKeywords.some((keyword) => keyword.id === current) ? current : null
      );
      setExpandedIds((current) =>
        current === null ? new Set<string>() : current
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshKeywords();
  }, [open]);

  const keywordMap = useMemo(() => buildKeywordMap(keywords), [keywords]);
  const selectedKeyword = useMemo(
    () => (selectedKeywordId ? keywordMap.get(selectedKeywordId) ?? null : null),
    [keywordMap, selectedKeywordId]
  );
  const invalidParentIds = useMemo(() => {
    if (!selectedKeyword) {
      return new Set<string>();
    }

    return collectKeywordDescendantIds(keywords, selectedKeyword.id);
  }, [keywords, selectedKeyword]);

  useEffect(() => {
    setPendingParentKeywordId(selectedKeyword?.parentKeywordId ?? '__none__');
    setRenameLabel(selectedKeyword?.label ?? '');
    setConfirmingDelete(false);
  }, [selectedKeyword]);

  async function handleRenameKeyword(): Promise<void> {
    if (!selectedKeyword) {
      return;
    }

    const label = renameLabel.trim().replace(/\s+/g, ' ');
    if (label.length === 0) {
      return;
    }

    setActionBusy('rename');
    setError(null);
    setNotice(null);

    try {
      const response = await updateKeywordLabel(selectedKeyword.id, { label });
      setRenameLabel(response.item.label);
      setNotice(`Renamed keyword to "${response.item.label}".`);
      await refreshKeywords();
      onKeywordsChanged?.();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Failed to rename keyword');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateRootKeyword(): Promise<void> {
    const label = newRootLabel.trim().replace(/\s+/g, ' ');
    if (label.length === 0) {
      return;
    }

    setActionBusy('create-root');
    setError(null);
    setNotice(null);

    try {
      await createKeyword({ label });
      setNewRootLabel('');
      setNotice(`Created root keyword "${label}".`);
      await refreshKeywords();
      onKeywordsChanged?.();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create root keyword');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateChildKeyword(): Promise<void> {
    if (!selectedKeyword) {
      return;
    }

    const labels = newChildLabel
      .split('\n')
      .map((line) => line.trim().replace(/\s+/g, ' '))
      .filter((line) => line.length > 0);

    if (labels.length === 0) {
      return;
    }

    setActionBusy('create-child');
    setError(null);
    setNotice(null);

    try {
      for (const label of labels) {
        await createKeyword({ label, parentKeywordId: selectedKeyword.id });
      }
      setNewChildLabel('');
      const parentPath = formatKeywordPathLabel(selectedKeyword, keywordMap);
      setNotice(
        labels.length === 1
          ? `Created "${labels[0]}" under ${parentPath}.`
          : `Created ${labels.length} keywords under ${parentPath}.`
      );
      await refreshKeywords();
      onKeywordsChanged?.();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create child keyword');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReparentKeyword(): Promise<void> {
    if (!selectedKeyword) {
      return;
    }

    const nextParentKeywordId = pendingParentKeywordId === '__none__' ? null : pendingParentKeywordId;
    setActionBusy('reparent');
    setError(null);
    setNotice(null);

    try {
      await updateKeywordParent(selectedKeyword.id, { parentKeywordId: nextParentKeywordId });
      setNotice(
        nextParentKeywordId
          ? `Moved ${selectedKeyword.label} under ${
              keywordMap.get(nextParentKeywordId)?.label ?? 'selected parent'
            }.`
          : `Moved ${selectedKeyword.label} to the root level.`
      );
      await refreshKeywords();
      onKeywordsChanged?.();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update keyword parent');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDeleteKeyword(): Promise<void> {
    if (!selectedKeyword) {
      return;
    }

    setActionBusy('delete');
    setError(null);
    setNotice(null);
    setConfirmingDelete(false);

    try {
      const response = await deleteKeyword(selectedKeyword.id);
      const count = response.deletedIds.length;
      setNotice(
        count === 1
          ? `Deleted keyword "${selectedKeyword.label}".`
          : `Deleted "${selectedKeyword.label}" and ${count - 1} descendant${count - 1 === 1 ? '' : 's'}.`
      );
      setSelectedKeywordId(null);
      await refreshKeywords();
      onKeywordsChanged?.();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete keyword');
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Keyword Hierarchy</h3>
      <p style={mutedTextStyle}>
        Organize keywords into a parent-child tree. Existing flat keywords remain valid root keywords.
      </p>
      <div style={panelStyle}>
        {loading ? <p style={mutedTextStyle}>Loading keywords...</p> : null}
        {error ? <p style={{ ...mutedTextStyle, color: '#b00020' }}>{error}</p> : null}
        {notice ? <p style={{ ...mutedTextStyle, color: '#22543d' }}>{notice}</p> : null}
        <div style={bodyStyle}>
          <div style={treePanelStyle}>
            <div style={controlRowStyle}>
              <span style={badgeStyle}>{keywords.length} keywords</span>
              {selectedKeyword ? (
                <span style={badgeStyle}>
                  Selected: {formatKeywordPathLabel(selectedKeyword, keywordMap)}
                </span>
              ) : (
                <span style={badgeStyle}>No keyword selected</span>
              )}
            </div>
            <div style={{ ...treeListStyle, marginTop: '10px' }}>
              {tree.length > 0 ? (
                renderTreeRows(tree, selectedKeywordId, expandedIds ?? new Set(), setSelectedKeywordId, toggleExpand)
              ) : (
                <p style={mutedTextStyle}>No keywords exist yet.</p>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px', alignContent: 'start', overflowY: 'auto' }}>
            <section style={controlGroupStyle}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>Create Root Keyword</h4>
              <input
                type="text"
                value={newRootLabel}
                onChange={(event) => setNewRootLabel(event.target.value)}
                placeholder="Keyword label"
                style={inputStyle}
              />
              <button
                type="button"
                style={newRootLabel.trim().length > 0 && actionBusy === null ? buttonStyle : disabledButtonStyle}
                disabled={newRootLabel.trim().length === 0 || actionBusy !== null}
                onClick={() => void handleCreateRootKeyword()}
              >
                {actionBusy === 'create-root' ? 'Creating...' : 'Create Root Keyword'}
              </button>
            </section>
            <section style={controlGroupStyle}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>Create Child Keywords</h4>
              <p style={mutedTextStyle}>
                {selectedKeyword
                  ? `Selected parent: ${formatKeywordPathLabel(selectedKeyword, keywordMap)}`
                  : 'Select a keyword in the tree first.'}
              </p>
              <textarea
                value={newChildLabel}
                onChange={(event) => setNewChildLabel(event.target.value)}
                placeholder="One child keyword per line"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
                disabled={!selectedKeyword}
                rows={3}
              />
              <button
                type="button"
                style={
                  selectedKeyword && newChildLabel.trim().length > 0 && actionBusy === null
                    ? buttonStyle
                    : disabledButtonStyle
                }
                disabled={!selectedKeyword || newChildLabel.trim().length === 0 || actionBusy !== null}
                onClick={() => void handleCreateChildKeyword()}
              >
                {actionBusy === 'create-child' ? 'Creating...' : 'Create Child Keywords'}
              </button>
            </section>
            <section style={controlGroupStyle}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>Delete Selected Keyword</h4>
              <p style={mutedTextStyle}>
                {selectedKeyword
                  ? (() => {
                      const descendantCount = collectKeywordDescendantIds(keywords, selectedKeyword.id).size - 1;
                      return descendantCount > 0
                        ? `Deletes "${selectedKeyword.label}" and its ${descendantCount} descendant${descendantCount === 1 ? '' : 's'}. Also removes the keyword from any tagged assets.`
                        : `Deletes "${selectedKeyword.label}" and removes it from any tagged assets.`;
                    })()
                  : 'Select a keyword in the tree first.'}
              </p>
              {confirmingDelete ? (
                <div style={controlRowStyle}>
                  <span style={{ ...mutedTextStyle, color: '#b00020' }}>Are you sure?</span>
                  <button
                    type="button"
                    style={actionBusy === null ? { ...buttonStyle, borderColor: '#b00020', color: '#b00020' } : disabledButtonStyle}
                    disabled={actionBusy !== null}
                    onClick={() => void handleDeleteKeyword()}
                  >
                    {actionBusy === 'delete' ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    style={actionBusy === null ? buttonStyle : disabledButtonStyle}
                    disabled={actionBusy !== null}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  style={selectedKeyword && actionBusy === null ? buttonStyle : disabledButtonStyle}
                  disabled={!selectedKeyword || actionBusy !== null}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete Keyword
                </button>
              )}
            </section>
            <section style={controlGroupStyle}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>Rename Selected Keyword</h4>
              <p style={mutedTextStyle}>
                {selectedKeyword
                  ? `Current label: ${selectedKeyword.label}`
                  : 'Select a keyword in the tree first.'}
              </p>
              <input
                type="text"
                value={renameLabel}
                onChange={(event) => setRenameLabel(event.target.value)}
                placeholder="Keyword label"
                style={inputStyle}
                disabled={!selectedKeyword}
              />
              <div style={controlRowStyle}>
                <button
                  type="button"
                  style={
                    selectedKeyword && renameLabel.trim().length > 0 && actionBusy === null
                      ? buttonStyle
                      : disabledButtonStyle
                  }
                  disabled={!selectedKeyword || renameLabel.trim().length === 0 || actionBusy !== null}
                  onClick={() => void handleRenameKeyword()}
                >
                  {actionBusy === 'rename' ? 'Renaming...' : 'Rename Keyword'}
                </button>
                <button
                  type="button"
                  style={selectedKeyword && actionBusy === null ? buttonStyle : disabledButtonStyle}
                  disabled={!selectedKeyword || actionBusy !== null}
                  onClick={() => setRenameLabel(selectedKeyword?.label ?? '')}
                >
                  Cancel
                </button>
              </div>
            </section>
            <section style={controlGroupStyle}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>Reparent Selected Keyword</h4>
              <p style={mutedTextStyle}>
                {selectedKeyword
                  ? 'Move the selected keyword under a different parent, or clear the parent to make it a root keyword.'
                  : 'Select a keyword in the tree first.'}
              </p>
              <select
                value={pendingParentKeywordId}
                onChange={(event) => setPendingParentKeywordId(event.target.value)}
                style={selectStyle}
                disabled={!selectedKeyword}
              >
                <option value="__none__">None (root keyword)</option>
                {keywords
                  .filter((keyword) => !invalidParentIds.has(keyword.id))
                  .map((keyword) => (
                    <option key={keyword.id} value={keyword.id}>
                      {formatKeywordPathLabel(keyword, keywordMap)}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                style={selectedKeyword && actionBusy === null ? buttonStyle : disabledButtonStyle}
                disabled={!selectedKeyword || actionBusy !== null}
                onClick={() => void handleReparentKeyword()}
              >
                {actionBusy === 'reparent' ? 'Updating...' : 'Update Parent'}
              </button>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
