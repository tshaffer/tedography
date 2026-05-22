import { findByIds } from '../repositories/assetRepository.js';
import { findAlbumNodesByIds } from '../repositories/albumTreeRepository.js';

/**
 * Check whether a user has write access to at least one album containing
 * ANY of the given assets.
 *
 * Rules:
 *  - If assetIds is empty → allow (nothing to check)
 *  - If all assets belong to no album → allow (unorganized assets are open)
 *  - If the user's ID appears in writerUserIds of ANY album that contains
 *    ANY of the assets → allow
 *  - Otherwise → deny
 */
export async function userHasAlbumWriteAccess(
  userId: string,
  assetIds: string[]
): Promise<boolean> {
  if (assetIds.length === 0) return true;

  // Load assets to get their albumIds
  const assets = await findByIds(assetIds);
  if (assets.length === 0) return true; // assets not found — let the route handler 404

  const allAlbumIds = [...new Set(assets.flatMap((a) => a.albumIds ?? []))];
  if (allAlbumIds.length === 0) return true; // unorganized assets — open access

  // Load the albums and check writerUserIds
  const albums = await findAlbumNodesByIds(allAlbumIds);
  return albums.some((album) => (album.writerUserIds ?? []).includes(userId));
}
