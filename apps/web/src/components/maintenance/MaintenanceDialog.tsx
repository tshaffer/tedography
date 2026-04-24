import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import type {
  BrowseDirectoryResponse,
  RefreshOperationResponse,
  StorageRootDto,
  VerifyKnownAssetsInFolderResponse
} from '@tedography/domain';
import {
  browseDirectory,
  rebuildDerivedFilesInFolder,
  getStorageRoots,
  reimportKnownAssetsInFolder,
  verifyKnownAssetsInFolder
} from '../../api/importApi';
import type { AlbumTreeNode } from '@tedography/domain';
import { OrganizationDiagnosticsSection } from './OrganizationDiagnosticsSection';

type SourceSelection = {
  rootId: string;
  relativePath: string;
  label: string;
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
  width: 'min(1160px, 96vw)',
  height: 'min(88vh, 820px)',
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

const warningBadgeStyle: CSSProperties = {
  ...badgeStyle,
  borderColor: '#e1c699',
  backgroundColor: '#fff1da',
  color: '#7a4d00'
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

const controlRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

const maintenanceGroupStyle: CSSProperties = {
  border: '1px solid #ead8bf',
  borderRadius: '10px',
  backgroundColor: '#fffaf4',
  padding: '12px',
  display: 'grid',
  gap: '8px'
};

const verifyGroupStyle: CSSProperties = {
  border: '1px solid #d6e3d1',
  borderRadius: '10px',
  backgroundColor: '#f7fbf5',
  padding: '12px',
  display: 'grid',
  gap: '8px'
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
  maxHeight: '300px',
  overflow: 'auto',
  border: '1px solid #ececec',
  borderRadius: '8px'
};

const listRowStyle: CSSProperties = {
  borderBottom: '1px solid #ececec',
  padding: '8px 10px'
};

const footerStyle: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  alignItems: 'center'
};

function getBrowseCacheKey(rootId: string, relativePath: string): string {
  return `${rootId}::${relativePath}`;
}

interface MaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  onMaintenanceCompleted?: () => void;
  albumTreeNodes: AlbumTreeNode[];
  selectedTreeNodeId: string | null;
  onOpenOrganizationDiagnosticAssets: (input: {
    assetIds: string[];
    scopeLabel: string;
    emptyMessage: string;
  }) => void;
}

