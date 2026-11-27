import {
  endsWithExportCode,
  nameKeyOf,
  recordFromEntry,
  type ExportNameRecord,
  type ExportNameStore,
} from '../editQueue/exportNames.js';
import { basenameWithoutExt, type ManifestEntry } from '../editQueue/manifest.js';
import { EditExportNameModel } from '../models/editExportNameModel.js';

const RECORD_FIELDS = { _id: 0, assetId: 1, exportedFilename: 1, originalFilename: 1, exported: 1, createdAt: 1 } as const;
const DUPLICATE_KEY = 11000;

export async function listExportNames(): Promise<ExportNameRecord[]> {
  return EditExportNameModel.find({}, RECORD_FIELDS).lean<ExportNameRecord[]>();
}

async function find(assetId: string): Promise<ExportNameRecord | null> {
  return EditExportNameModel.findOne({ assetId }, RECORD_FIELDS).lean<ExportNameRecord | null>();
}

async function claim(record: ExportNameRecord): Promise<ExportNameRecord | null> {
  // The unique indexes are what guarantee uniqueness, so wait for them to exist.
  await EditExportNameModel.init();
  const existing = await find(record.assetId);
  if (existing) {
    return existing;
  }
  try {
    await EditExportNameModel.create({
      ...record,
      nameKey: nameKeyOf(record.exportedFilename),
      coded: endsWithExportCode(basenameWithoutExt(record.exportedFilename)),
    });
    return record;
  } catch (error) {
    if ((error as { code?: number }).code !== DUPLICATE_KEY) {
      throw error;
    }
    // Either this asset was recorded meanwhile, or the name is another asset's.
    return find(record.assetId);
  }
}

async function markExported(assetId: string): Promise<void> {
  await EditExportNameModel.updateOne({ assetId }, { exported: true });
}

export const exportNameStore: ExportNameStore = { find, claim, markExported };

/** Records the name of every manifest entry whose asset has none. Returns how many were added. */
export async function recordManifestNames(entries: ManifestEntry[]): Promise<number> {
  const known = new Set((await listExportNames()).map((r) => r.assetId));
  let added = 0;
  for (const entry of entries) {
    if (known.has(entry.sourceAssetId)) continue;
    if (await claim(recordFromEntry(entry))) {
      known.add(entry.sourceAssetId);
      added++;
    }
  }
  return added;
}
