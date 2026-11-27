/**
 * Whether the queue needs to spell out a photo's working filename: when it
 * differs from the library filename, or contains "_edited" (a photo that is itself
 * an edit, exported under its own name), where what to call the next edit isn't
 * obvious.
 */
export function shouldShowWorkingFilename(filename: string, workingFilename: string): boolean {
  return workingFilename !== filename || workingFilename.toLowerCase().includes('_edited');
}
