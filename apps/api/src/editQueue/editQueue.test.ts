import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { matchEditedFilename, inferOriginalBasename } from './editedFilenameMatch.js';
import { resolveEditFolders } from './editFolders.js';
import {
  entriesMissingFromManifest,
  exportCodes,
  exportRootName,
  nameKeyOf,
  type ExportNameRecord,
  type ExportNameStore,
} from './exportNames.js';
import { exportOneAsset, type ExportContext, type ExportOutcome } from './exportService.js';
import { DestinationExistsError, placeEditedFile } from './importPlacement.js';
import { mergeIntoManifest, readManifest, readManifestState, type ManifestEntry } from './manifest.js';
import { clearReturnedFiles, deleteReturnFile, listClearableReturnFiles, scanReturnFolder, UnsafeDeleteError } from './returnFiles.js';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const hashFile = async (p: string): Promise<string> => sha(await fs.readFile(p, 'utf-8'));

function entry(id: string, filename: string, extra: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    sourceAssetId: id,
    originalFilename: filename,
    originalBasename: filename.replace(/\.[^.]+$/, ''),
    note: '',
    ...extra,
  };
}

/** In-memory stand-in for the database records, with the same uniqueness rules. */
function memoryNames(initial: ExportNameRecord[] = []): ExportNameStore & { records: Map<string, ExportNameRecord> } {
  const records = new Map(initial.map((r) => [r.assetId, { ...r }]));
  return {
    records,
    find: async (assetId) => records.get(assetId) ?? null,
    claim: async (record) => {
      const existing = records.get(record.assetId);
      if (existing) return existing;
      const coded = /__tdg[0-9a-f]{8,}$/i.test(nameKeyOf(record.exportedFilename));
      const taken = [...records.values()].some((r) => nameKeyOf(r.exportedFilename) === nameKeyOf(record.exportedFilename));
      if (coded && taken) return null;
      records.set(record.assetId, { ...record });
      return records.get(record.assetId)!;
    },
    markExported: async (assetId) => {
      const record = records.get(assetId);
      if (record) record.exported = true;
    },
  };
}

// Asset ids shaped like the library's (UUIDs), so their codes are predictable.
const ID_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const ID_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const ID_C = 'cccccccc-3333-4333-8333-333333333333';

let root: string;
let editPath: string;
let activeEdits: string;
let completedEdits: string;
let exportedTiffs: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'tdg-editq-'));
  editPath = path.join(root, 'Edit');
  activeEdits = path.join(editPath, 'Active Edits');
  completedEdits = path.join(editPath, 'Completed Edits');
  exportedTiffs = path.join(editPath, 'Exported TIFFs');
  for (const dir of [activeEdits, completedEdits, exportedTiffs]) {
    await fs.mkdir(dir, { recursive: true });
  }
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('filename matching', () => {
  const entries = [entry('a', 'IMG_2579.JPG')];
  const matched = (name: string, list = entries): string | null => {
    const m = matchEditedFilename(name, list);
    return m.kind === 'matched' ? m.entry.sourceAssetId : null;
  };

  it('accepts the supported edited-file names (test 2, 3)', () => {
    for (const name of [
      'IMG_2579_edited.tif',
      'IMG_2579_edited_v2.tif',
      'IMG_2579-Edit_edited.tif',
      'IMG_2579-Edit-2_edited.tif',
      'IMG_2579-Edit-3_edited.tif',
      'IMG_2579-Edit-2_edited_v2.tif',
      'img_2579_EDITED.TIF',
      'IMG_2579-Enhanced-NR_edited.tif',
      'IMG_2579_edited_ai.png',
    ]) {
      assert.equal(matched(name), 'a', name);
    }
  });

  it('does not match unsupported or merely similar names', () => {
    for (const name of ['IMG_2579-Edit.tif', 'IMG_2579.tif', 'IMG_25790_edited.tif', 'XIMG_2579_edited.tif', 'IMG_2579-Foo_edited.tif']) {
      assert.equal(matched(name), null, name);
    }
  });

  it('ignores macOS metadata files', () => {
    assert.equal(matchEditedFilename('._IMG_2579_edited.tif', entries).kind, 'ignored');
  });

  it('reports ambiguity instead of guessing (test 7)', () => {
    const both = [entry('a', 'IMG_2579.JPG'), entry('b', 'IMG_2579-Edit.tif')];
    const m = matchEditedFilename('IMG_2579-Edit_edited.tif', both);
    assert.equal(m.kind, 'ambiguous');
  });

  it('reports ambiguity for different assets with the same basename', () => {
    const dup = [entry('a', 'IMG_0001.JPG'), entry('b', 'IMG_0001.HEIC')];
    assert.equal(matchEditedFilename('IMG_0001_edited.tif', dup).kind, 'ambiguous');
  });

  it('keeps chained edits resolving as before', () => {
    const chained = [entry('a', 'IMG_4516.HEIC'), entry('b', 'IMG_4516_edited_ai.png')];
    assert.equal(matched('IMG_4516_edited_ai_edited.tif', chained), 'b');
    assert.equal(matched('IMG_4516_edited_ai.tif', chained), 'a');
    const edited = [entry('a', 'IMG_4660.HEIC'), entry('b', 'IMG_4660_edited.tif')];
    assert.equal(matched('IMG_4660_edited.tif', edited), 'a');
    assert.equal(matched('IMG_4660_edited_edited.tif', edited), 'b');
  });

  it('infers the original basename for orphan warnings', () => {
    assert.equal(inferOriginalBasename('IMG_2579-Edit-2_edited_v2.tif'), 'IMG_2579');
    assert.equal(inferOriginalBasename('IMG_2579.tif'), null);
  });
});

