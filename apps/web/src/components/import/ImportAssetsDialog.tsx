import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type {
  AlbumTreeNode,
  BrowseDirectoryResponse,
  RegisterImportResponse,
  ScanImportResponse,
  StorageRootDto
} from '@tedography/domain';
import { addAssetsToAlbum, createAlbumTreeNode, listAlbumTreeNodes } from '../../api/albumTreeApi';
import {
  browseDirectory,
  getStorageRoots,
  registerImportedFiles,
  scanImportTarget
} from '../../api/importApi';

type AlbumDestinationMode = 'none' | 'existing' | 'new';

type SourceSelection = {
  rootId: string;
  relativePath: string;
  label: string;
};

type AlbumTreeNodeWithDepth = AlbumTreeNode & {
  depth: number;
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1200
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  width: 'min(1240px, 96vw)',
  height: 'min(92vh, 920px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '16px'
};

const bodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  gap: '14px',
  flex: 1,
  minHeight: 0,
  marginTop: '12px'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  backgroundColor: '#fff',
  minHeight: 0
};

const sourcePanelStyle: CSSProperties = {
  ...panelStyle,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const contentPanelStyle: CSSProperties = {
  ...panelStyle,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '12px 14px',
  borderBottom: '1px solid #ececec'
};

const panelBodyStyle: CSSProperties = {
  padding: '14px',
  overflow: 'auto',
  minHeight: 0
};

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

const treeListStyle: CSSProperties = {
  display: 'grid',
  gap: '4px'
};

const treeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '30px'
};

const treeExpandButtonStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  backgroundColor: '#f7f7f7',
  cursor: 'pointer',
  padding: 0,
  fontSize: '12px'
};

const treeSpacerStyle: CSSProperties = {
  width: '24px',
  height: '24px'
};

const treeLabelButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: '1px solid transparent',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '13px'
};

const treeLabelSelectedStyle: CSSProperties = {
  backgroundColor: '#eef4ff',
  borderColor: '#c7dafd'
};

const treeLabelDisabledStyle: CSSProperties = {
  color: '#999',
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

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1f6feb',
  borderColor: '#1f6feb',
  color: '#fff'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const controlRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

const summaryGridStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '12px',
  display: 'grid',
  gap: '4px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '10px 0 0 0',
  padding: 0,
  maxHeight: '280px',
  overflow: 'auto',
  border: '1px solid #ececec',
  borderRadius: '8px'
};

const listRowStyle: CSSProperties = {
  borderBottom: '1px solid #ececec',
  padding: '8px 10px'
};

const destinationOptionStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  marginTop: '8px'
};

const chooserPanelStyle: CSSProperties = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '10px',
  maxHeight: '220px',
  overflow: 'auto',
  backgroundColor: '#fbfbfb'
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cfcfcf',
  fontSize: '13px'
};

const footerStyle: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  alignItems: 'center'
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBrowseCacheKey(rootId: string, relativePath: string): string {
  return `${rootId}::${relativePath}`;
}

function getFolderName(relativePath: string): string {
  const parts = relativePath.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
}

function buildAlbumTreeDisplayList(
  nodes: AlbumTreeNode[],
  expandedGroupIds: string[]
): AlbumTreeNodeWithDepth[] {
  const expandedSet = new Set(expandedGroupIds);
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label);
    });
  }

  const ordered: AlbumTreeNodeWithDepth[] = [];

  function appendChildren(parentId: string | null, depth: number): void {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      ordered.push({ ...child, depth });
      if (child.nodeType === 'Group' && expandedSet.has(child.id)) {
        appendChildren(child.id, depth + 1);
      }
    }
  }

  appendChildren(null, 0);
  return ordered;
}

interface ImportAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
}

