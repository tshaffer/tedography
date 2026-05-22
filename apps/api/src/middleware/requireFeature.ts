import type { Request, RequestHandler } from 'express';
import type { FeatureId } from '@tedography/domain';
import { findRoleById } from '../repositories/roleRepository.js';
import { userHasAlbumWriteAccess } from '../auth/albumWriteAccess.js';

/**
 * Synchronous or async function that extracts asset IDs from a request.
 * Used for per-album permission checks.
 */
export type AssetIdsExtractor = (req: Request) => string[] | Promise<string[]>;

/**
 * Middleware factory that enforces feature-level permissions.
 *
 * Permission values:
 *  'allow'     → pass through unconditionally
 *  'deny'      → 403 Forbidden
 *  'per-album' → allowed only if the user has write access to at least one
 *                album containing the target assets (resolved via extractor)
 *
 * For 'per-album' features, pass an `extractAssetIds` function that pulls
 * the relevant asset IDs from the request. If omitted for a per-album feature,
 * access is allowed (opt-in restriction).
 *
 * Must be used after requireAuth so req.currentUser is populated.
 */
export function requireFeature(featureId: FeatureId, extractAssetIds?: AssetIdsExtractor): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const role = await findRoleById(user.roleId);
    if (!role) {
      res.status(500).json({ error: `Role "${user.roleId}" not found` });
      return;
    }

    const permission = role.permissions[featureId];

    if (permission === 'deny') {
      res.status(403).json({ error: `Your role does not have access to: ${featureId}` });
      return;
    }

    if (permission === 'per-album' && extractAssetIds) {
      const assetIds = await extractAssetIds(req);
      const allowed = await userHasAlbumWriteAccess(user.id, assetIds);
      if (!allowed) {
        res.status(403).json({ error: `You do not have write access to the album(s) containing these assets` });
        return;
      }
    }

    next();
  };
}
