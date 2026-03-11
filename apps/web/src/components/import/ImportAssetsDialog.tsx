import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  BrowseDirectoryResponse,
  RegisterImportResponse,
  ScanImportResponse,
  StorageRootDto
} from '@tedography/domain';
import {
  browseDirectory,
  getStorageRoots,
  registerImportedFiles,
  scanImportTarget
} from '../../api/importApi';

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
  borderRadius: '10px',
  width: 'min(1100px, 96vw)',
  maxHeight: '90vh',
  overflow: 'auto',
  padding: '14px'
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '14px',
  marginTop: '10px'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '8px',
  padding: '10px'
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '10px 0 0 0',
  padding: 0,
  maxHeight: '230px',
  overflow: 'auto'
};

const listRowStyle: CSSProperties = {
  borderBottom: '1px solid #ececec',
  padding: '7px 0'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '4px',
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

interface ImportAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  onImportCompleted?: () => void;
}

export function ImportAssetsDialog({ open, onClose, onImportCompleted }: ImportAssetsDialogProps) {
  const [roots, setRoots] = useState<StorageRootDto[]>([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsError, setRootsError] = useState<string | null>(null);

  const [selectedRootId, setSelectedRootId] = useState<string>('');
  const [browseResponse, setBrowseResponse] = useState<BrowseDirectoryResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const [selectedFolderRelativePath, setSelectedFolderRelativePath] = useState<string>('');
  const [recursive, setRecursive] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanImportResponse | null>(null);

  const [selectedImportablePaths, setSelectedImportablePaths] = useState<string[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerResponse, setRegisterResponse] = useState<RegisterImportResponse | null>(null);

  const importableScanPaths = useMemo(
    () =>
      scanResponse?.files
        .filter((file) => file.status === 'Importable')
        .map((file) => file.relativePath) ?? [],
    [scanResponse]
  );

  async function loadRoots(): Promise<void> {
    setRootsLoading(true);
    setRootsError(null);

    try {
      const response = await getStorageRoots();
      setRoots(response.storageRoots);

      const defaultRoot = response.storageRoots.find((root) => root.isAvailable) ?? response.storageRoots[0];
      if (defaultRoot) {
        setSelectedRootId(defaultRoot.id);
        await loadBrowse(defaultRoot.id, '');
      } else {
        setSelectedRootId('');
        setBrowseResponse(null);
      }
    } catch (error) {
      setRootsError(error instanceof Error ? error.message : 'Failed to load storage roots');
      setRoots([]);
      setBrowseResponse(null);
    } finally {
      setRootsLoading(false);
    }
  }

  async function loadBrowse(rootId: string, relativePath: string): Promise<void> {
    setBrowseLoading(true);
    setBrowseError(null);

    try {
      const response = await browseDirectory({ rootId, relativePath });
      setBrowseResponse(response);
      setSelectedFolderRelativePath(response.currentRelativePath);
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : 'Failed to browse directory');
      setBrowseResponse(null);
    } finally {
      setBrowseLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadRoots();
    setScanResponse(null);
    setSelectedImportablePaths([]);
    setRegisterResponse(null);
    setRegisterError(null);
    setScanError(null);
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleRootChange(rootId: string): Promise<void> {
    setSelectedRootId(rootId);
    setScanResponse(null);
    setRegisterResponse(null);
    setSelectedImportablePaths([]);

    if (rootId.length === 0) {
      setBrowseResponse(null);
      return;
    }

    await loadBrowse(rootId, '');
  }

  async function handleScan(): Promise<void> {
    if (!selectedRootId) {
      return;
    }

    setScanLoading(true);
    setScanError(null);
    setRegisterResponse(null);

    try {
      const response = await scanImportTarget({
        rootId: selectedRootId,
        relativePath: selectedFolderRelativePath,
        recursive
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

  function toggleSelectedPath(relativePath: string): void {
    setSelectedImportablePaths((previous) =>
      previous.includes(relativePath)
        ? previous.filter((pathValue) => pathValue !== relativePath)
        : [...previous, relativePath]
    );
  }

  async function handleRegisterSelected(): Promise<void> {
    if (!selectedRootId || selectedImportablePaths.length === 0) {
      return;
    }

    setRegisterLoading(true);
    setRegisterError(null);

    try {
      const response = await registerImportedFiles({
        rootId: selectedRootId,
        files: selectedImportablePaths.map((relativePath) => ({ relativePath }))
      });

      setRegisterResponse(response);
      if (response.importedCount > 0) {
        onImportCompleted?.();
      }
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Failed to register files');
    } finally {
      setRegisterLoading(false);
    }
  }

  const currentPath = browseResponse?.currentRelativePath ?? '';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Import Assets</h2>
        <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
          Browse storage roots, scan a folder, then register selected importable files.
        </p>

        <div style={{ marginTop: '12px' }}>
          <label htmlFor="import-root-select">Storage root:</label>{' '}
          <select
            id="import-root-select"
            value={selectedRootId}
            onChange={(event) => {
              void handleRootChange(event.target.value);
            }}
            disabled={rootsLoading}
          >
            <option value="">Select a root</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.label} ({root.id}){root.isAvailable ? '' : ' - unavailable'}
              </option>
            ))}
          </select>
          {rootsLoading ? <span style={{ marginLeft: '8px' }}>Loading...</span> : null}
          {rootsError ? <p style={{ color: '#b00020' }}>{rootsError}</p> : null}
        </div>

        <div style={rowStyle}>
          <section style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: '15px' }}>Browse</h3>
            <p style={{ margin: '0 0 6px 0' }}>
              <strong>Current path:</strong> {currentPath || '/'}
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Scan target:</strong> {selectedFolderRelativePath || '/'}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                style={buttonStyle}
                disabled={!browseResponse?.parentRelativePath && browseResponse?.parentRelativePath !== ''}
                onClick={() => {
                  if (!selectedRootId || !browseResponse) {
                    return;
                  }
                  void loadBrowse(selectedRootId, browseResponse.parentRelativePath ?? '');
                }}
              >
                Up
              </button>
              <button
                type="button"
                style={buttonStyle}
                disabled={!browseResponse}
                onClick={() => {
                  setSelectedFolderRelativePath(currentPath);
                }}
              >
                Use Current Folder
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={!selectedRootId || scanLoading || registerLoading}
                onClick={() => void handleScan()}
              >
                {scanLoading ? 'Scanning...' : 'Scan Selected Folder'}
              </button>
            </div>

            {browseLoading ? <p>Loading folder...</p> : null}
            {browseError ? <p style={{ color: '#b00020' }}>{browseError}</p> : null}

            <h4 style={{ marginBottom: '6px' }}>Directories</h4>
            <ul style={listStyle}>
              {browseResponse?.directories.length ? (
                browseResponse.directories.map((directory) => (
                  <li key={directory.relativePath} style={listRowStyle}>
                    <button
                      type="button"
                      style={{ ...buttonStyle, fontSize: '12px' }}
                      onClick={() => {
                        if (!selectedRootId) {
                          return;
                        }
                        void loadBrowse(selectedRootId, directory.relativePath);
                      }}
                    >
                      {directory.name}
                    </button>
                  </li>
                ))
              ) : (
                <li style={listRowStyle}>No directories in this folder.</li>
              )}
            </ul>
          </section>

          <section style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: '15px' }}>Scan Results</h3>
            {scanError ? <p style={{ color: '#b00020' }}>{scanError}</p> : null}
            {scanResponse ? (
              <>
                <p style={{ margin: '0 0 6px 0' }}>
                  <strong>Target:</strong> {scanResponse.scanTargetRelativePath || '/'}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(event) => setRecursive(event.target.checked)}
                  />{' '}
                  Recursive scan
                </label>
                <div style={{ marginTop: '8px', fontSize: '12px', display: 'grid', gap: '4px' }}>
                  <span>Total files: {scanResponse.summary.totalFilesSeen}</span>
                  <span>Supported: {scanResponse.summary.supportedMediaFileCount}</span>
                  <span>Unsupported: {scanResponse.summary.unsupportedFileCount}</span>
                  <span>Already imported by path: {scanResponse.summary.alreadyImportedPathCount}</span>
                  <span>Duplicate by content hash: {scanResponse.summary.duplicateContentCount}</span>
                  <span>Importable: {scanResponse.summary.importableCount}</span>
                </div>

                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={() => void handleRegisterSelected()}
                    disabled={selectedImportablePaths.length === 0 || registerLoading}
                  >
                    {registerLoading ? 'Importing...' : `Import Selected (${selectedImportablePaths.length})`}
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
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(event) => setRecursive(event.target.checked)}
                  />{' '}
                  Recursive scan
                </label>
                <p style={{ marginTop: '8px' }}>Run a scan to see file statuses and import options.</p>
              </>
            )}
          </section>
        </div>

        {registerError ? <p style={{ color: '#b00020' }}>{registerError}</p> : null}
        {registerResponse ? (
          <section style={{ ...panelStyle, marginTop: '12px' }}>
            <h3 style={{ marginTop: 0, fontSize: '15px' }}>Register Results</h3>
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

        <div style={footerStyle}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            Import registers existing files by reference. No file copies are made.
          </span>
          <button type="button" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