describe('folder configuration', () => {
  it('accepts the new layout and the legacy layout', async () => {
    const fresh = await resolveEditFolders({ editPath, exportPath: activeEdits, returnPath: exportedTiffs, protectedPaths: [path.join(root, 'Media')] });
    assert.ok(fresh.ok && !fresh.folders.legacy);
    const legacy = await resolveEditFolders({ editPath, exportPath: null, returnPath: null, protectedPaths: [] });
    assert.ok(legacy.ok && legacy.folders.legacy);
    assert.equal(legacy.ok && legacy.folders.returnPath, legacy.ok && legacy.folders.editPath);
  });

  it('rejects overlapping or dangerous configurations', async () => {
    const media = path.join(root, 'Media');
    await fs.mkdir(media);
    const cases: Array<[string | null, string | null]> = [
      [activeEdits, activeEdits], // same folder
      [editPath, exportedTiffs], // return inside export
      [activeEdits, path.join(activeEdits, 'sub')], // nested
      [activeEdits, null], // only one set
      [activeEdits, media], // return == storage root
      [activeEdits, path.join(media, '2020')], // return inside storage root
      [root, exportedTiffs], // export contains storage root and the edit folder
    ];
    for (const [exportPath, returnPath] of cases) {
      const result = await resolveEditFolders({ editPath, exportPath, returnPath, protectedPaths: [media] });
      assert.equal(result.ok, false, `${exportPath} / ${returnPath}`);
    }
  });

  it('resolves symlinks so a link into the library is caught', async () => {
    const media = path.join(root, 'Media');
    await fs.mkdir(media);
    const link = path.join(root, 'innocent-link');
    await fs.symlink(media, link);
    const result = await resolveEditFolders({ editPath, exportPath: activeEdits, returnPath: link, protectedPaths: [media] });
    assert.equal(result.ok, false);
  });
});