export function MaintenanceDialog({
  open,
  onClose,
  onMaintenanceCompleted,
  albumTreeNodes,
  selectedTreeNodeId,
  onOpenOrganizationDiagnosticAssets
}: MaintenanceDialogProps) {
  const [roots, setRoots] = useState<StorageRootDto[]>([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsError, setRootsError] = useState<string | null>(null);
  const [browseCache, setBrowseCache] = useState<Record<string, BrowseDirectoryResponse>>({});
  const [browseLoadingKeys, setBrowseLoadingKeys] = useState<string[]>([]);
  const [browseErrors, setBrowseErrors] = useState<Record<string, string>>({});
  const [expandedSourceKeys, setExpandedSourceKeys] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceSelection | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResponse, setVerifyResponse] = useState<VerifyKnownAssetsInFolderResponse | null>(null);
  const [folderOperationLoading, setFolderOperationLoading] = useState<null | 'reimport' | 'rebuild'>(null);
  const [folderOperationError, setFolderOperationError] = useState<string | null>(null);
  const [folderOperationResponse, setFolderOperationResponse] = useState<RefreshOperationResponse | null>(null);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadRoots();
    setBrowseCache({});
    setBrowseErrors({});
    setExpandedSourceKeys([]);
    setVerifyLoading(false);
    setVerifyError(null);
    setVerifyResponse(null);
    setFolderOperationLoading(null);
    setFolderOperationError(null);
    setFolderOperationResponse(null);
  }, [open]);

  if (!open) {
    return null;
  }

  function clearOperationState(): void {
    setVerifyError(null);
    setVerifyResponse(null);
    setFolderOperationError(null);
    setFolderOperationResponse(null);
  }

  function selectSource(selection: SourceSelection): void {
    setSelectedSource(selection);
    clearOperationState();
  }

  async function handleFolderOperation(mode: 'reimport' | 'rebuild'): Promise<void> {
    if (!selectedSource) {
      return;
    }

    const confirmed = window.confirm(
      mode === 'reimport'
        ? 'Reimport known assets in this folder? Tedography will update existing assets from their source files and may regenerate derived files.'
        : 'Rebuild derived files for known assets in this folder? Tedography will regenerate display and thumbnail files for existing assets.'
    );
    if (!confirmed) {
      return;
    }

    setFolderOperationLoading(mode);
    setFolderOperationError(null);
    setFolderOperationResponse(null);

    try {
      const request = {
        rootId: selectedSource.rootId,
        relativePath: selectedSource.relativePath
      };
      const response =
        mode === 'reimport'
          ? await reimportKnownAssetsInFolder(request)
          : await rebuildDerivedFilesInFolder(request);
      setFolderOperationResponse(response);
      onMaintenanceCompleted?.();
    } catch (error) {
      setFolderOperationError(
        error instanceof Error ? error.message : 'Failed to run maintenance operation'
      );
    } finally {
      setFolderOperationLoading(null);
    }
  }

  async function handleVerifyKnownAssets(): Promise<void> {
    if (!selectedSource) {
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResponse(null);

    try {
      const response = await verifyKnownAssetsInFolder({
        rootId: selectedSource.rootId,
        relativePath: selectedSource.relativePath
      });
      setVerifyResponse(response);
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : 'Failed to verify known assets in folder');
    } finally {
      setVerifyLoading(false);
    }
  }

  function renderRefreshOperationSummary(response: RefreshOperationResponse): ReactElement {
    return (
      <>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>Operation:</strong> {response.operation}
        </p>
        <div style={summaryGridStyle}>
          <span>Total candidates: {response.summary.totalCandidates}</span>
          <span>Succeeded: {response.summary.succeededCount}</span>
          <span>Reimported: {response.summary.reimportedCount}</span>
          <span>Rebuilt: {response.summary.rebuiltCount}</span>
          <span>Skipped: {response.summary.skippedCount}</span>
          <span>Source missing: {response.summary.sourceMissingCount}</span>
          <span>Failed: {response.summary.failedCount}</span>
        </div>
        <ul style={listStyle}>
          {response.results.map((result) => (
            <li
              key={`${result.relativePath}:${result.assetId ?? 'no-asset'}:${result.status}`}
              style={listRowStyle}
            >
              <strong>{result.relativePath}</strong> - {result.status}
              {result.message ? <span style={{ color: '#666' }}> ({result.message})</span> : null}
            </li>
          ))}
        </ul>
      </>
    );
  }

  function renderVerifySummary(response: VerifyKnownAssetsInFolderResponse): ReactElement {
    return (
      <>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>Operation:</strong> {response.operation}
        </p>
        <div style={summaryGridStyle}>
          <span>Known assets checked: {response.summary.totalKnownAssetsChecked}</span>
          <span>Healthy: {response.summary.healthyAssets}</span>
          <span>With problems: {response.summary.assetsWithProblems}</span>
          <span>Source missing: {response.summary.sourceMissingCount}</span>
          <span>Missing display: {response.summary.missingDisplayCount}</span>
          <span>Missing thumbnail: {response.summary.missingThumbnailCount}</span>
          <span>Invalid references: {response.summary.invalidReferenceCount}</span>
          <span>Missing storage roots: {response.summary.missingStorageRootCount}</span>
          <span>File size mismatches: {response.summary.fileSizeMismatchCount}</span>
          <span>Other problems: {response.summary.otherProblemCount}</span>
        </div>
        <ul style={listStyle}>
          {response.results.map((result: VerifyKnownAssetsInFolderResponse['results'][number]) => (
            <li key={`${result.relativePath}:${result.assetId}`} style={listRowStyle}>
              <strong>{result.relativePath}</strong> - {result.status}
              {result.problemCategories.length > 0 ? (
                <span style={{ color: '#666' }}> ({result.problemCategories.join(', ')})</span>
              ) : null}
              {result.message ? <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>{result.message}</div> : null}
            </li>
          ))}
        </ul>
      </>
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
          const isSelected = selectedSource?.rootId === root.id && selectedSource.relativePath === '';
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

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Maintenance</h2>
        <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
          Run refresh and repair actions on already-known assets in one selected folder. Descendants are not included.
        </p>

        <div style={bodyStyle}>
          <section style={sourcePanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Source Browser</h3>
                <p style={{ ...mutedTextStyle, marginTop: '4px' }}>
                  Browse roots and folders. Maintenance stays explicit and non-recursive.
                </p>
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
                  Choose one folder, then run maintenance on already-known assets in that folder only.
                </p>
              </div>
            </div>
            <div style={panelBodyStyle}>
              <section>
                <h3 style={sectionTitleStyle}>Selected Folder</h3>
                <div style={controlRowStyle}>
                  <span style={badgeStyle}>
                    {selectedSource ? `${selectedSource.rootId}:${selectedSource.relativePath || '/'}` : 'No folder selected'}
                  </span>
                </div>
                <p style={{ ...mutedTextStyle, marginTop: '8px' }}>
                  Maintenance only checks already-known assets in the selected folder. For new files, use Import.
                </p>
              </section>

              <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Verify</h3>
                <div style={verifyGroupStyle}>
                  <p style={mutedTextStyle}>
                    Verify checks already-known assets in the selected folder for missing or broken source and derived files.
                  </p>
                  <div style={controlRowStyle}>
                    <button
                      type="button"
                      style={selectedSource && !verifyLoading && folderOperationLoading === null ? buttonStyle : disabledButtonStyle}
                      disabled={!selectedSource || verifyLoading || folderOperationLoading !== null}
                      onClick={() => void handleVerifyKnownAssets()}
                    >
                      {verifyLoading ? 'Verifying...' : 'Verify Known Assets in Folder'}
                    </button>
                    <span style={badgeStyle}>Non-mutating</span>
                  </div>
                </div>
                {verifyError ? <p style={{ color: '#b00020', marginTop: '12px' }}>{verifyError}</p> : null}
                {verifyResponse ? (
                  <section style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>Verification Results</h3>
                    {renderVerifySummary(verifyResponse)}
                  </section>
                ) : (
                  <p style={{ ...mutedTextStyle, marginTop: '12px' }}>
                    Choose a folder and run verification to inspect known asset health in that folder.
                  </p>
                )}
              </section>

              <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Repair</h3>
                <div style={maintenanceGroupStyle}>
                  <div style={controlRowStyle}>
                    <span style={warningBadgeStyle}>Mutates known assets</span>
                  </div>
                  <p style={mutedTextStyle}>
                    Reimport updates metadata from source files. Rebuild regenerates display and thumbnail derivatives.
                  </p>
                  <div style={controlRowStyle}>
                    <button
                      type="button"
                      style={
                        selectedSource && !verifyLoading && folderOperationLoading === null ? buttonStyle : disabledButtonStyle
                      }
                      disabled={!selectedSource || verifyLoading || folderOperationLoading !== null}
                      onClick={() => void handleFolderOperation('reimport')}
                    >
                      {folderOperationLoading === 'reimport'
                        ? 'Reimporting...'
                        : 'Reimport Known Assets in Folder'}
                    </button>
                    <button
                      type="button"
                      style={
                        selectedSource && !verifyLoading && folderOperationLoading === null ? buttonStyle : disabledButtonStyle
                      }
                      disabled={!selectedSource || verifyLoading || folderOperationLoading !== null}
                      onClick={() => void handleFolderOperation('rebuild')}
                    >
                      {folderOperationLoading === 'rebuild'
                        ? 'Rebuilding...'
                        : 'Rebuild Derived Files in Folder'}
                    </button>
                  </div>
                </div>
                {folderOperationError ? <p style={{ color: '#b00020', marginTop: '12px' }}>{folderOperationError}</p> : null}
                {folderOperationResponse ? (
                  <section style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>Repair Results</h3>
                    {renderRefreshOperationSummary(folderOperationResponse)}
                  </section>
                ) : (
                  <p style={{ ...mutedTextStyle, marginTop: '12px' }}>
                    Run reimport or rebuild to repair already-known assets in the selected folder.
                  </p>
                )}
              </section>

              <OrganizationDiagnosticsSection
                albumTreeNodes={albumTreeNodes}
                selectedTreeNodeId={selectedTreeNodeId}
                onOpenDiagnosticAssets={onOpenOrganizationDiagnosticAssets}
              />
            </div>
          </section>
        </div>

        <div style={footerStyle}>
          <span style={mutedTextStyle}>Maintenance affects existing assets only. Import new files from the Import dialog.</span>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
