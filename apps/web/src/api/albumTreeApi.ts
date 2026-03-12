import { type AlbumTreeNode } from '@tedography/domain';

type AlbumMembershipRequest = {
  assetIds: string[];
};

export interface CreateAlbumTreeNodeRequest {
  label: string;
  nodeType: 'Group' | 'Album';
  parentId: string | null;
}

function buildErrorMessage(status: number, payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }

  return `Request failed with status ${status}`;
}

export async function listAlbumTreeNodes(): Promise<AlbumTreeNode[]> {
  const response = await fetch('/api/album-tree');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as AlbumTreeNode[];
}

export async function createAlbumTreeNode(
  request: CreateAlbumTreeNodeRequest
): Promise<AlbumTreeNode> {
  const response = await fetch('/api/album-tree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function renameAlbumTreeNode(nodeId: string, label: string): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function deleteAlbumTreeNode(nodeId: string): Promise<void> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }
}

export async function addAssetsToAlbum(
  albumId: string,
  request: AlbumMembershipRequest
): Promise<void> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }
}

export async function removeAssetsFromAlbum(
  albumId: string,
  request: AlbumMembershipRequest
): Promise<void> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/assets`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }
}
