import {
  type AlbumTreeChildOrderMode,
  type AlbumTreeNode,
  type AlbumTreeNodeSemanticKind,
  type MediaAsset
} from '@tedography/domain';

type AlbumMembershipRequest = {
  assetIds: string[];
};

type AlbumManualOrderRequest = {
  orderedAssetIds: string[];
};

type AlbumOrderingModeRequest = {
  assetId: string;
  forceManualOrder: boolean;
};

export interface CreateAlbumTreeNodeRequest {
  label: string;
  nodeType: 'Group' | 'Album';
  parentId: string | null;
  targetIndex?: number;
}

export interface MoveAlbumTreeNodeRequest {
  parentId: string | null;
  targetIndex: number;
}

export interface ReorderAlbumTreeNodeRequest {
  direction: 'up' | 'down';
}

export interface UpdateAlbumTreeChildOrderModeRequest {
  childOrderMode: AlbumTreeChildOrderMode;
}

export interface UpdateAlbumTreeNodeSemanticKindRequest {
  semanticKind: AlbumTreeNodeSemanticKind | null;
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

export async function moveAlbumTreeNode(
  nodeId: string,
  request: MoveAlbumTreeNodeRequest
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/move`, {
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

export async function reorderAlbumTreeNode(
  nodeId: string,
  request: ReorderAlbumTreeNodeRequest
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/reorder`, {
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

export async function updateAlbumTreeChildOrderMode(
  nodeId: string,
  request: UpdateAlbumTreeChildOrderModeRequest
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/child-order-mode`, {
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

export async function updateAlbumTreeNodeSemanticKind(
  nodeId: string,
  request: UpdateAlbumTreeNodeSemanticKindRequest
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/semantic-kind`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
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

export async function moveAssetsToAlbum(
  albumId: string,
  request: AlbumMembershipRequest
): Promise<MediaAsset[]> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/move-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as MediaAsset[];
}

export async function updateAlbumManualOrder(
  albumId: string,
  request: AlbumManualOrderRequest
): Promise<MediaAsset[]> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/manual-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as MediaAsset[];
}

export async function updateAlbumOrderingMode(
  albumId: string,
  request: AlbumOrderingModeRequest
): Promise<MediaAsset> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/ordering-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as MediaAsset;
}
