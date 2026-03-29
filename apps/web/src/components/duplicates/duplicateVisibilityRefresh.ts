import type { DuplicateCandidateReviewDecision } from '@tedography/shared';
import type { DuplicateResolutionVisibilitySummary } from './duplicateResolutionVisibility';

const duplicateVisibilityOverridesStorageKey = 'tedography.duplicates.visibilityOverrides';
const duplicateVisibilityRefreshRequestStorageKey = 'tedography.duplicates.visibilityRefreshRequestedAt';

function readSessionStorageJson<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeSessionStorageJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and fall back to in-memory behavior only.
  }
}

function removeSessionStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function buildPairGroupKey(assetIdA: string, assetIdB: string): string {
  return [assetIdA, assetIdB].sort((left, right) => left.localeCompare(right)).join('__');
}

function writeDuplicateVisibilityOverrides(
  overrides: Map<string, DuplicateResolutionVisibilitySummary>
): void {
  if (overrides.size === 0) {
    removeSessionStorageItem(duplicateVisibilityOverridesStorageKey);
    return;
  }

  writeSessionStorageJson(
    duplicateVisibilityOverridesStorageKey,
    Array.from(overrides.entries())
  );
}

export function readDuplicateVisibilityOverrides(): Map<string, DuplicateResolutionVisibilitySummary> {
  const entries = readSessionStorageJson<Array<[string, DuplicateResolutionVisibilitySummary]>>(
    duplicateVisibilityOverridesStorageKey
  );
  return Array.isArray(entries) ? new Map(entries) : new Map();
}

export function applyDuplicateVisibilityOverrides(
  baseMap: Map<string, DuplicateResolutionVisibilitySummary>
): Map<string, DuplicateResolutionVisibilitySummary> {
  const merged = new Map(baseMap);
  const overrides = readDuplicateVisibilityOverrides();
  for (const [assetId, summary] of overrides.entries()) {
    merged.set(assetId, summary);
  }

  return merged;
}

export function requestDuplicateVisibilityRefresh(): void {
  writeSessionStorageJson(duplicateVisibilityRefreshRequestStorageKey, {
    requestedAt: Date.now()
  });
}

export function hasPendingDuplicateVisibilityRefreshRequest(): boolean {
  const request = readSessionStorageJson<{ requestedAt?: number }>(
    duplicateVisibilityRefreshRequestStorageKey
  );
  return Boolean(request && typeof request.requestedAt === 'number');
}

export function clearDuplicateVisibilityRefreshRequest(): void {
  removeSessionStorageItem(duplicateVisibilityRefreshRequestStorageKey);
}

export function applyOptimisticDuplicateVisibilityUpdate(input: {
  assetIdA: string;
  assetIdB: string;
  decision: DuplicateCandidateReviewDecision;
}): void {
  const overrides = readDuplicateVisibilityOverrides();
  overrides.delete(input.assetIdA);
  overrides.delete(input.assetIdB);

  if (
    input.decision === 'confirmed_duplicate_keep_left' ||
    input.decision === 'confirmed_duplicate_keep_right'
  ) {
    const selectedCanonicalAssetId =
      input.decision === 'confirmed_duplicate_keep_left' ? input.assetIdA : input.assetIdB;
    const groupKey = buildPairGroupKey(input.assetIdA, input.assetIdB);

    for (const assetId of [input.assetIdA, input.assetIdB]) {
      const role = assetId === selectedCanonicalAssetId ? 'canonical' : 'secondary';
      overrides.set(assetId, {
        assetId,
        groupKey,
        selectedCanonicalAssetId,
        role,
        isSuppressedByDefault: role === 'secondary',
        resolutionStatus: 'confirmed'
      });
    }
  }

  writeDuplicateVisibilityOverrides(overrides);
  requestDuplicateVisibilityRefresh();
}
