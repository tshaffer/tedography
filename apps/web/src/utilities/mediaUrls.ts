export function getDisplayMediaUrl(assetId: string): string {
  return `/api/media/display/${encodeURIComponent(assetId)}`;
}

export function getThumbnailMediaUrl(assetId: string): string {
  return `/api/media/thumbnail/${encodeURIComponent(assetId)}`;
}
