#!/usr/bin/env node

/**
 * copy-importable-media.js
 *
 * Recursively copies importable media files from SOURCE_ROOT to DEST_ROOT.
 *
 * Rules:
 * - skip files whose names begin with '.'
 * - copy all .heic / .HEIC files
 * - copy .jpg / .JPG only if there is not a sibling .heic / .HEIC
 *   with the same basename
 * - copy other files whose extensions are listed in IMPORTABLE_EXTENSIONS
 *
 * Notes:
 * - SOURCE_ROOT must exist
 * - DEST_ROOT is created if needed
 * - directory structure is preserved
 *
 * Usage:
cd "/Users/tedshaffer/Documents/Projects/tedography/scripts"
node ./copy-importable-media.js
 */

const fs = require('fs/promises');
const path = require('path');

const SOURCE_ROOT = '/Volumes/ShMedia/Shafferography/ShafferographyMedia';
const DEST_ROOT = '/Volumes/ShMedia/Shafferography/ShafferographyMediaNew';

/**
 * Adjust this set to match Tedography's actual importable extensions.
 * Keep everything lowercase.
 */
const IMPORTABLE_EXTENSIONS = new Set([
  '.heic',
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
]);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function extLower(name) {
  return path.extname(name).toLowerCase();
}

function basenameWithoutExt(name) {
  return path.basename(name, path.extname(name));
}

function isHiddenFileName(name) {
  return name.startsWith('.');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFilePreserveDirs(srcFile, destFile) {
  await ensureDir(path.dirname(destFile));
  await fs.copyFile(srcFile, destFile);
  console.log(`COPIED: ${srcFile} -> ${destFile}`);
}

async function processDirectory(srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  // Build quick lookup of visible filenames in this directory for jpg/heic sibling logic.
  const fileNames = new Set(
    entries
      .filter((e) => e.isFile() && !isHiddenFileName(e.name))
      .map((e) => e.name)
  );

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(srcPath, destPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    // Skip hidden files like .DS_Store, ._foo.jpg, etc.
    if (isHiddenFileName(entry.name)) {
      console.log(`SKIPPED hidden file: ${srcPath}`);
      continue;
    }

    const ext = extLower(entry.name);

    // Skip anything not importable.
    if (!IMPORTABLE_EXTENSIONS.has(ext)) {
      continue;
    }

    // Always copy HEIC files.
    if (ext === '.heic') {
      await copyFilePreserveDirs(srcPath, destPath);
      continue;
    }

    // Copy JPG/JPEG only if there is no sibling .heic / .HEIC with same basename.
    if (ext === '.jpg' || ext === '.jpeg') {
      const base = basenameWithoutExt(entry.name);
      const hasSiblingHeic =
        fileNames.has(`${base}.heic`) || fileNames.has(`${base}.HEIC`);

      if (hasSiblingHeic) {
        console.log(`SKIPPED JPG (matching HEIC exists): ${srcPath}`);
        continue;
      }

      await copyFilePreserveDirs(srcPath, destPath);
      continue;
    }

    // Copy all other importable extensions.
    await copyFilePreserveDirs(srcPath, destPath);
  }
}

async function main() {
  const srcExists = await pathExists(SOURCE_ROOT);
  if (!srcExists) {
    throw new Error(`SOURCE_ROOT does not exist: ${SOURCE_ROOT}`);
  }

  const srcStat = await fs.stat(SOURCE_ROOT);
  if (!srcStat.isDirectory()) {
    throw new Error(`SOURCE_ROOT is not a directory: ${SOURCE_ROOT}`);
  }

  await ensureDir(DEST_ROOT);

  console.log(`SOURCE_ROOT: ${SOURCE_ROOT}`);
  console.log(`DEST_ROOT:   ${DEST_ROOT}`);
  console.log('Starting recursive copy...\n');

  await processDirectory(SOURCE_ROOT, DEST_ROOT);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nERROR:');
  console.error(err);
  process.exit(1);
});