describe('export (tests 1, 4, 5, 6)', () => {
  async function ctx(entries: ManifestEntry[] = [], force = false, names = memoryNames()): Promise<ExportContext> {
    return { exportPath: activeEdits, manifestEntries: entries, names, force, hashFile };
  }
  async function makeOriginal(name: string, content: string, folder = 'Media'): Promise<string> {
    const dir = path.join(root, folder);
    await fs.mkdir(dir, { recursive: true });
    const p = path.join(dir, name);
    await fs.writeFile(p, content);
    return p;
  }

  it('copies a new original under a coded name, only into the export folder, leaving the source unchanged', async () => {
    const src = await makeOriginal('IMG_5345.HEIC', 'original');
    const names = memoryNames();
    const out = await exportOneAsset({ assetId: ID_A, filename: 'IMG_5345.HEIC', sourcePath: src, contentHash: sha('original'), note: 'n' }, await ctx([], false, names));
    assert.equal(out.result.status, 'exported');
    assert.equal(out.result.exportedFilename, 'IMG_5345__tdgaaaaaaaa.HEIC');
    assert.equal(out.manifestEntry?.exportedFilename, 'IMG_5345__tdgaaaaaaaa.HEIC');
    assert.equal(out.manifestEntry?.originalFilename, 'IMG_5345.HEIC');
    assert.equal(names.records.get(ID_A)?.exported, true);
    assert.deepEqual(await fs.readdir(activeEdits), ['IMG_5345__tdgaaaaaaaa.HEIC']);
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_5345__tdgaaaaaaaa.HEIC'), 'utf-8'), 'original');
    assert.equal(await fs.readFile(src, 'utf-8'), 'original');
    assert.deepEqual(await fs.readdir(editPath).then((n) => n.sort()), ['Active Edits', 'Completed Edits', 'Exported TIFFs']);
  });

  it('never overwrites a modified working copy, and keeps its sidecar (test 5)', async () => {
    const src = await makeOriginal('IMG_5345.HEIC', 'original');
    await fs.writeFile(path.join(activeEdits, 'IMG_5345.HEIC'), 'original+lightroom-metadata');
    await fs.writeFile(path.join(activeEdits, 'IMG_5345.acr'), 'sidecar');
    const known = [entry('a', 'IMG_5345.HEIC', { exportedFilename: 'IMG_5345.HEIC', exportedAt: '2026-01-01T00:00:00.000Z' })];
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_5345.HEIC', sourcePath: src, contentHash: sha('original'), note: 'new note' }, await ctx(known));
    assert.equal(out.result.status, 'alreadyExported');
    assert.equal(out.manifestEntry?.note, 'new note');
    assert.equal(out.manifestEntry?.exportedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_5345.HEIC'), 'utf-8'), 'original+lightroom-metadata');
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_5345.acr'), 'utf-8'), 'sidecar');
    assert.deepEqual((await fs.readdir(activeEdits)).sort(), ['IMG_5345.HEIC', 'IMG_5345.acr']);
  });

  it('keeps the plain name of an untouched copy made before names were recorded', async () => {
    const src = await makeOriginal('IMG_1.JPG', 'bytes');
    await fs.writeFile(path.join(activeEdits, 'IMG_1.JPG'), 'bytes');
    const names = memoryNames();
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_1.JPG', sourcePath: src, contentHash: sha('bytes'), note: '' }, await ctx([], false, names));
    assert.equal(out.result.status, 'alreadyExported');
    assert.equal(names.records.get('a')?.exportedFilename, 'IMG_1.JPG');
  });

  it('gives photos that share a filename distinct names, and tells their edits apart (test 6)', async () => {
    const first = await makeOriginal('IMG_0001.JPG', 'first');
    const second = await makeOriginal('IMG_0001.JPG', 'second', 'Other');
    const names = memoryNames();
    const a = await exportOneAsset({ assetId: ID_A, filename: 'IMG_0001.JPG', sourcePath: first, contentHash: sha('first'), note: '' }, await ctx([], false, names));
    const b = await exportOneAsset(
      { assetId: ID_B, filename: 'IMG_0001.JPG', sourcePath: second, contentHash: sha('second'), note: '' },
      await ctx([a.manifestEntry!], false, names)
    );
    assert.equal(a.result.status, 'exported');
    assert.equal(b.result.status, 'exported');
    assert.equal(await fs.readFile(path.join(activeEdits, b.result.exportedFilename!), 'utf-8'), 'second');
    const entries = [a.manifestEntry!, b.manifestEntry!];
    for (const [out, id] of [[a, ID_A], [b, ID_B]] as const) {
      const returned = out.result.exportedFilename!.replace('.JPG', '_edited.tif');
      const match = matchEditedFilename(returned, entries);
      assert.equal(match.kind === 'matched' && match.entry.sourceAssetId, id, returned);
    }
    // The shared library name no longer identifies either of them.
    assert.equal(matchEditedFilename('IMG_0001_edited.tif', entries).kind, 'unmatched');
  });

  it('gives a twin its own name when an earlier export holds the plain one', async () => {
    const src = await makeOriginal('IMG_0001.JPG', 'second');
    await fs.writeFile(path.join(activeEdits, 'IMG_0001.JPG'), 'first');
    const known = [entry('a', 'IMG_0001.JPG', { exportedFilename: 'IMG_0001.JPG' })];
    const out = await exportOneAsset({ assetId: ID_B, filename: 'IMG_0001.JPG', sourcePath: src, contentHash: sha('second'), note: '' }, await ctx(known));
    assert.equal(out.result.status, 'exported');
    assert.equal(out.result.exportedFilename, 'IMG_0001__tdgbbbbbbbb.JPG');
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_0001.JPG'), 'utf-8'), 'first');
  });

  it('lengthens the code when another asset already holds the name', async () => {
    const twinId = 'aaaaaaaa-9999-4999-8999-999999999999';
    const src = await makeOriginal('IMG_7.JPG', 'one');
    const other = await makeOriginal('IMG_7.JPG', 'two', 'Other');
    const names = memoryNames();
    const a = await exportOneAsset({ assetId: ID_A, filename: 'IMG_7.JPG', sourcePath: src, contentHash: sha('one'), note: '' }, await ctx([], false, names));
    // Detected from the database records alone, with an empty manifest.
    const b = await exportOneAsset({ assetId: twinId, filename: 'IMG_7.JPG', sourcePath: other, contentHash: sha('two'), note: '' }, await ctx([], false, names));
    assert.equal(a.result.exportedFilename, 'IMG_7__tdgaaaaaaaa.JPG');
    assert.equal(b.result.exportedFilename, 'IMG_7__tdgaaaaaaaa9999.JPG');
  });

  it('reuses the recorded name, and recreates it only after confirmation', async () => {
    const src = await makeOriginal('IMG_8.HEIC', 'x');
    const names = memoryNames();
    const input = { assetId: ID_A, filename: 'IMG_8.HEIC', sourcePath: src, contentHash: sha('x'), note: '' };
    const first = await exportOneAsset(input, await ctx([], false, names));
    const name = first.result.exportedFilename!;
    await fs.rename(path.join(activeEdits, name), path.join(completedEdits, name));

    // Even with the manifest lost, the record remembers it.
    const blocked = await exportOneAsset(input, await ctx([], false, names));
    assert.equal(blocked.result.status, 'previouslyExported');
    assert.equal(blocked.result.exportedFilename, name);
    assert.deepEqual(await fs.readdir(activeEdits), []);

    const forced = await exportOneAsset(input, await ctx([], true, names));
    assert.equal(forced.result.status, 'exported');
    assert.equal(forced.result.exportedFilename, name);
  });

  it('keeps a name the manifest recorded before codes existed', async () => {
    const src = await makeOriginal('IMG_5237.HEIC', 'x');
    const names = memoryNames();
    const known = [entry('a', 'IMG_5237.HEIC', { exportedFilename: 'IMG_5237.heic' })];
    const input = { assetId: 'a', filename: 'IMG_5237.HEIC', sourcePath: src, contentHash: sha('x'), note: '' };
    const blocked = await exportOneAsset(input, await ctx(known, false, names));
    assert.equal(blocked.result.status, 'previouslyExported');
    const forced = await exportOneAsset(input, await ctx(known, true, names));
    assert.equal(forced.result.exportedFilename, 'IMG_5237.heic');
    assert.deepEqual(await fs.readdir(activeEdits), ['IMG_5237.heic']);
  });

  it('does not treat a reserved but never-created name as already exported', async () => {
    const src = await makeOriginal('IMG_9.JPG', 'x');
    const names = memoryNames();
    const missing = await exportOneAsset(
      { assetId: ID_A, filename: 'IMG_9.JPG', sourcePath: path.join(root, 'gone.jpg'), contentHash: null, note: '' },
      await ctx([], false, names)
    );
    assert.equal(missing.result.status, 'failed');
    assert.equal(names.records.get(ID_A)?.exported, false);
    const retried = await exportOneAsset({ assetId: ID_A, filename: 'IMG_9.JPG', sourcePath: src, contentHash: sha('x'), note: '' }, await ctx([], false, names));
    assert.equal(retried.result.status, 'exported');
  });

  it('reports a conflict for an unknown file under a coded name that was never created', async () => {
    const src = await makeOriginal('IMG_9.JPG', 'mine');
    await fs.writeFile(path.join(activeEdits, 'IMG_9__tdgaaaaaaaa.JPG'), 'something else');
    const out = await exportOneAsset({ assetId: ID_A, filename: 'IMG_9.JPG', sourcePath: src, contentHash: sha('mine'), note: '' }, await ctx());
    assert.equal(out.result.status, 'conflict');
    assert.equal(out.manifestEntry, null);
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_9__tdgaaaaaaaa.JPG'), 'utf-8'), 'something else');
  });

  it('treats an unknown, different file under the plain name as a conflict, whatever its case', async () => {
    const src = await makeOriginal('IMG_2.JPG', 'mine');
    await fs.writeFile(path.join(activeEdits, 'img_2.jpg'), 'something else');
    const out = await exportOneAsset({ assetId: ID_A, filename: 'IMG_2.JPG', sourcePath: src, contentHash: sha('mine'), note: '' }, await ctx());
    // On a case-sensitive volume the two names are different files.
    assert.ok(['conflict', 'exported'].includes(out.result.status));
    assert.equal(await fs.readFile(path.join(activeEdits, 'img_2.jpg'), 'utf-8'), 'something else');
  });

  function segment(marker: number, payload: string): Buffer {
    const body = Buffer.from(payload, 'latin1');
    const header = Buffer.from([0xff, marker, 0, 0]);
    header.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([header, body]);
  }
  // A structurally valid miniature JPEG: metadata segments, then tables, frame and scan.
  function jpeg(picture: string, metadata: Buffer[] = [segment(0xe1, 'Exif')]): Buffer {
    return Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      ...metadata,
      segment(0xdb, 'quantization'),
      segment(0xc0, 'frame'),
      segment(0xda, 'scan'),
      Buffer.from(picture, 'latin1'),
      Buffer.from([0xff, 0xd9]),
    ]);
  }
  const lightroomMetadata = [segment(0xe1, 'Exif rewritten'), segment(0xe1, 'xmp history'), segment(0xed, 'iptc'), segment(0xfe, 'comment')];
  const bufferHash = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

  async function exportJpegOverExisting(existing: Buffer, known: ManifestEntry[] = [], original = jpeg('pixels')) {
    const dir = path.join(root, 'Media');
    await fs.mkdir(dir, { recursive: true });
    const src = path.join(dir, 'IMG_2579.jpg');
    await fs.writeFile(src, original);
    await fs.writeFile(path.join(activeEdits, 'IMG_2579.jpg'), existing);
    const context: ExportContext = { ...(await ctx(known)), hashFile: async (p) => bufferHash(await fs.readFile(p)) };
    const out = await exportOneAsset(
      { assetId: 'a', filename: 'IMG_2579.jpg', sourcePath: src, contentHash: bufferHash(original), note: '' },
      context
    );
    assert.deepEqual(await fs.readFile(path.join(activeEdits, 'IMG_2579.jpg')), existing, 'working copy untouched');
    return out;
  }

  it('recognizes a JPEG whose metadata Lightroom changed, with no manifest entry', async () => {
    const out = await exportJpegOverExisting(jpeg('pixels', lightroomMetadata));
    assert.equal(out.result.status, 'alreadyExported');
    assert.equal(out.manifestEntry?.sourceAssetId, 'a');
  });

  it('reports a conflict for a JPEG with a different picture', async () => {
    const out = await exportJpegOverExisting(jpeg('other pixels', lightroomMetadata));
    assert.equal(out.result.status, 'conflict');
    assert.equal(out.manifestEntry, null);
  });

  it('reports a conflict for a truncated or non-JPEG file with a .jpg name', async () => {
    for (const existing of [jpeg('pixels').subarray(0, 12), Buffer.from('not a jpeg')]) {
      const out = await exportJpegOverExisting(existing);
      assert.equal(out.result.status, 'conflict');
    }
  });

  it('never takes over a name the manifest ties to another asset', async () => {
    const other = [entry('b', 'IMG_2579.jpg', { exportedFilename: 'IMG_2579.jpg' })];
    for (const existing of [jpeg('pixels'), jpeg('pixels', lightroomMetadata)]) {
      const out = await exportJpegOverExisting(existing, other);
      // The other photo's file is left alone; this one gets a name of its own.
      assert.equal(out.result.status, 'exported');
      assert.match(out.result.exportedFilename!, /^IMG_2579__tdg[0-9a-f]{8}\.jpg$/);
      await fs.rm(path.join(activeEdits, out.result.exportedFilename!));
    }
  });

  it('reports a conflict when its own recorded name is listed for another asset too', async () => {
    const both = [
      entry('a', 'IMG_2579.jpg', { exportedFilename: 'IMG_2579.jpg' }),
      entry('b', 'IMG_2579.jpg', { exportedFilename: 'IMG_2579.jpg' }),
    ];
    const out = await exportJpegOverExisting(jpeg('pixels'), both);
    assert.equal(out.result.status, 'conflict');
    assert.equal(out.manifestEntry, null);
  });

  it('asks before re-exporting when the earlier working copy is gone (spec 7.3)', async () => {
    const src = await makeOriginal('IMG_4612.HEIC', 'x');
    const known = [entry('a', 'IMG_4612.HEIC', { exportedFilename: 'IMG_4612.HEIC' })];
    const blocked = await exportOneAsset({ assetId: 'a', filename: 'IMG_4612.HEIC', sourcePath: src, contentHash: sha('x'), note: '' }, await ctx(known));
    assert.equal(blocked.result.status, 'previouslyExported');
    await assert.rejects(fs.stat(path.join(activeEdits, 'IMG_4612.HEIC')));
    const forced = await exportOneAsset({ assetId: 'a', filename: 'IMG_4612.HEIC', sourcePath: src, contentHash: sha('x'), note: '' }, await ctx(known, true));
    assert.equal(forced.result.status, 'exported');
  });

  it('fails cleanly when the source is missing and creates no manifest entry', async () => {
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_9.JPG', sourcePath: path.join(root, 'nope.jpg'), contentHash: null, note: '' }, await ctx());
    assert.equal(out.result.status, 'failed');
    assert.equal(out.manifestEntry, null);
  });
});

