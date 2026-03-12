import { type Collection } from '@tedography/domain';

type CollectionAssetsRequest = {
  assetIds: string[];
};

export async function listCollections(): Promise<Collection[]> {
  const response = await fetch('/api/collections');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as Collection[];
}

export async function createCollection(name: string): Promise<Collection> {
  const response = await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as Collection;
}

export async function renameCollection(collectionId: string, name: string): Promise<Collection> {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as Collection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
}

export async function addAssetsToCollection(
  collectionId: string,
  request: CollectionAssetsRequest
): Promise<void> {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
}

export async function removeAssetsFromCollection(
  collectionId: string,
  request: CollectionAssetsRequest
): Promise<void> {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}/assets`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
}
