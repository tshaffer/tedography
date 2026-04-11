function appendVersion(url: string, version: string | null | undefined): string {
  if (!version || version.trim().length === 0) {
    return url;
  }

  return `${url}?v=${encodeURIComponent(version)}`;
}

export function getDisplayMediaUrl(assetId: string, version?: string | null): string {
  return appendVersion(`/api/media/display/${encodeURIComponent(assetId)}`, version);
}

export function getThumbnailMediaUrl(assetId: string, version?: string | null): string {
  return appendVersion(`/api/media/thumbnail/${encodeURIComponent(assetId)}`, version);
}

export function getOriginalMediaUrl(assetId: string, version?: string | null): string {
  return appendVersion(`/api/media/original/${encodeURIComponent(assetId)}`, version);
}

export function getFaceDetectionPreviewUrl(detectionId: string): string {
  return `/api/people-pipeline/detections/${encodeURIComponent(detectionId)}/preview`;
}
