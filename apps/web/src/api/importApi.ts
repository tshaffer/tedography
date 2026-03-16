import type {
  BrowseDirectoryRequest,
  BrowseDirectoryResponse,
  GetStorageRootsResponse,
  RefreshFolderRequest,
  RefreshOperationResponse,
  RegisterImportRequest,
  RegisterImportResponse,
  ScanImportRequest,
  ScanImportResponse,
  VerifyKnownAssetsInFolderResponse
} from '@tedography/domain';

type ApiErrorPayload = {
  error?: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getStorageRoots(): Promise<GetStorageRootsResponse> {
  return fetchJson<GetStorageRootsResponse>('/api/import/storage-roots');
}

export async function browseDirectory(
  request: BrowseDirectoryRequest
): Promise<BrowseDirectoryResponse> {
  const query = new URLSearchParams({ rootId: request.rootId });
  if (request.relativePath && request.relativePath.length > 0) {
    query.set('relativePath', request.relativePath);
  }

  return fetchJson<BrowseDirectoryResponse>(`/api/import/browse?${query.toString()}`);
}

export async function scanImportTarget(
  request: ScanImportRequest
): Promise<ScanImportResponse> {
  return fetchJson<ScanImportResponse>('/api/import/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function registerImportedFiles(
  request: RegisterImportRequest
): Promise<RegisterImportResponse> {
  return fetchJson<RegisterImportResponse>('/api/import/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function reimportKnownAssetsInFolder(
  request: RefreshFolderRequest
): Promise<RefreshOperationResponse> {
  return fetchJson<RefreshOperationResponse>('/api/import/reimport-known', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function verifyKnownAssetsInFolder(
  request: RefreshFolderRequest
): Promise<VerifyKnownAssetsInFolderResponse> {
  return fetchJson<VerifyKnownAssetsInFolderResponse>('/api/import/verify-known', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function rebuildDerivedFilesInFolder(
  request: RefreshFolderRequest
): Promise<RefreshOperationResponse> {
  return fetchJson<RefreshOperationResponse>('/api/import/rebuild-derived', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}
