import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { Keyword, KeywordTreeNode } from '@tedography/domain';
import {
  createKeyword,
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
  marginTop: '12px'
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
  display: 'grid',
  gap: '12px',
  padding: '12px'
};

const bodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)',
  gap: '12px',
  minHeight: 0
};

const treePanelStyle: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: '8px',
  padding: '10px',
  minHeight: '220px',
  maxHeight: '360px',
  overflow: 'auto'
};

const treeListStyle: CSSProperties = {
  display: 'grid',
  gap: '4px'
};

const treeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: '30px'
};

const treeButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: 'left',
  border: '1px solid transparent',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '6px 8px',
  fontSize: '13px'
};

const selectedTreeButtonStyle: CSSProperties = {
  ...treeButtonStyle,
  backgroundColor: '#eef4ff',
  borderColor: '#c7dafd'
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
  onSelect: (keywordId: string) => void,
  depth = 0
): ReactElement[] {
  return nodes.flatMap((node) => {
    const rows: ReactElement[] = [
      <div key={node.id} style={{ ...treeRowStyle, paddingLeft: `${depth * 18}px` }}>
        <button
          type="button"
          style={selectedKeywordId === node.id ? selectedTreeButtonStyle : treeButtonStyle}
          onClick={() => onSelect(node.id)}
          title={node.label}
        >
          {node.label}
        </button>
      </div>
    ];

    if (node.children.length > 0) {
      rows.push(...renderTreeRows(node.children, selectedKeywordId, onSelect, depth + 1));
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
  const [actionBusy, setActionBusy] = useState<null | 'rename' | 'create-root' | 'create-child' | 'reparent'>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

    const label = newChildLabel.trim().replace(/\s+/g, ' ');
    if (label.length === 0) {
      return;
    }

    setActionBusy('create-child');
    setError(null);
    setNotice(null);

    try {
      await createKeyword({ label, parentKeywordId: selectedKeyword.id });
      setNewChildLabel('');
      setNotice(`Created "${label}" under ${formatKeywordPathLabel(selectedKeyword, keywordMap)}.`);
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
                renderTreeRows(tree, selectedKeywordId, setSelectedKeywordId)
              ) : (
                <p style={mutedTextStyle}>No keywords exist yet.</p>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px', alignContent: 'start' }}>
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
              <h4 style={{ margin: 0, fontSize: '13px' }}>Create Child Keyword</h4>
              <p style={mutedTextStyle}>
                {selectedKeyword
                  ? `Selected parent: ${formatKeywordPathLabel(selectedKeyword, keywordMap)}`
                  : 'Select a keyword in the tree first.'}
              </p>
              <input
                type="text"
                value={newChildLabel}
                onChange={(event) => setNewChildLabel(event.target.value)}
                placeholder="Child keyword label"
                style={inputStyle}
                disabled={!selectedKeyword}
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
                {actionBusy === 'create-child' ? 'Creating...' : 'Create Child Keyword'}
              </button>
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
