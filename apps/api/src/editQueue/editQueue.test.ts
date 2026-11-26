import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { matchEditedFilename, inferOriginalBasename } from './editedFilenameMatch.js';
import { resolveEditFolders } from './editFolders.js';
import { exportOneAsset, type ExportContext } from './exportService.js';
import { DestinationExistsError, placeEditedFile } from './importPlacement.js';
import { mergeIntoManifest, readManifest, type ManifestEntry } from './manifest.js';
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
  async function ctx(entries: ManifestEntry[] = [], force = false): Promise<ExportContext> {
    return { exportPath: activeEdits, manifestEntries: entries, force, hashFile };
  }
  async function makeOriginal(name: string, content: string): Promise<string> {
    const dir = path.join(root, 'Media');
    await fs.mkdir(dir, { recursive: true });
    const p = path.join(dir, name);
    await fs.writeFile(p, content);
    return p;
  }

  it('copies a new original only into the export folder and leaves the source unchanged', async () => {
    const src = await makeOriginal('IMG_5345.HEIC', 'original');
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_5345.HEIC', sourcePath: src, contentHash: sha('original'), note: 'n' }, await ctx());
    assert.equal(out.result.status, 'exported');
    assert.equal(out.manifestEntry?.exportedFilename, 'IMG_5345.HEIC');
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_5345.HEIC'), 'utf-8'), 'original');
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
  });

  it('recognizes an untouched copy by content hash even with no manifest entry', async () => {
    const src = await makeOriginal('IMG_1.JPG', 'bytes');
    await fs.writeFile(path.join(activeEdits, 'IMG_1.JPG'), 'bytes');
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_1.JPG', sourcePath: src, contentHash: sha('bytes'), note: '' }, await ctx());
    assert.equal(out.result.status, 'alreadyExported');
  });

  it('reports a conflict for a different asset with the same filename (test 6)', async () => {
    const first = await makeOriginal('IMG_0001.JPG', 'first');
    const second = path.join(root, 'Other');
    await fs.mkdir(second);
    const secondPath = path.join(second, 'IMG_0001.JPG');
    await fs.writeFile(secondPath, 'second');

    const a = await exportOneAsset({ assetId: 'a', filename: 'IMG_0001.JPG', sourcePath: first, contentHash: sha('first'), note: '' }, await ctx());
    assert.equal(a.result.status, 'exported');
    const b = await exportOneAsset(
      { assetId: 'b', filename: 'IMG_0001.JPG', sourcePath: secondPath, contentHash: sha('second'), note: '' },
      await ctx([a.manifestEntry!])
    );
    assert.equal(b.result.status, 'conflict');
    assert.equal(b.manifestEntry, null);
    assert.equal(await fs.readFile(path.join(activeEdits, 'IMG_0001.JPG'), 'utf-8'), 'first');
  });

  it('treats an unknown, different file as a conflict and case-variant names as the same file', async () => {
    const src = await makeOriginal('IMG_2.JPG', 'mine');
    await fs.writeFile(path.join(activeEdits, 'img_2.jpg'), 'something else');
    const out = await exportOneAsset({ assetId: 'a', filename: 'IMG_2.JPG', sourcePath: src, contentHash: sha('mine'), note: '' }, await ctx());
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
      assert.equal(out.result.status, 'conflict');
      assert.equal(out.manifestEntry, null);
    }
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
