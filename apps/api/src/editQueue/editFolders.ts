import fs from 'node:fs/promises';
import path from 'node:path';

// The Edit Queue works with up to three folders:
//
//   editPath    — Tedography's bookkeeping folder: manifest.json and notes.txt.
//   exportPath  — where Export copies originals ("Active Edits"). Lightroom and
//                 the user own what happens to files here; Tedography only ever
//                 creates new files in it and never deletes or modifies any.
//   returnPath  — where finished edits are dropped for Import ("Exported TIFFs").
//                 The only folder Tedography cleans up.
//
// When TEDOGRAPHY_EDIT_EXPORT_PATH / TEDOGRAPHY_EDIT_RETURN_PATH are both unset,
// all three are the same folder (the legacy single-folder layout).

export interface EditFolders {
  editPath: string;
  exportPath: string;
  returnPath: string;
  legacy: boolean;
}

export interface EditFolderInput {
  editPath: string;
  exportPath: string | null;
  returnPath: string | null;
  // Folders that must never be exported into or cleaned up: storage roots,
  // the derived root, the unrotated root.
  protectedPaths: string[];
}

export type EditFoldersResult = { ok: true; folders: EditFolders } | { ok: false; error: string };

/**
 * realpath that tolerates a folder that doesn't exist yet: resolves the nearest
 * existing ancestor (following symlinks) and re-appends the missing tail.
 */
export async function realpathLoose(target: string): Promise<string> {
  const resolved = path.resolve(target);
  const tail: string[] = [];
  let current = resolved;
  for (;;) {
    try {
      const real = await fs.realpath(current);
      return tail.length > 0 ? path.join(real, ...tail.reverse()) : real;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw err;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return resolved;
      }
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

function normalizeForCompare(p: string): string {
  // macOS volumes are usually case-insensitive; a false "overlap" only rejects
  // a configuration, whereas a missed one could allow a destructive operation.
  return path.resolve(p).toLowerCase();
}

/** True when `inner` is the same folder as `outer` or lies beneath it. */
export function isSameOrInside(inner: string, outer: string): boolean {
  const a = normalizeForCompare(inner);
  const b = normalizeForCompare(outer);
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

export async function resolveEditFolders(input: EditFolderInput): Promise<EditFoldersResult> {
  const legacy = input.exportPath == null && input.returnPath == null;
  const editPath = await realpathLoose(input.editPath);
  const exportPath = await realpathLoose(input.exportPath ?? input.editPath);
  const returnPath = await realpathLoose(input.returnPath ?? input.editPath);

  const protectedPaths = await Promise.all(input.protectedPaths.map((p) => realpathLoose(p)));
  const named: Array<[string, string]> = [
    ['TEDOGRAPHY_EDIT_PATH', editPath],
    ['The Edit export folder', exportPath],
    ['The Edit return folder', returnPath],
  ];
  for (const [label, folder] of named) {
    for (const protectedPath of protectedPaths) {
      if (isSameOrInside(folder, protectedPath) || isSameOrInside(protectedPath, folder)) {
        return {
          ok: false,
          error: `${label} (${folder}) overlaps a Tedography storage folder (${protectedPath}). Choose a separate folder.`,
        };
      }
    }
  }

  if (!legacy) {
    if (input.exportPath == null || input.returnPath == null) {
      return {
        ok: false,
        error:
          'Set both TEDOGRAPHY_EDIT_EXPORT_PATH and TEDOGRAPHY_EDIT_RETURN_PATH, or neither (legacy single-folder layout).',
      };
    }
    if (isSameOrInside(exportPath, returnPath) || isSameOrInside(returnPath, exportPath)) {
      return {
        ok: false,
        error: `The export folder (${exportPath}) and the return folder (${returnPath}) must be separate folders, neither inside the other.`,
      };
    }
    for (const [label, folder] of [
      ['export', exportPath],
      ['return', returnPath],
    ] as const) {
      if (isSameOrInside(editPath, folder)) {
        return {
          ok: false,
          error: `The ${label} folder (${folder}) must not contain TEDOGRAPHY_EDIT_PATH (${editPath}), which holds manifest.json.`,
        };
      }
    }
  }

  return { ok: true, folders: { editPath, exportPath, returnPath, legacy } };
}
