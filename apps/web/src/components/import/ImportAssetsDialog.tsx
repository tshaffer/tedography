import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement
} from 'react';
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

export interface ImportAssetsDialogInitialAlbumDestination {
  mode: 'new' | 'existing';
  parentGroupId?: string;
  albumId?: string;
}

type SourceSelection = {
  rootId: string;
  relativePath: string;
  label: string;
};

type PersistedImportSourceState = {
  rootId: string;
  relativePath: string;
  expandedRelativePaths: string[];
};

type LastImportDestinationSummary = {
  mode: AlbumDestinationMode;
  albumLabel: string | null;
};

type ImportResultsPanelState = 'idle' | 'running' | 'success' | 'error';

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
  gridTemplateColumns: '320px minmax(0, 1fr) 320px',
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

const resultsPanelStyle: CSSProperties = {
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
  appearance: 'none',
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: 'none',
  borderRadius: '8px',
  boxShadow: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  outline: 'none',
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '13px'
};

const treeLabelSelectedStyle: CSSProperties = {
  backgroundColor: '#eef4ff',
  boxShadow: 'inset 0 0 0 1px #c7dafd'
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

const importSourceStateStorageKey = 'tedography.import.lastSource';

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

function getRelativePathFromBrowseCacheKey(cacheKey: string, rootId: string): string | null {
  const prefix = `${rootId}::`;
  return cacheKey.startsWith(prefix) ? cacheKey.slice(prefix.length) : null;
}

function getFolderName(relativePath: string): string {
  const parts = relativePath.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
}

function getAncestorRelativePaths(relativePath: string): string[] {
  const segments = relativePath.split('/').filter(Boolean);
  const ancestorPaths: string[] = [''];

  for (let index = 0; index < segments.length - 1; index += 1) {
    ancestorPaths.push(segments.slice(0, index + 1).join('/'));
  }

  return ancestorPaths;
}

function parsePersistedImportSourceState(): PersistedImportSourceState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(importSourceStateStorageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { rootId?: unknown }).rootId !== 'string' ||
      typeof (parsed as { relativePath?: unknown }).relativePath !== 'string' ||
      !Array.isArray((parsed as { expandedRelativePaths?: unknown }).expandedRelativePaths)
    ) {
      return null;
    }

    return {
      rootId: (parsed as { rootId: string }).rootId,
      relativePath: (parsed as { relativePath: string }).relativePath,
      expandedRelativePaths: (parsed as { expandedRelativePaths: unknown[] }).expandedRelativePaths.filter(
        (entry): entry is string => typeof entry === 'string'
      )
    };
  } catch {
    return null;
  }
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

function buildExpandedAlbumGroupIdsForInitialDestination(
  nodes: AlbumTreeNode[],
  initialAlbumDestination: ImportAssetsDialogInitialAlbumDestination | null | undefined
): string[] {
  const expandedGroupIds = new Set<string>();

  if (!initialAlbumDestination) {
    return Array.from(expandedGroupIds);
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  function addAncestorGroups(nodeId: string | null | undefined): void {
    let currentNodeId = nodeId ?? null;

    while (currentNodeId) {
      const currentNode = nodesById.get(currentNodeId);
      if (!currentNode) {
        break;
      }

      if (currentNode.nodeType === 'Group') {
        expandedGroupIds.add(currentNode.id);
      }

      currentNodeId = currentNode.parentId;
    }
  }

  if (initialAlbumDestination.mode === 'new') {
    addAncestorGroups(initialAlbumDestination.parentGroupId);
  }

  if (initialAlbumDestination.mode === 'existing') {
    const albumNode = initialAlbumDestination.albumId
      ? nodesById.get(initialAlbumDestination.albumId)
      : null;
    addAncestorGroups(albumNode?.parentId);
  }

  return Array.from(expandedGroupIds);
}

interface ImportAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
  initialAlbumDestination?: ImportAssetsDialogInitialAlbumDestination | null;
}

