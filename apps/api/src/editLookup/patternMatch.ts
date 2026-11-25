// Search-pattern matching for the Edit Queue / Edit History lookup.
//
// A pattern is plain text where `*` matches any run of characters and `?`
// matches exactly one. Matching is case-insensitive and unanchored — the
// pattern may match anywhere in the text — so a bare `IMG_5345` finds
// `IMG_5345.heic` and `IMG_5345_edited.tif` without needing `*IMG_5345*`.

function escapeRegExpChar(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function compileSearchPattern(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let source = '';
  for (const char of trimmed) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += escapeRegExpChar(char);
    }
  }
  return new RegExp(source, 'i');
}

// A trailing file extension (".CR2", ".heic") is dropped to build a second
// pattern for filename fields, so a name copied from Lightroom with one
// extension still finds the same photo stored under another. Skipped when
// nothing but wildcards would remain ("*.dng" must not become "*").
function stripTrailingExtension(pattern: string): string | null {
  const stripped = pattern.trim().replace(/\.[A-Za-z0-9]{2,5}$/, '');
  if (stripped === pattern.trim()) {
    return null;
  }
  return /[^*?\s]/.test(stripped) ? stripped : null;
}

export interface EditLookupMatchers {
  // Matches any field (filenames, folder, album path, notes).
  general: RegExp;
  // Additional matcher used only for filename fields (extension stripped).
  filenameWithoutExtension: RegExp | null;
}

export function buildEditLookupMatchers(query: string): EditLookupMatchers | null {
  const general = compileSearchPattern(query);
  if (!general) {
    return null;
  }
  const stripped = stripTrailingExtension(query);
  return {
    general,
    filenameWithoutExtension: stripped ? compileSearchPattern(stripped) : null
  };
}

export function matchesFilename(matchers: EditLookupMatchers, filename: string): boolean {
  return (
    matchers.general.test(filename) ||
    (matchers.filenameWithoutExtension?.test(filename) ?? false)
  );
}

export function matchesText(matchers: EditLookupMatchers, text: string): boolean {
  return matchers.general.test(text);
}
