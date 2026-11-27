import type {
  EditHistoryEntry,
  EditLookupHistoryItem,
  EditLookupMatchField,
  EditLookupResponse,
  EditLookupResult,
  EditQueueEntry
} from '@tedography/domain';
import { buildEditLookupMatchers, matchesFilename, matchesText } from './patternMatch.js';

export const EDIT_LOOKUP_MAX_RESULTS = 500;

export interface EditLookupAssetInfo {
  filename: string;
  // Folder of the original file inside its storage root, e.g. "2019/Italy".
  folder: string | null;
  albumId: string | null;
  albumPath: string | null;
}

export interface EditLookupInput {
  query: string;
  queueEntries: EditQueueEntry[];
  historyEntries: EditHistoryEntry[];
  // Keyed by asset id; absent for photos that no longer exist.
  assetsById: Map<string, EditLookupAssetInfo>;
  // Recorded Edit Queue working filenames, keyed by asset id.
  workingNamesByAssetId?: Map<string, string>;
}

function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function buildEditLookupResponse(input: EditLookupInput): EditLookupResponse {
  const query = input.query.trim();
  const matchers = buildEditLookupMatchers(query);
  if (!matchers) {
    return { query, results: [], totalMatches: 0, truncated: false };
  }

  // Group everything known about one source photo.
  const queueByAssetId = new Map<string, EditQueueEntry>();
  for (const entry of input.queueEntries) {
    queueByAssetId.set(entry.assetId, entry);
  }
  const historyByAssetId = new Map<string, EditHistoryEntry[]>();
  for (const entry of input.historyEntries) {
    const list = historyByAssetId.get(entry.sourceAssetId) ?? [];
    list.push(entry);
    historyByAssetId.set(entry.sourceAssetId, list);
  }

  const workingNames = input.workingNamesByAssetId ?? new Map<string, string>();
  const assetIds = new Set<string>([...queueByAssetId.keys(), ...historyByAssetId.keys(), ...workingNames.keys()]);
  const results: EditLookupResult[] = [];

  for (const assetId of assetIds) {
    const queueEntry = queueByAssetId.get(assetId) ?? null;
    const history = (historyByAssetId.get(assetId) ?? [])
      .slice()
      .sort((a, b) => b.processedAt.localeCompare(a.processedAt));
    const asset = input.assetsById.get(assetId) ?? null;

    const workingFilename = workingNames.get(assetId) ?? null;
    const filename = asset?.filename ?? history[0]?.sourceFilename ?? workingFilename ?? assetId;
    const folder = asset?.folder ?? null;
    const albumPath = asset?.albumPath ?? null;

    const matchedOn = new Set<EditLookupMatchField>();
    if (matchesFilename(matchers, filename) || history.some((h) => matchesFilename(matchers, h.sourceFilename))) {
      matchedOn.add('filename');
    }
    if (history.some((h) => matchesFilename(matchers, h.editedFilename))) {
      matchedOn.add('editedFilename');
    }
    if (workingFilename && matchesFilename(matchers, workingFilename)) {
      matchedOn.add('workingFilename');
    }
    if (folder && matchesText(matchers, folder)) {
      matchedOn.add('folder');
    }
    if (albumPath && matchesText(matchers, albumPath)) {
      matchedOn.add('album');
    }
    if (
      (queueEntry && queueEntry.note && matchesText(matchers, queueEntry.note)) ||
      history.some((h) => h.note && matchesText(matchers, h.note))
    ) {
      matchedOn.add('note');
    }
    if (matchedOn.size === 0) {
      continue;
    }
    // A photo known only from an earlier export is listed when a filename matched,
    // not for sharing a folder or album with the search text.
    if (!queueEntry && history.length === 0 && !matchedOn.has('filename') && !matchedOn.has('workingFilename')) {
      continue;
    }

    const historyItems: EditLookupHistoryItem[] = history.map((h) => ({
      id: h.id,
      editedFilename: h.editedFilename,
      editedAssetId: h.editedAssetId,
      ...(h.editMethod != null ? { editMethod: h.editMethod } : {}),
      status: h.status,
      errorMessage: h.errorMessage,
      note: h.note,
      processedAt: h.processedAt,
      archived: h.archiveId != null
    }));

    results.push({
      assetId,
      filename,
      workingFilename,
      assetExists: asset != null,
      folder,
      albumId: asset?.albumId ?? null,
      albumPath,
      queue: queueEntry
        ? { editType: queueEntry.editType, note: queueEntry.note, createdAt: queueEntry.createdAt }
        : null,
      history: historyItems,
      matchedOn: [...matchedOn]
    });
  }

  results.sort((a, b) => compareNatural(a.filename, b.filename));

  return {
    query,
    results: results.slice(0, EDIT_LOOKUP_MAX_RESULTS),
    totalMatches: results.length,
    truncated: results.length > EDIT_LOOKUP_MAX_RESULTS
  };
}
