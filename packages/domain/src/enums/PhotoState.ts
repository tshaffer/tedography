export enum PhotoState {
  New = 'New',
  Pending = 'Pending',
  Keep = 'Keep',
  Discard = 'Discard'
}

const legacyPhotoStateMap: Record<string, PhotoState> = {
  New: PhotoState.New,
  Pending: PhotoState.Pending,
  Keep: PhotoState.Keep,
  Discard: PhotoState.Discard,
  Unreviewed: PhotoState.New,
  Select: PhotoState.Keep,
  Reject: PhotoState.Discard
};

export function normalizePhotoState(value: unknown): PhotoState | null {
  if (typeof value !== 'string') {
    return null;
  }

  return legacyPhotoStateMap[value] ?? null;
}