export function ImportAssetsDialog({
  open,
  onClose,
  onImportCompleted,
  initialAlbumDestination
}: ImportAssetsDialogProps) {
  const [roots, setRoots] = useState<StorageRootDto[]>([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsError, setRootsError] = useState<string | null>(null);

  const [browseCache, setBrowseCache] = useState<Record<string, BrowseDirectoryResponse>>({});
  const browseCacheRef = useRef<Record<string, BrowseDirectoryResponse>>({});
  const [browseLoadingKeys, setBrowseLoadingKeys] = useState<string[]>([]);
  const [browseErrors, setBrowseErrors] = useState<Record<string, string>>({});
  const [expandedSourceKeys, setExpandedSourceKeys] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceSelection | null>(null);

  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanImportResponse | null>(null);
  const [scanFilesVisible, setScanFilesVisible] = useState(false);

  const [selectedImportablePaths, setSelectedImportablePaths] = useState<string[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerResponse, setRegisterResponse] = useState<RegisterImportResponse | null>(null);
  const [albumAssignmentMessage, setAlbumAssignmentMessage] = useState<string | null>(null);
  const [importCompletionMessage, setImportCompletionMessage] = useState<string | null>(null);
  const [lastImportDestinationSummary, setLastImportDestinationSummary] =
    useState<LastImportDestinationSummary | null>(null);
  const [importResultsPanelState, setImportResultsPanelState] = useState<ImportResultsPanelState>('idle');

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
  const selectedImportableScanPaths = useMemo(
    () => selectedImportablePaths.filter((relativePath) => importableScanPaths.includes(relativePath)),
    [importableScanPaths, selectedImportablePaths]
  );
  const allImportableSelected =
    importableScanPaths.length > 0 && selectedImportableScanPaths.length === importableScanPaths.length;

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

  useEffect(() => {
    if (
      !initialAlbumDestination &&
      albumTreeNodes.length > 0 &&
      (albumDestinationMode === 'existing' || albumDestinationMode === 'new')
    ) {
      setExpandedAlbumGroupIds([]);
    }
  }, [albumDestinationMode, albumTreeNodes, initialAlbumDestination]);

  useEffect(() => {
    browseCacheRef.current = browseCache;
  }, [browseCache]);

  useEffect(() => {
    if (!open || !selectedSource || typeof window === 'undefined') {
      return;
    }

    const expandedRelativePaths = expandedSourceKeys
      .map((cacheKey) => getRelativePathFromBrowseCacheKey(cacheKey, selectedSource.rootId))
      .filter((value): value is string => value !== null);

    const nextState: PersistedImportSourceState = {
      rootId: selectedSource.rootId,
      relativePath: selectedSource.relativePath,
      expandedRelativePaths: Array.from(new Set(expandedRelativePaths))
    };

    window.localStorage.setItem(importSourceStateStorageKey, JSON.stringify(nextState));
  }, [expandedSourceKeys, open, selectedSource]);

  async function loadRoots(): Promise<StorageRootDto[]> {
    setRootsLoading(true);
    setRootsError(null);

    try {
      const response = await getStorageRoots();
      setRoots(response.storageRoots);
      return response.storageRoots;
    } catch (error) {
      setRootsError(error instanceof Error ? error.message : 'Failed to load storage roots');
      setRoots([]);
      setSelectedSource(null);
      return [];
    } finally {
      setRootsLoading(false);
    }
  }

  async function loadBrowse(rootId: string, relativePath: string): Promise<BrowseDirectoryResponse | null> {
    const cacheKey = getBrowseCacheKey(rootId, relativePath);
    const cached = browseCacheRef.current[cacheKey];
    if (cached) {
      return cached;
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
      setBrowseCache((previous) => {
        const next = { ...previous, [cacheKey]: response };
        browseCacheRef.current = next;
        return next;
      });
      return response;
    } catch (error) {
      setBrowseErrors((previous) => ({
        ...previous,
        [cacheKey]: error instanceof Error ? error.message : 'Failed to browse directory'
      }));
      return null;
    } finally {
      setBrowseLoadingKeys((previous) => previous.filter((key) => key !== cacheKey));
    }
  }

  async function restoreLastSelectedSource(nextRoots: StorageRootDto[]): Promise<void> {
    const persisted = parsePersistedImportSourceState();
    const defaultRoot = nextRoots.find((root) => root.isAvailable) ?? nextRoots[0];
    if (!defaultRoot) {
      setSelectedSource(null);
      setExpandedSourceKeys([]);
      return;
    }

    const restoredRoot =
      (persisted
        ? nextRoots.find((root) => root.id === persisted.rootId && root.isAvailable) ?? null
        : null) ?? defaultRoot;

    const desiredRelativePath = persisted && restoredRoot.id === persisted.rootId ? persisted.relativePath : '';
    const desiredExpandedRelativePaths =
      persisted && restoredRoot.id === persisted.rootId ? persisted.expandedRelativePaths : [''];

    const rootResponse = restoredRoot.isAvailable ? await loadBrowse(restoredRoot.id, '') : null;
    const rootSelection: SourceSelection = {
      rootId: restoredRoot.id,
      relativePath: '',
      label: restoredRoot.label
    };

    if (!restoredRoot.isAvailable || !rootResponse) {
      setSelectedSource(rootSelection);
      setExpandedSourceKeys([]);
      return;
    }

    const segments = desiredRelativePath.split('/').filter(Boolean);
    const expandedRelativePaths = new Set<string>(['', ...desiredExpandedRelativePaths, ...getAncestorRelativePaths(desiredRelativePath)]);
    let resolvedRelativePath = '';

    for (const segment of segments) {
      const parentPath = resolvedRelativePath;
      const browseResponse = await loadBrowse(restoredRoot.id, parentPath);
      const matchingDirectory = browseResponse?.directories.find((directory) => directory.name === segment);
      if (!matchingDirectory) {
        break;
      }

      resolvedRelativePath = matchingDirectory.relativePath;
      expandedRelativePaths.add(parentPath);
    }

    if (resolvedRelativePath) {
      await loadBrowse(restoredRoot.id, resolvedRelativePath);
    }

    const selectedLabel =
      resolvedRelativePath.length === 0
        ? restoredRoot.label
        : resolvedRelativePath.split('/').filter(Boolean).at(-1) ?? restoredRoot.label;

    setExpandedSourceKeys(Array.from(expandedRelativePaths).map((relativePath) => getBrowseCacheKey(restoredRoot.id, relativePath)));
    setSelectedSource({
      rootId: restoredRoot.id,
      relativePath: resolvedRelativePath,
      label: selectedLabel
    });
  }

  async function loadAlbumTree(): Promise<void> {
    setAlbumTreeLoading(true);
    setAlbumTreeError(null);

    try {
      const nodes = await listAlbumTreeNodes();
      setAlbumTreeNodes(nodes);
      setExpandedAlbumGroupIds(buildExpandedAlbumGroupIdsForInitialDestination(nodes, initialAlbumDestination));
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

    browseCacheRef.current = {};
    setBrowseCache({});
    setBrowseErrors({});
    setBrowseLoadingKeys([]);
    setExpandedSourceKeys([]);
    setSelectedSource(null);
    setScanResponse(null);
    setScanFilesVisible(false);
    setSelectedImportablePaths([]);
    setRegisterResponse(null);
    setRegisterError(null);
    setScanError(null);
    setAlbumAssignmentMessage(null);
    setImportCompletionMessage(null);
    setLastImportDestinationSummary(null);
    setImportResultsPanelState('idle');
    setAlbumDestinationMode(initialAlbumDestination?.mode ?? 'none');
    setSelectedExistingAlbumId(initialAlbumDestination?.mode === 'existing' ? initialAlbumDestination.albumId ?? '' : '');
    setSelectedNewAlbumParentId(initialAlbumDestination?.mode === 'new' ? initialAlbumDestination.parentGroupId ?? '' : '');
    setNewAlbumName('');
    void loadRoots().then(async (loadedRoots) => {
      await restoreLastSelectedSource(loadedRoots);
    });
    void loadAlbumTree();
  }, [initialAlbumDestination, open]);

  if (!open) {
    return null;
  }

  function clearScanState(): void {
    setScanResponse(null);
    setScanFilesVisible(false);
    setSelectedImportablePaths([]);
    setScanError(null);
    setRegisterResponse(null);
    setRegisterError(null);
    setAlbumAssignmentMessage(null);
    setImportCompletionMessage(null);
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
    setImportCompletionMessage(null);

    try {
      const response = await scanImportTarget({
        rootId: selectedSource.rootId,
        relativePath: selectedSource.relativePath
      });

      setScanResponse(response);
      setScanFilesVisible(false);
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

  async function refreshScanStateAfterImport(source: SourceSelection): Promise<void> {
    const response = await scanImportTarget({
      rootId: source.rootId,
      relativePath: source.relativePath
    });

    setScanResponse(response);
    setScanFilesVisible(false);
    setSelectedImportablePaths(
      response.files
        .filter((file) => file.status === 'Importable')
        .map((file) => file.relativePath)
    );
    setScanError(null);
  }

  async function handleImportSelected(): Promise<void> {
    if (!selectedSource || selectedImportableScanPaths.length === 0) {
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);
    setRegisterResponse(null);
    setAlbumAssignmentMessage(null);
    setImportCompletionMessage(null);
    setLastImportDestinationSummary(null);
    setImportResultsPanelState('running');

    try {
      let destinationAlbumId: string | null = null;
      let destinationAlbumLabel = '';
      let destinationSummary: LastImportDestinationSummary = {
        mode: albumDestinationMode,
        albumLabel: null
      };

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
        destinationSummary = {
          mode: 'existing',
          albumLabel: existingAlbum.label
        };
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
        destinationSummary = {
          mode: 'new',
          albumLabel: createdAlbum.label
        };
        await loadAlbumTree();
      }

      const response = await registerImportedFiles({
        rootId: selectedSource.rootId,
        files: selectedImportableScanPaths.map((relativePath) => ({ relativePath }))
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
      setLastImportDestinationSummary(destinationSummary);
      setImportResultsPanelState('success');
      const nonImportedCount =
        response.skippedAlreadyImportedByPathCount +
        response.skippedDuplicateContentCount +
        response.unsupportedCount +
        response.missingCount +
        response.errorCount;
      setImportCompletionMessage(
        `Import complete: ${response.importedCount} imported` +
          (nonImportedCount > 0 ? `, ${nonImportedCount} not imported` : '') +
          (destinationAlbumLabel ? ` into "${destinationAlbumLabel}"` : '') +
          '.'
      );
      await refreshScanStateAfterImport(selectedSource);
      if (response.importedCount > 0 || destinationAlbumId) {
        onImportCompleted?.();
      }
    } catch (error) {
      setImportResultsPanelState('error');
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
                <div
                  style={{
                    ...treeLabelButtonStyle,
                    userSelect: 'none',
                    ...(isSelected ? treeLabelSelectedStyle : {}),
                    ...(!isSelectable ? treeLabelDisabledStyle : {})
                  }}
                  onClick={() => {
                    if (isSelectable) {
                      onSelectNode(node.id);
                    }
                  }}
                  title={node.label}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.label}
                  </span>
                  <span style={badgeStyle}>{node.nodeType}</span>
                </div>
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
                    selectedSource && !scanLoading && !registerLoading
                      ? primaryButtonStyle
                      : disabledButtonStyle
                  }
                  disabled={!selectedSource || scanLoading || registerLoading}
                  onClick={() => void handleScan()}
                >
                  {scanLoading ? 'Scanning...' : 'Scan for Assets in Folder'}
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
                        onClick={() => setScanFilesVisible((previous) => !previous)}
                      >
                        {scanFilesVisible ? 'Hide Files' : 'Show Files'}
                      </button>
                      <button
                        type="button"
                        style={!allImportableSelected ? buttonStyle : disabledButtonStyle}
                        onClick={() => setSelectedImportablePaths(importableScanPaths)}
                        disabled={importableScanPaths.length === 0 || allImportableSelected}
                      >
                        Select All Importable
                      </button>
                      <button
                        type="button"
                        style={selectedImportableScanPaths.length > 0 ? buttonStyle : disabledButtonStyle}
                        onClick={() => setSelectedImportablePaths([])}
                        disabled={selectedImportableScanPaths.length === 0}
                      >
                        Clear Selection
                      </button>
                    </div>

                    {scanFilesVisible ? (
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
                    ) : null}
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
            </div>
          </section>

          <section style={resultsPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Import Results</h3>
                <p style={{ ...mutedTextStyle, marginTop: '4px' }}>
                  Results from the most recent import in this dialog session.
                </p>
              </div>
              {registerLoading ? <span style={badgeStyle}>Importing</span> : null}
            </div>
            <div style={panelBodyStyle}>
              {registerError ? <p style={{ color: '#b00020', marginTop: 0 }}>{registerError}</p> : null}
              {importCompletionMessage ? <p style={{ color: '#136f2d', marginTop: 0 }}>{importCompletionMessage}</p> : null}
              {albumAssignmentMessage ? <p style={{ color: '#136f2d', marginTop: 0 }}>{albumAssignmentMessage}</p> : null}
              {importResultsPanelState === 'running' ? (
                <p style={mutedTextStyle}>Import in progress</p>
              ) : registerResponse ? (
                <>
                  <div style={summaryGridStyle}>
                    <span>Imported: {registerResponse.importedCount}</span>
                    <span>
                      Skipped:{' '}
                      {registerResponse.skippedAlreadyImportedByPathCount +
                        registerResponse.skippedDuplicateContentCount +
                        registerResponse.unsupportedCount +
                        registerResponse.missingCount}
                    </span>
                    <span>Already imported: {registerResponse.skippedAlreadyImportedByPathCount}</span>
                    <span>Errors/problems: {registerResponse.errorCount}</span>
                    <span>
                      Destination:{' '}
                      {lastImportDestinationSummary?.mode === 'existing'
                        ? `Existing album${lastImportDestinationSummary.albumLabel ? `: ${lastImportDestinationSummary.albumLabel}` : ''}`
                        : lastImportDestinationSummary?.mode === 'new'
                          ? `New album${lastImportDestinationSummary.albumLabel ? `: ${lastImportDestinationSummary.albumLabel}` : ''}`
                          : 'None'}
                    </span>
                  </div>
                  <ul style={{ ...listStyle, maxHeight: '100%', marginTop: '12px' }}>
                    {registerResponse.results.map((result) => (
                      <li key={`${result.relativePath}:${result.status}`} style={listRowStyle}>
                        <strong>{result.relativePath}</strong> - {result.status}
                        {result.message ? <span style={{ color: '#666' }}> ({result.message})</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : importResultsPanelState === 'error' ? (
                <p style={mutedTextStyle}>Import failed.</p>
              ) : (
                <p style={mutedTextStyle}>No import has been run yet.</p>
              )}
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
                selectedImportableScanPaths.length > 0 && !registerLoading ? primaryButtonStyle : disabledButtonStyle
              }
              disabled={selectedImportableScanPaths.length === 0 || registerLoading}
              onClick={() => void handleImportSelected()}
            >
              {registerLoading ? 'Importing...' : `Import Selected (${selectedImportableScanPaths.length})`}
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