describe('export names', () => {
  it('builds the readable part of a new name without stacking codes or _edited', () => {
    for (const [filename, rootName] of [
      ['IMG_3161.jpg', 'IMG_3161'],
      ['IMG_3161__tdgaaaaaaaa_edited.tif', 'IMG_3161'],
      ['IMG_3161__tdgaaaaaaaa-Edit-2_edited_v2.tif', 'IMG_3161'],
      ['IMG_3161__tdgaaaaaaaa-restoration_edited.tif', 'IMG_3161'],
      ['IMG_4516_edited_ai.png', 'IMG_4516'],
      ['IMG_2579-Edit_edited.tif', 'IMG_2579'],
      ['Sunset-HDR.jpg', 'Sunset-HDR'],
      ['76697144598__30CC69A5-D9A9.heic', '76697144598__30CC69A5-D9A9'],
      ['AGF00002-edited(1).jpg', 'AGF00002-edited(1)'],
    ]) {
      assert.equal(exportRootName(filename!), rootName, filename);
    }
    assert.equal(exportCodes(ID_A)[0], 'aaaaaaaa');
    assert.match(exportCodes('not-a-uuid')[0]!, /^[0-9a-f]{8}$/);
  });

  const coded = entry(ID_A, 'IMG_3161.jpg', { exportedFilename: 'IMG_3161__tdgaaaaaaaa.jpg' });

  it('accepts descriptions after a coded name only', () => {
    const matched = (name: string, list: ManifestEntry[]): boolean => matchEditedFilename(name, list).kind === 'matched';
    for (const name of [
      'IMG_3161__tdgaaaaaaaa_edited.tif',
      'IMG_3161__tdgaaaaaaaa-Edit_edited_v2.tif',
      'IMG_3161__tdgaaaaaaaa-restoration_edited.tif',
      'IMG_3161__tdgaaaaaaaa-Edit-color fix_edited.tif',
      'img_3161__TDGAAAAAAAA-Restoration_edited.TIF',
    ]) {
      assert.ok(matched(name, [coded]), name);
    }
    for (const name of [
      'IMG_3161_edited.tif',
      'IMG_3161__tdgaaaaaaaarestoration_edited.tif',
      'IMG_3161__tdgaaaaaaaa restoration_edited.tif',
      'IMG_3161__tdgaaaaaaaa-x_edited_ai_edited.tif',
      'IMG_3161__tdgaaaaaaaa-x__tdgbbbbbbbb_edited.tif',
      'IMG_3161__tdgaaaaaaaabbbb_edited.tif',
    ]) {
      assert.ok(!matched(name, [coded]), name);
    }
    assert.ok(!matched('IMG_3161-restoration_edited.tif', [entry('a', 'IMG_3161.jpg')]));
  });

  it('infers the coded name for orphan warnings', () => {
    assert.equal(inferOriginalBasename('IMG_3161__tdgaaaaaaaa-restoration_edited.tif'), 'IMG_3161__tdgaaaaaaaa');
  });

  async function exportAs(assetId: string, filename: string, names: ExportNameStore, entries: ManifestEntry[]): Promise<ExportOutcome> {
    const src = path.join(root, `source-${assetId}`);
    await fs.writeFile(src, assetId);
    return exportOneAsset(
      { assetId, filename, sourcePath: src, contentHash: sha(assetId), note: '' },
      { exportPath: activeEdits, manifestEntries: entries, names, force: false, hashFile }
    );
  }
  const sourceOf = (name: string, entries: ManifestEntry[]): string | null => {
    const m = matchEditedFilename(name, entries);
    return m.kind === 'matched' ? m.entry.sourceAssetId : null;
  };

  it('scenario A: further versions from one project belong to the original', async () => {
    const names = memoryNames();
    const a = await exportAs(ID_A, 'IMG_3161.jpg', names, []);
    const entries = [a.manifestEntry!];
    for (const name of ['IMG_3161__tdgaaaaaaaa_edited.tif', 'IMG_3161__tdgaaaaaaaa-Edit_edited_v2.tif']) {
      assert.equal(sourceOf(name, entries), ID_A, name);
    }
  });

  it('scenario B: an edit queued again belongs to itself, not to its ancestor', async () => {
    const names = memoryNames();
    const a = await exportAs(ID_A, 'IMG_3161.jpg', names, []);
    // The imported TIFF becomes asset C, still carrying A's code in its filename.
    const c = await exportAs(ID_C, 'IMG_3161__tdgaaaaaaaa_edited.tif', names, [a.manifestEntry!]);
    assert.equal(c.result.exportedFilename, 'IMG_3161__tdgcccccccc.tif');
    const entries = [a.manifestEntry!, c.manifestEntry!];
    assert.equal(sourceOf('IMG_3161__tdgcccccccc_edited.tif', entries), ID_C);
    assert.equal(sourceOf('IMG_3161__tdgcccccccc-Edit_edited.tif', entries), ID_C);
    assert.equal(sourceOf('IMG_3161__tdgaaaaaaaa_edited.tif', entries), ID_A);
  });

  it('leaves ambiguous older names unmatched to either photo', () => {
    const old = [entry('a', 'IMG_0001.JPG'), entry('b', 'IMG_0001.HEIC')];
    assert.equal(matchEditedFilename('IMG_0001_edited.tif', old).kind, 'ambiguous');
  });

  it('rebuilds a lost manifest from the records, without replacing listed entries', async () => {
    const names = memoryNames();
    const a = await exportAs(ID_A, 'IMG_3161.jpg', names, []);
    await names.claim({ assetId: ID_B, exportedFilename: 'IMG_2__tdgbbbbbbbb.jpg', originalFilename: 'IMG_2.jpg', exported: false, createdAt: '' });

    assert.equal((await readManifestState(editPath)).status, 'missing');
    const restored = entriesMissingFromManifest([...names.records.values()], [], () => 'queued note');
    // The reserved name that never got a file is not restored.
    assert.deepEqual(restored.map((e) => e.sourceAssetId), [ID_A]);
    assert.equal(restored[0]?.note, 'queued note');
    await mergeIntoManifest(editPath, restored);
    const manifest = await readManifest(editPath);
    assert.equal(sourceOf('IMG_3161__tdgaaaaaaaa_edited.tif', manifest!.entries), ID_A);
    assert.deepEqual(entriesMissingFromManifest([...names.records.values()], [a.manifestEntry!]), []);
  });
});

