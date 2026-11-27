import assert from 'node:assert/strict';
import test from 'node:test';
import { EditType, type EditHistoryEntry, type EditQueueEntry } from '@tedography/domain';
import { buildEditLookupResponse, type EditLookupAssetInfo } from './editLookup.js';
import { buildEditLookupMatchers, matchesFilename, matchesText } from './patternMatch.js';

function queueEntry(assetId: string, note = ''): EditQueueEntry {
  return { id: `q-${assetId}`, assetId, note, editType: EditType.Unspecified, createdAt: '2026-11-01T00:00:00.000Z' };
}

function historyEntry(overrides: Partial<EditHistoryEntry> & { sourceAssetId: string; sourceFilename: string }): EditHistoryEntry {
  return {
    id: `h-${overrides.sourceAssetId}-${overrides.editedFilename ?? 'x'}`,
    note: '',
    editedFilename: 'edited.tif',
    editedAssetId: null,
    status: 'succeeded',
    errorMessage: null,
    processedAt: '2026-11-02T00:00:00.000Z',
    archiveId: null,
    ...overrides
  };
}

const assets = new Map<string, EditLookupAssetInfo>([
  ['a1', { filename: 'IMG_5345.heic', folder: '2019/Italy', albumId: 'al1', albumPath: 'Trips → Italy 2019' }],
  ['a2', { filename: 'IMG_0007.jpg', folder: '1998/Yosemite', albumId: null, albumPath: null }]
]);

test('bare text matches anywhere, case-insensitively, ignoring the extension', () => {
  const m = buildEditLookupMatchers('img_5345')!;
  assert.ok(matchesFilename(m, 'IMG_5345.heic'));
  assert.ok(matchesFilename(m, 'IMG_5345_edited.tif'));
  assert.ok(!matchesFilename(m, 'IMG_5346.heic'));
});

test('* and ? are wildcards; other regex characters are literal', () => {
  const star = buildEditLookupMatchers('IMG_53*5')!;
  assert.ok(matchesFilename(star, 'IMG_5345.heic'));
  const one = buildEditLookupMatchers('IMG_?345')!;
  assert.ok(matchesFilename(one, 'IMG_5345.heic'));
  assert.ok(!matchesFilename(one, 'IMG_345.heic'));
  const literal = buildEditLookupMatchers('a.b(1)')!;
  assert.ok(matchesFilename(literal, 'a.b(1).jpg'));
  assert.ok(!matchesFilename(literal, 'aXb(1).jpg'));
});

test('a different extension still finds the same photo', () => {
  const m = buildEditLookupMatchers('IMG_5345.CR2')!;
  assert.ok(matchesFilename(m, 'IMG_5345.heic'));
  // The extension-stripped form applies to filenames only, not folders or notes.
  assert.ok(!matchesText(m, 'folder IMG_5345 note'));
});

test('an extension-only wildcard does not collapse to match-everything', () => {
  const m = buildEditLookupMatchers('*.dng')!;
  assert.ok(!matchesFilename(m, 'IMG_5345.heic'));
  assert.ok(matchesFilename(m, 'IMG_5345.dng'));
});

test('empty or blank query returns nothing', () => {
  assert.equal(buildEditLookupMatchers('   '), null);
  const r = buildEditLookupResponse({ query: '  ', queueEntries: [queueEntry('a1')], historyEntries: [], assetsById: assets });
  assert.equal(r.results.length, 0);
});

test('finds a queued photo and a history-only photo, and combines both for one photo', () => {
  const r = buildEditLookupResponse({
    query: 'IMG_',
    queueEntries: [queueEntry('a1')],
    historyEntries: [
      historyEntry({ sourceAssetId: 'a1', sourceFilename: 'IMG_5345.heic', editedFilename: 'IMG_5345_edited.tif', editMethod: 'manual' }),
      historyEntry({ sourceAssetId: 'a2', sourceFilename: 'IMG_0007.jpg', archiveId: 'arc1' })
    ],
    assetsById: assets
  });
  assert.deepEqual(r.results.map((x) => x.filename), ['IMG_0007.jpg', 'IMG_5345.heic']);
  const a1 = r.results[1]!;
  assert.ok(a1.queue);
  assert.equal(a1.history.length, 1);
  assert.equal(a1.history[0]!.editMethod, 'manual');
  const a2 = r.results[0]!;
  assert.equal(a2.queue, null);
  assert.equal(a2.history[0]!.archived, true);
});

test('folder, album path, note and edited filename searches report where they matched', () => {
  const base = {
    queueEntries: [queueEntry('a1', 'fix the sky')],
    historyEntries: [historyEntry({ sourceAssetId: 'a1', sourceFilename: 'IMG_5345.heic', editedFilename: 'sunset_final.tif' })],
    assetsById: assets
  };
  assert.deepEqual(buildEditLookupResponse({ ...base, query: 'Italy' }).results[0]!.matchedOn.sort(), ['album', 'folder']);
  assert.deepEqual(buildEditLookupResponse({ ...base, query: 'sky' }).results[0]!.matchedOn, ['note']);
  assert.deepEqual(buildEditLookupResponse({ ...base, query: 'sunset*' }).results[0]!.matchedOn, ['editedFilename']);
});

test('a history entry whose source photo is gone is still found by filename, with no folder', () => {
  const r = buildEditLookupResponse({
    query: 'gone',
    queueEntries: [],
    historyEntries: [historyEntry({ sourceAssetId: 'zz', sourceFilename: 'gone_photo.jpg' })],
    assetsById: assets
  });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0]!.assetExists, false);
  assert.equal(r.results[0]!.folder, null);
});

test('finds a photo by its working filename, including one only known from an export', () => {
  const workingNamesByAssetId = new Map([['a1', 'IMG_5345__tdg0f1023d0.heic'], ['a2', 'IMG_0007__tdgabcdef12.jpg']]);
  const byName = buildEditLookupResponse({
    query: 'IMG_0007__tdgabcdef12.tif',
    queueEntries: [queueEntry('a1')],
    historyEntries: [],
    assetsById: assets,
    workingNamesByAssetId
  });
  assert.deepEqual(byName.results.map((r) => r.assetId), ['a2']);
  assert.equal(byName.results[0]?.workingFilename, 'IMG_0007__tdgabcdef12.jpg');
  assert.ok(byName.results[0]?.matchedOn.includes('workingFilename'));

  // A folder match alone doesn't pull in a photo that is only known from an export.
  const byFolder = buildEditLookupResponse({
    query: 'Yosemite',
    queueEntries: [],
    historyEntries: [],
    assetsById: assets,
    workingNamesByAssetId
  });
  assert.equal(byFolder.results.length, 0);
});
