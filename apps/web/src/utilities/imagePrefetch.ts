const prefetchedImageUrls = new Set<string>();

export function prefetchImage(url: string): void {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return;
  }

  if (prefetchedImageUrls.has(url)) {
    return;
  }

  const image = new Image();
  image.src = url;
  prefetchedImageUrls.add(url);
}