describe('manifest (test 4)', () => {
  it('merges batches and keeps earlier entries', async () => {
    await mergeIntoManifest(editPath, [entry('a', 'IMG_1.JPG')]);
    await mergeIntoManifest(editPath, [entry('b', 'IMG_2.JPG')]);
    await Promise.all([mergeIntoManifest(editPath, [entry('c', 'IMG_3.JPG')]), mergeIntoManifest(editPath, [entry('d', 'IMG_4.JPG')])]);
    const manifest = await readManifest(editPath);
    assert.deepEqual(manifest?.entries.map((e) => e.sourceAssetId).sort(), ['a', 'b', 'c', 'd']);
    const names = await fs.readdir(editPath);
    assert.ok(!names.some((n) => n.endsWith('.tmp')));
  });

  it('refuses to overwrite an unreadable manifest', async () => {
    await fs.writeFile(path.join(editPath, 'manifest.json'), '{ not json');
    assert.equal((await readManifestState(editPath)).status, 'unreadable');
    await assert.rejects(mergeIntoManifest(editPath, [entry('a', 'IMG_1.JPG')]));
    assert.equal(await fs.readFile(path.join(editPath, 'manifest.json'), 'utf-8'), '{ not json');
  });
});

describe('return folder scan and manifest independence (tests 8, 9)', () => {
  it('imports only from the return folder, wherever the working files have moved', async () => {
    const entries = [entry('a', 'IMG_4612.HEIC')];
    // Working project moved into a subfolder, then into Completed Edits.
    await fs.mkdir(path.join(activeEdits, 'IMG_4612 - Beach Project'));
    await fs.writeFile(path.join(activeEdits, 'IMG_4612 - Beach Project', 'IMG_4612-Edit_edited.tif'), 'intermediate');
    await fs.writeFile(path.join(activeEdits, 'IMG_4612-Edit_edited.tif'), 'intermediate');
    await fs.writeFile(path.join(completedEdits, 'IMG_4612-Edit_edited.tif'), 'intermediate');
    await fs.writeFile(path.join(exportedTiffs, 'IMG_4612-Edit_edited.tif'), 'finished');
    await fs.writeFile(path.join(exportedTiffs, '._IMG_4612-Edit_edited.tif'), 'appledouble');
    await fs.mkdir(path.join(exportedTiffs, 'sub'));
    await fs.writeFile(path.join(exportedTiffs, 'sub', 'IMG_4612_edited.tif'), 'nested');

    const scan = await scanReturnFolder(exportedTiffs, entries);
    assert.deepEqual(scan.matched.map((m) => m.filename), ['IMG_4612-Edit_edited.tif']);
    assert.equal(scan.ambiguous.length + scan.unmatched.length, 0);
  });

  it('classifies ambiguous and unmatched files', async () => {
    const entries = [entry('a', 'IMG_2579.JPG'), entry('b', 'IMG_2579-Edit.tif')];
    await fs.writeFile(path.join(exportedTiffs, 'IMG_2579-Edit_edited.tif'), '1');
    await fs.writeFile(path.join(exportedTiffs, 'IMG_7777_edited.tif'), '2');
    const scan = await scanReturnFolder(exportedTiffs, entries);
    assert.equal(scan.ambiguous.length, 1);
    assert.deepEqual(scan.unmatched.map((u) => u.inferredBasename), ['IMG_7777']);
  });
});

