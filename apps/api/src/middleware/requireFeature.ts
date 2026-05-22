import type { RequestHandler } from 'express';
import type { FeatureId } from '@tedography/domain';
import { findRoleById } from '../repositories/roleRepository.js';

/**
 * Middleware factory that blocks requests when the current user's role has
 * 'deny' for the given feature.
 *
 * 'allow'     → pass through
 * 'per-album' → pass through (album-level check is Phase 4)
 * 'deny'      → 403 Forbidden
 *
 * Must be used after requireAuth so req.currentUser is populated.
 */
export function requireFeature(featureId: FeatureId): RequestHandler {
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

    next();
  };
}
