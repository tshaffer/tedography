import fs from 'node:fs/promises';

export class DestinationExistsError extends Error {
  constructor(destPath: string) {
    super(`A file already exists at the destination, so the edited file was not imported: ${destPath}`);
  }
}

export interface PlacementResult<T> {
  value: T;
  // False when the library record was created but the file in the return folder
  // could not be deleted afterwards; it is then left for the user to remove.
  returnFileRemoved: boolean;
}

/**
 * Brings a finished edit into permanent storage without any window in which a
 * failure can lose or strand it:
 *
 *   1. copy the return file to its destination, refusing to overwrite anything;
 *   2. run `createRecords` (database writes);
 *   3. only then delete the return file.
 *
 * If `createRecords` throws, the destination copy is removed and the return file
 * is left exactly where it was, ready for a retry.
 */
export async function placeEditedFile<T>(
  returnFilePath: string,
  destPath: string,
  createRecords: () => Promise<T>
): Promise<PlacementResult<T>> {
  try {
    await fs.copyFile(returnFilePath, destPath, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new DestinationExistsError(destPath);
    }
    throw err;
  }

  let value: T;
  try {
    value = await createRecords();
  } catch (err) {
    await fs.unlink(destPath).catch(() => undefined);
    throw err;
  }

  const returnFileRemoved = await fs.unlink(returnFilePath).then(
    () => true,
    () => false
  );
  return { value, returnFileRemoved };
}