describe('cleanup safety (tests 10, 12)', () => {
  async function populateWorkingFiles(): Promise<string[]> {
    const files = [
      'Active Edits/IMG_1.HEIC', 'Active Edits/IMG_1.acr', 'Active Edits/IMG_1.xmp', 'Active Edits/IMG_1-Edit.psd',
      'Active Edits/IMG_1-Edit_edited.tif', 'Active Edits/Project/IMG_2.JPG', 'Active Edits/Project/mask.png',
      'Completed Edits/IMG_3.HEIC', 'Completed Edits/IMG_3-Edit-2_edited.tif', 'Completed Edits/Done/layered.tif',
      'Pending Deletion/old_edited.tif', 'manifest.json', 'notes.txt',
    ];
    for (const rel of files) {
      const abs = path.join(editPath, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, rel);
    }
    return files;
  }

  it('clearing returned files touches nothing outside the return folder', async () => {
    const files = await populateWorkingFiles();
    await fs.writeFile(path.join(exportedTiffs, 'IMG_1_edited.tif'), 'x');
    await fs.writeFile(path.join(exportedTiffs, 'keepme.tif'), 'not edit output');
    await fs.mkdir(path.join(exportedTiffs, 'folder_edited'));
    await fs.writeFile(path.join(exportedTiffs, 'folder_edited', 'inner_edited.tif'), 'x');

    const deleted = await clearReturnedFiles(exportedTiffs);
    assert.deepEqual(deleted, ['IMG_1_edited.tif']);
    for (const rel of files) {
      assert.equal(await fs.readFile(path.join(editPath, rel), 'utf-8'), rel, rel);
    }
    assert.equal(await fs.readFile(path.join(exportedTiffs, 'keepme.tif'), 'utf-8'), 'not edit output');
    assert.equal(await fs.readFile(path.join(exportedTiffs, 'folder_edited', 'inner_edited.tif'), 'utf-8'), 'x');
  });

  it('only deletes what the user confirmed', async () => {
    await fs.writeFile(path.join(exportedTiffs, 'A_edited.tif'), 'x');
    await fs.writeFile(path.join(exportedTiffs, 'B_edited.tif'), 'x');
    assert.deepEqual(await clearReturnedFiles(exportedTiffs, ['A_edited.tif']), ['A_edited.tif']);
    assert.deepEqual((await listClearableReturnFiles(exportedTiffs)).map((f) => f.filename), ['B_edited.tif']);
  });

  it('in the legacy layout, never deletes manifest, notes, working copies or subfolders', async () => {
    await populateWorkingFiles();
    await fs.writeFile(path.join(editPath, 'IMG_9.HEIC'), 'exported original');
    await fs.writeFile(path.join(editPath, 'IMG_9_edited.tif'), 'finished');
    const deleted = await clearReturnedFiles(editPath);
    assert.deepEqual(deleted, ['IMG_9_edited.tif']);
    for (const keep of ['manifest.json', 'notes.txt', 'IMG_9.HEIC', 'Active Edits/IMG_1.acr']) {
      await fs.stat(path.join(editPath, keep));
    }
  });

  it('single-file delete rejects traversal, bookkeeping files, directories and symlinks', async () => {
    await fs.writeFile(path.join(editPath, 'manifest.json'), '{}');
    await fs.writeFile(path.join(activeEdits, 'precious.psd'), 'work');
    await fs.mkdir(path.join(exportedTiffs, 'dir'));
    await fs.symlink(path.join(activeEdits, 'precious.psd'), path.join(exportedTiffs, 'link_edited.tif'));
    for (const name of ['../Active Edits/precious.psd', '..', 'manifest.json', 'notes.txt', 'dir', 'link_edited.tif', '']) {
      await assert.rejects(deleteReturnFile(exportedTiffs, name), UnsafeDeleteError, name);
    }
    assert.equal(await fs.readFile(path.join(activeEdits, 'precious.psd'), 'utf-8'), 'work');
    // Symlinks are not even offered for clearing.
    assert.deepEqual(await listClearableReturnFiles(exportedTiffs), []);
  });
});