export function ImportAssetsDialog({ open, onClose, onImportCompleted }: ImportAssetsDialogProps) {
  const [roots, setRoots] = useState<StorageRootDto[]>([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsError, setRootsError] = useState<string | null>(null);

  const [browseCache, setBrowseCache] = useState<Record<string, BrowseDirectoryResponse>>({});
  const [browseLoadingKeys, setBrowseLoadingKeys] = useState<string[]>([]);
  const [browseErrors, setBrowseErrors] = useState<Record<string, string>>({});
  const [expandedSourceKeys, setExpandedSourceKeys] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceSelection | null>(null);

  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanImportResponse | null>(null);

  const [selectedImportablePaths, setSelectedImportablePaths] = useState<string[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerResponse, setRegisterResponse] = useState<RegisterImportResponse | null>(null);
  const [albumAssignmentMessage, setAlbumAssignmentMessage] = useState<string | null>(null);

  const [albumTreeNodes, setAlbumTreeNodes] = useState<AlbumTreeNode[]>([]);
  const [albumTreeLoading, setAlbumTreeLoading] = useState(false);
  const [albumTreeError, setAlbumTreeError] = useState<string | null>(null);
  const [expandedAlbumGroupIds, setExpandedAlbumGroupIds] = useState<string[]>([]);

  const [albumDestinationMode, setAlbumDestinationMode] = useState<AlbumDestinationMode>('none');
  const [selectedExistingAlbumId, setSelectedExistingAlbumId] = useState<string>('');
  const [selectedNewAlbumParentId, setSelectedNewAlbumParentId] = useState<string>('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const previousSuggestedAlbumNameRef = useRef('');

  const importableScanPaths = useMemo(
    () =>
      scanResponse?.files
        .filter((file) => file.status === 'Importable')
        .map((file) => file.relativePath) ?? [],
    [scanResponse]
  );

  const suggestedAlbumName = useMemo(
    () => (selectedSource ? getFolderName(selectedSource.relativePath) : ''),
    [selectedSource]
  );

  const albumTreeDisplayNodes = useMemo(
    () => buildAlbumTreeDisplayList(albumTreeNodes, expandedAlbumGroupIds),
    [albumTreeNodes, expandedAlbumGroupIds]
  );

  const selectableGroupNodes = useMemo(
    () => albumTreeNodes.filter((node) => node.nodeType === 'Group'),
    [albumTreeNodes]
  );

  useEffect(() => {
    const previousSuggested = previousSuggestedAlbumNameRef.current;
    if (
      suggestedAlbumName &&
      (newAlbumName.trim().length === 0 || newAlbumName === previousSuggested)
    ) {
      setNewAlbumName(suggestedAlbumName);
    }
    previousSuggestedAlbumNameRef.current = suggestedAlbumName;
  }, [newAlbumName, suggestedAlbumName]);

  useEffect(() => {
    const firstGroup = selectableGroupNodes[0];
    if (!selectedNewAlbumParentId && firstGroup) {
      setSelectedNewAlbumParentId(firstGroup.id);
    }
  }, [selectableGroupNodes, selectedNewAlbumParentId]);

  async function loadRoots(): Promise<void> {
    setRootsLoading(true);
    setRootsError(null);

    try {
      const response = await getStorageRoots();
      setRoots(response.storageRoots);

      const defaultRoot = response.storageRoots.find((root) => root.isAvailable) ?? response.storageRoots[0];
      if (defaultRoot) {
        const rootSelection: SourceSelection = {
          rootId: defaultRoot.id,
          relativePath: '',
          label: defaultRoot.label
        };
        setSelectedSource(rootSelection);
        setExpandedSourceKeys(defaultRoot.isAvailable ? [getBrowseCacheKey(defaultRoot.id, '')] : []);
        if (defaultRoot.isAvailable) {
          await loadBrowse(defaultRoot.id, '');
        }
      } else {
        setSelectedSource(null);
      }
    } catch (error) {
      setRootsError(error instanceof Error ? error.message : 'Failed to load storage roots');
      setRoots([]);
      setSelectedSource(null);
    } finally {
      setRootsLoading(false);
    }
  }

  async function loadBrowse(rootId: string, relativePath: string): Promise<void> {
    const cacheKey = getBrowseCacheKey(rootId, relativePath);
    if (browseCache[cacheKey]) {
      return;
    }

    setBrowseLoadingKeys((previous) =>
      previous.includes(cacheKey) ? previous : [...previous, cacheKey]
    );
    setBrowseErrors((previous) => {
      const next = { ...previous };
      delete next[cacheKey];
      return next;
    });

    try {
      const response = await browseDirectory({ rootId, relativePath });
      setBrowseCache((previous) => ({ ...previous, [cacheKey]: response }));
    } catch (error) {
      setBrowseErrors((previous) => ({
        ...previous,
        [cacheKey]: error instanceof Error ? error.message : 'Failed to browse directory'
      }));
    } finally {
      setBrowseLoadingKeys((previous) => previous.filter((key) => key !== cacheKey));
    }
  }

  async function loadAlbumTree(): Promise<void> {
    setAlbumTreeLoading(true);
    setAlbumTreeError(null);

    try {
      const nodes = await listAlbumTreeNodes();
      setAlbumTreeNodes(nodes);
      setExpandedAlbumGroupIds(
        nodes.filter((node) => node.nodeType === 'Group' && node.parentId === null).map((node) => node.id)
      );
    } catch (error) {
      setAlbumTreeError(error instanceof Error ? error.message : 'Failed to load album tree');
      setAlbumTreeNodes([]);
    } finally {
      setAlbumTreeLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadRoots();
    void loadAlbumTree();
    setBrowseCache({});
    setBrowseErrors({});
    setScanResponse(null);
    setSelectedImportablePaths([]);
    setRegisterResponse(null);
    setRegisterError(null);
    setScanError(null);
    setAlbumAssignmentMessage(null);
    setAlbumDestinationMode('none');
    setSelectedExistingAlbumId('');
    setSelectedNewAlbumParentId('');
    setNewAlbumName('');
  }, [open]);

  if (!open) {
    return null;
  }

  function clearScanState(): void {
    setScanResponse(null);
    setSelectedImportablePaths([]);
    setScanError(null);
    setRegisterResponse(null);
    setRegisterError(null);
    setAlbumAssignmentMessage(null);
  }

  function selectSource(selection: SourceSelection): void {
    setSelectedSource(selection);
    clearScanState();
  }

  function toggleSelectedPath(relativePath: string): void {
    setSelectedImportablePaths((previous) =>
      previous.includes(relativePath)
        ? previous.filter((pathValue) => pathValue !== relativePath)
        : [...previous, relativePath]
    );
  }

  async function handleScan(): Promise<void> {
    if (!selectedSource) {
      return;
    }

    setScanLoading(true);
    setScanError(null);
    setRegisterResponse(null);
    setRegisterError(null);
    setAlbumAssignmentMessage(null);

    try {
      const response = await scanImportTarget({
        rootId: selectedSource.rootId,
        relativePath: selectedSource.relativePath
      });

      setScanResponse(response);
      setSelectedImportablePaths(
        response.files
          .filter((file) => file.status === 'Importable')
          .map((file) => file.relativePath)
      );
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to scan folder');
      setScanResponse(null);
      setSelectedImportablePaths([]);
    } finally {
      setScanLoading(false);
    }
  }

  async function handleImportSelected(): Promise<void> {
    if (!selectedSource || selectedImportablePaths.length === 0) {
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);
    setAlbumAssignmentMessage(null);

    try {
      let destinationAlbumId: string | null = null;
      let destinationAlbumLabel = '';

      if (albumDestinationMode === 'existing') {
        if (!selectedExistingAlbumId) {
          throw new Error('Choose an existing album destination.');
        }
        const existingAlbum = albumTreeNodes.find((node) => node.id === selectedExistingAlbumId);
        if (!existingAlbum || existingAlbum.nodeType !== 'Album') {
          throw new Error('Choose a valid existing album destination.');
        }
        destinationAlbumId = existingAlbum.id;
        destinationAlbumLabel = existingAlbum.label;
      }

      if (albumDestinationMode === 'new') {
        const trimmedAlbumName = newAlbumName.trim();
        if (!selectedNewAlbumParentId) {
          throw new Error('Choose a parent group for the new album.');
        }
        if (!trimmedAlbumName) {
          throw new Error('Enter a name for the new album.');
        }

        const parentNode = albumTreeNodes.find((node) => node.id === selectedNewAlbumParentId);
        if (!parentNode || parentNode.nodeType !== 'Group') {
          throw new Error('Choose a valid parent group for the new album.');
        }

        const createdAlbum = await createAlbumTreeNode({
          label: trimmedAlbumName,
          nodeType: 'Album',
          parentId: selectedNewAlbumParentId
        });
        destinationAlbumId = createdAlbum.id;
        destinationAlbumLabel = createdAlbum.label;
        await loadAlbumTree();
      }

      const response = await registerImportedFiles({
        rootId: selectedSource.rootId,
        files: selectedImportablePaths.map((relativePath) => ({ relativePath }))
      });

      if (destinationAlbumId) {
        const assetIds = Array.from(
          new Set(
            response.results
              .map((result) => result.asset?.id)
              .filter((assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0)
          )
        );

        if (assetIds.length > 0) {
          await addAssetsToAlbum(destinationAlbumId, { assetIds });
          setAlbumAssignmentMessage(
            `Assigned ${assetIds.length} asset${assetIds.length === 1 ? '' : 's'} to "${destinationAlbumLabel}".`
          );
        } else {
          setAlbumAssignmentMessage(`No import results were eligible to assign to "${destinationAlbumLabel}".`);
        }
      }

      setRegisterResponse(response);
      if (response.importedCount > 0 || destinationAlbumId) {
        onImportCompleted?.();
      }
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Failed to import files');
    } finally {
      setRegisterLoading(false);
    }
  }

  function toggleAlbumGroupExpanded(groupId: string): void {
    setExpandedAlbumGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId]
    );
  }

  function renderSourceChildren(root: StorageRootDto, relativePath: string, depth: number): ReactElement | null {
    const cacheKey = getBrowseCacheKey(root.id, relativePath);
    const browseResponse = browseCache[cacheKey];
    if (!expandedSourceKeys.includes(cacheKey) || !browseResponse) {
      return null;
    }

    return (
      <>
        {browseResponse.directories.map((directory) => {
          const directoryKey = getBrowseCacheKey(root.id, directory.relativePath);
          const isExpanded = expandedSourceKeys.includes(directoryKey);
          const isSelected =
            selectedSource?.rootId === root.id &&
            selectedSource.relativePath === directory.relativePath;
          const isLoading = browseLoadingKeys.includes(directoryKey);
          const errorMessage = browseErrors[directoryKey];

          return (
            <div key={directoryKey}>
              <div style={{ ...treeRowStyle, marginLeft: `${(depth + 1) * 18}px` }}>
                <button
                  type="button"
                  style={treeExpandButtonStyle}
                  onClick={() => {
                    setExpandedSourceKeys((previous) =>
                      previous.includes(directoryKey)
                        ? previous.filter((key) => key !== directoryKey)
                        : [...previous, directoryKey]
                    );
                    if (!isExpanded) {
                      void loadBrowse(root.id, directory.relativePath);
                    }
                  }}
                  title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
                <button
                  type="button"
                  style={{
                    ...treeLabelButtonStyle,
                    ...(isSelected ? treeLabelSelectedStyle : {})
                  }}
                  onClick={() =>
                    selectSource({
                      rootId: root.id,
                      relativePath: directory.relativePath,
                      label: directory.name
                    })
                  }
                  title={directory.relativePath}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {directory.name}
                  </span>
                </button>
              </div>
              {isLoading ? (
                <p style={{ ...mutedTextStyle, marginLeft: `${(depth + 2) * 18}px` }}>Loading...</p>
              ) : null}
              {errorMessage ? (
                <p style={{ color: '#b00020', fontSize: '12px', margin: `4px 0 0 ${(depth + 2) * 18}px` }}>
                  {errorMessage}
                </p>
              ) : null}
              {renderSourceChildren(root, directory.relativePath, depth + 1)}
            </div>
          );
        })}
      </>
    );
  }

  function renderSourceBrowser(): ReactElement {
    return (
      <div style={treeListStyle}>
        {roots.map((root) => {
          const rootKey = getBrowseCacheKey(root.id, '');
          const isExpanded = expandedSourceKeys.includes(rootKey);
          const isSelected =
            selectedSource?.rootId === root.id && selectedSource.relativePath === '';
          const isLoading = browseLoadingKeys.includes(rootKey);
          const errorMessage = browseErrors[rootKey];

          return (
            <div key={root.id}>
              <div style={treeRowStyle}>
                {root.isAvailable ? (
                  <button
                    type="button"
                    style={treeExpandButtonStyle}
                    onClick={() => {
                      setExpandedSourceKeys((previous) =>
                        previous.includes(rootKey)
                          ? previous.filter((key) => key !== rootKey)
                          : [...previous, rootKey]
                      );
                      if (!isExpanded) {
                        void loadBrowse(root.id, '');
                      }
                    }}
                    title={isExpanded ? 'Collapse root' : 'Expand root'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                ) : (
                  <span style={treeSpacerStyle} />
                )}
                <button
                  type="button"
                  disabled={!root.isAvailable}
                  style={{
                    ...treeLabelButtonStyle,
                    ...(isSelected ? treeLabelSelectedStyle : {}),
                    ...(!root.isAvailable ? treeLabelDisabledStyle : {})
                  }}
                  onClick={() =>
                    selectSource({
                      rootId: root.id,
                      relativePath: '',
                      label: root.label
                    })
                  }
                  title={root.label}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {root.label}
                  </span>
                  {!root.isAvailable ? <span style={badgeStyle}>Unavailable</span> : <span style={badgeStyle}>Root</span>}
                </button>
              </div>
              {isLoading ? <p style={{ ...mutedTextStyle, marginLeft: '30px' }}>Loading...</p> : null}
              {errorMessage ? (
                <p style={{ color: '#b00020', fontSize: '12px', margin: '4px 0 0 30px' }}>{errorMessage}</p>
              ) : null}
              {renderSourceChildren(root, '', 0)}
            </div>
          );
        })}
      </div>
    );
  }

  function renderAlbumChooser(
    selectedNodeId: string,
    onSelectNode: (nodeId: string) => void,
    selectableNodeType: 'Album' | 'Group'
  ): ReactElement {
    return (
      <div style={chooserPanelStyle}>
        {albumTreeLoading ? <p style={mutedTextStyle}>Loading albums...</p> : null}
        {albumTreeError ? <p style={{ color: '#b00020', margin: 0 }}>{albumTreeError}</p> : null}
        {!albumTreeLoading && albumTreeDisplayNodes.length === 0 ? (
          <p style={mutedTextStyle}>No album tree nodes yet.</p>
        ) : (
          albumTreeDisplayNodes.map((node) => {
            const isGroup = node.nodeType === 'Group';
            const isExpanded = expandedAlbumGroupIds.includes(node.id);
            const isSelectable = node.nodeType === selectableNodeType;
            const isSelected = selectedNodeId === node.id;

            return (
              <div key={node.id} style={{ ...treeRowStyle, marginLeft: `${node.depth * 18}px` }}>
                {isGroup ? (
                  <button
                    type="button"
                    style={treeExpandButtonStyle}
                    onClick={() => toggleAlbumGroupExpanded(node.id)}
                    title={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                ) : (
                  <span style={treeSpacerStyle} />
                )}
                <button
                  type="button"
                  disabled={!isSelectable}
                  style={{
                    ...treeLabelButtonStyle,
                    ...(isSelected ? treeLabelSelectedStyle : {}),
                    ...(!isSelectable ? treeLabelDisabledStyle : {})
                  }}
                  onClick={() => onSelectNode(node.id)}
                  title={node.label}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.label}
                  </span>
                  <span style={badgeStyle}>{node.nodeType}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Import Assets</h2>
        <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
          Browse server storage roots like folders, scan the selected folder only, then import directly
          into an album if needed.
        </p>

        <div style={bodyStyle}>
          <section style={sourcePanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Source Browser</h3>
                <p style={{ ...mutedTextStyle, marginTop: '4px' }}>Browse roots and folders. Scanning stays explicit.</p>
              </div>
              {rootsLoading ? <span style={badgeStyle}>Loading</span> : null}
            </div>
            <div style={panelBodyStyle}>
              {rootsError ? <p style={{ color: '#b00020', marginTop: 0 }}>{rootsError}</p> : null}
              {renderSourceBrowser()}
            </div>
          </section>

          <section style={contentPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Selected Folder</h3>
                <p style={{ ...mutedTextStyle, marginTop: '4px' }}>
                  Browse, then explicitly scan the selected folder. Descendants are not included.
                </p>
              </div>
            </div>
            <div style={panelBodyStyle}>
              <div style={controlRowStyle}>
                <span style={badgeStyle}>
                  {selectedSource ? `${selectedSource.rootId}:${selectedSource.relativePath || '/'}` : 'No folder selected'}
                </span>
                <button
                  type="button"
                  style={
                    selectedSource && !scanLoading && !registerLoading ? primaryButtonStyle : disabledButtonStyle
                  }
                  disabled={!selectedSource || scanLoading || registerLoading}
                  onClick={() => void handleScan()}
                >
                  {scanLoading ? 'Scanning...' : 'Scan Selected Folder'}
                </button>
              </div>

              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Scan Results</h3>
                {scanError ? <p style={{ color: '#b00020', marginTop: 0 }}>{scanError}</p> : null}
                {scanResponse ? (
                  <>
                    <p style={{ margin: '0 0 8px 0' }}>
                      <strong>Target:</strong> {scanResponse.root.label} / {scanResponse.scanTargetRelativePath || '/'}
                    </p>
                    <div style={summaryGridStyle}>
                      <span>Total files: {scanResponse.summary.totalFilesSeen}</span>
                      <span>Supported: {scanResponse.summary.supportedMediaFileCount}</span>
                      <span>Unsupported: {scanResponse.summary.unsupportedFileCount}</span>
                      <span>Already imported by path: {scanResponse.summary.alreadyImportedPathCount}</span>
                      <span>Duplicate by content hash: {scanResponse.summary.duplicateContentCount}</span>
                      <span>Importable: {scanResponse.summary.importableCount}</span>
                    </div>

                    <div style={{ ...controlRowStyle, marginTop: '10px' }}>
                      <button
                        type="button"
                        style={buttonStyle}
                        onClick={() => setSelectedImportablePaths(importableScanPaths)}
                        disabled={importableScanPaths.length === 0}
                      >
                        Select All Importable
                      </button>
                      <button
                        type="button"
                        style={buttonStyle}
                        onClick={() => setSelectedImportablePaths([])}
                        disabled={selectedImportablePaths.length === 0}
                      >
                        Clear Selection
                      </button>
                    </div>

                    <ul style={listStyle}>
                      {scanResponse.files.map((file) => {
                        const importable = file.status === 'Importable';
                        const selected = selectedImportablePaths.includes(file.relativePath);

                        return (
                          <li key={file.relativePath} style={listRowStyle}>
                            <label style={{ display: 'grid', gap: '2px' }}>
                              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!importable}
                                  onChange={() => toggleSelectedPath(file.relativePath)}
                                />
                                <strong>{file.filename}</strong>
                                <span style={{ fontSize: '12px', color: importable ? '#136f2d' : '#666' }}>
                                  {file.status}
                                </span>
                              </span>
                              <span style={{ fontSize: '12px', color: '#555' }}>{file.relativePath}</span>
                              <span style={{ fontSize: '12px', color: '#666' }}>
                                {formatBytes(file.sizeBytes)}
                                {typeof file.width === 'number' && typeof file.height === 'number'
                                  ? ` | ${file.width} x ${file.height}`
                                  : ''}
                                {file.captureDateTime ? ` | ${formatDate(file.captureDateTime)}` : ''}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p style={mutedTextStyle}>Browse first, then scan the selected folder to inspect importable files.</p>
                )}
              </div>

              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Album Destination</h3>
                <div style={destinationOptionStyle}>
                  <label>
                    <input
                      type="radio"
                      name="album-destination-mode"
                      checked={albumDestinationMode === 'none'}
                      onChange={() => setAlbumDestinationMode('none')}
                    />{' '}
                    None
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="album-destination-mode"
                      checked={albumDestinationMode === 'existing'}
                      onChange={() => setAlbumDestinationMode('existing')}
                    />{' '}
                    Existing album
                  </label>
                  {albumDestinationMode === 'existing' ? (
                    <>
                      <p style={mutedTextStyle}>Choose a leaf album destination.</p>
                      {renderAlbumChooser(selectedExistingAlbumId, setSelectedExistingAlbumId, 'Album')}
                    </>
                  ) : null}

                  <label>
                    <input
                      type="radio"
                      name="album-destination-mode"
                      checked={albumDestinationMode === 'new'}
                      onChange={() => setAlbumDestinationMode('new')}
                    />{' '}
                    New album
                  </label>
                  {albumDestinationMode === 'new' ? (
                    <>
                      <p style={mutedTextStyle}>
                        Choose a parent group, then import directly into the new album.
                      </p>
                      {renderAlbumChooser(selectedNewAlbumParentId, setSelectedNewAlbumParentId, 'Group')}
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <input
                          type="text"
                          value={newAlbumName}
                          onChange={(event) => setNewAlbumName(event.target.value)}
                          placeholder="Album name"
                          style={inputStyle}
                        />
                        <div style={controlRowStyle}>
                          <button
                            type="button"
                            style={buttonStyle}
                            disabled={!suggestedAlbumName}
                            onClick={() => setNewAlbumName(suggestedAlbumName)}
                          >
                            Use selected folder name
                          </button>
                          {suggestedAlbumName ? <span style={badgeStyle}>{suggestedAlbumName}</span> : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {registerError ? <p style={{ color: '#b00020' }}>{registerError}</p> : null}
              {albumAssignmentMessage ? <p style={{ color: '#136f2d' }}>{albumAssignmentMessage}</p> : null}
              {registerResponse ? (
                <section style={sectionStyle}>
                  <h3 style={sectionTitleStyle}>Import Results</h3>
                  <p style={{ margin: '0 0 4px 0' }}>Imported: {registerResponse.importedCount}</p>
                  <p style={{ margin: '0 0 4px 0' }}>
                    Already imported by path: {registerResponse.skippedAlreadyImportedByPathCount}
                  </p>
                  <p style={{ margin: '0 0 4px 0' }}>
                    Duplicate by content hash: {registerResponse.skippedDuplicateContentCount}
                  </p>
                  <p style={{ margin: '0 0 4px 0' }}>Unsupported: {registerResponse.unsupportedCount}</p>
                  <p style={{ margin: '0 0 4px 0' }}>Missing: {registerResponse.missingCount}</p>
                  <p style={{ margin: '0 0 8px 0' }}>Errors: {registerResponse.errorCount}</p>
                  <ul style={listStyle}>
                    {registerResponse.results.map((result) => (
                      <li key={`${result.relativePath}:${result.status}`} style={listRowStyle}>
                        <strong>{result.relativePath}</strong> - {result.status}
                        {result.message ? <span style={{ color: '#666' }}> ({result.message})</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </section>
        </div>

        <div style={footerStyle}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            Import registers server-addressable files by reference, then optionally assigns them to an
            album.
          </span>
          <div style={controlRowStyle}>
            <button
              type="button"
              style={
                selectedImportablePaths.length > 0 && !registerLoading ? primaryButtonStyle : disabledButtonStyle
              }
              disabled={selectedImportablePaths.length === 0 || registerLoading}
              onClick={() => void handleImportSelected()}
            >
              {registerLoading ? 'Importing...' : `Import Selected (${selectedImportablePaths.length})`}
            </button>
            <button type="button" style={buttonStyle} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
