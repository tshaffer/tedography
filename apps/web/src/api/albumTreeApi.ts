import {
  type AlbumKeywordAssignmentStatus,
  type AlbumPeopleAssignmentStatus,
  type AlbumReviewAssignmentStatus,
  type AlbumTreeChildOrderMode,
  type AlbumTreeNode,
  type LocationDisplayMode,
  type MediaAsset
} from '@tedography/domain';

type AlbumMembershipRequest = {
  assetIds: string[];
};

type AlbumPlaceAssetsRequest = {
  assetIds: string[];
  placeAfterAssetId: string | null;
};

type AlbumOrderingModeRequest = {
  assetIds: string[];
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

export interface AlbumCaptureDateRange {
  albumId: string;
  minCaptureDateTime: string;
  maxCaptureDateTime: string;
}

export async function getAlbumCaptureDateRanges(): Promise<AlbumCaptureDateRange[]> {
  const response = await fetch('/api/album-tree/capture-date-ranges');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { ranges: AlbumCaptureDateRange[] };
  return data.ranges;
}

export interface AlbumAssetCount {
  albumId: string;
  count: number;
}

export async function getAlbumAssetCounts(): Promise<AlbumAssetCount[]> {
  const response = await fetch('/api/album-tree/asset-counts');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { counts: AlbumAssetCount[] };
  return data.counts;
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

export interface SetAlbumDefaultLocationRequest {
  clear?: true;
  placeName?: string | null;
  locationLabel?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
}

export async function updateAlbumDefaultLocation(
  nodeId: string,
  request: SetAlbumDefaultLocationRequest
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/default-location`, {
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

/** What the Location field shows for this album's photos; null = the global default. */
export async function updateAlbumLocationDisplayMode(
  nodeId: string,
  locationDisplayMode: LocationDisplayMode | null
): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(nodeId)}/location-display-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationDisplayMode })
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

export async function placeAssetsInAlbum(
  albumId: string,
  request: AlbumPlaceAssetsRequest
): Promise<MediaAsset[]> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/place`, {
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
): Promise<MediaAsset[]> {
  const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}/ordering-mode`, {
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

export async function addAlbumWriter(albumId: string, userId: string): Promise<AlbumTreeNode> {
  const response = await fetch(`/api/album-tree/${encodeURIComponent(albumId)}/writers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function removeAlbumWriter(albumId: string, userId: string): Promise<AlbumTreeNode> {
  const response = await fetch(
    `/api/album-tree/${encodeURIComponent(albumId)}/writers/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function setAlbumKeywordAssignmentStatus(
  albumId: string,
  status: AlbumKeywordAssignmentStatus | null
): Promise<AlbumTreeNode> {
  const response = await fetch(
    `/api/album-tree/${encodeURIComponent(albumId)}/keyword-assignment-status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function setAlbumReviewAssignmentStatus(
  albumId: string,
  status: AlbumReviewAssignmentStatus | null
): Promise<AlbumTreeNode> {
  const response = await fetch(
    `/api/album-tree/${encodeURIComponent(albumId)}/review-assignment-status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}

export async function setAlbumPeopleAssignmentStatus(
  albumId: string,
  status: AlbumPeopleAssignmentStatus | null
): Promise<AlbumTreeNode> {
  const response = await fetch(
    `/api/album-tree/${encodeURIComponent(albumId)}/people-assignment-status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as AlbumTreeNode;
}