describe('import placement (tests 2, 11)', () => {
  it('moves the file into place and removes the return file only after records succeed', async () => {
    const ret = path.join(exportedTiffs, 'IMG_1_edited.tif');
    const dest = path.join(root, 'Media', 'IMG_1_edited.tif');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(ret, 'finished');
    let returnFileExistedDuringRecords = false;
    const out = await placeEditedFile(ret, dest, async () => {
      returnFileExistedDuringRecords = await fs.stat(ret).then(() => true, () => false);
      return 'record';
    });
    assert.equal(out.value, 'record');
    assert.ok(returnFileExistedDuringRecords);
    assert.equal(out.returnFileRemoved, true);
    assert.equal(await fs.readFile(dest, 'utf-8'), 'finished');
    await assert.rejects(fs.stat(ret));
  });

  it('on failure removes the copy and leaves the return file for retry', async () => {
    const ret = path.join(exportedTiffs, 'IMG_1_edited.tif');
    const dest = path.join(root, 'Media', 'IMG_1_edited.tif');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(ret, 'finished');
    await assert.rejects(placeEditedFile(ret, dest, async () => { throw new Error('db down'); }), /db down/);
    assert.equal(await fs.readFile(ret, 'utf-8'), 'finished');
    await assert.rejects(fs.stat(dest));
  });

  it('refuses to overwrite an existing library file', async () => {
    const ret = path.join(exportedTiffs, 'IMG_1_edited.tif');
    const dest = path.join(root, 'Media', 'IMG_1_edited.tif');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(ret, 'new');
    await fs.writeFile(dest, 'existing asset');
    let ran = false;
    await assert.rejects(placeEditedFile(ret, dest, async () => { ran = true; }), DestinationExistsError);
    assert.equal(ran, false);
    assert.equal(await fs.readFile(dest, 'utf-8'), 'existing asset');
    assert.equal(await fs.readFile(ret, 'utf-8'), 'new');
  });
});
