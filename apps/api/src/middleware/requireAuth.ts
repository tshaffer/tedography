import type { Request, Response, NextFunction } from 'express';
import type { TedographyUser } from '@tedography/domain';

/** Augment express-session data to include the logged-in user */
declare module 'express-session' {
  interface SessionData {
    user?: TedographyUser;
  }
}

/** Attach req.currentUser for convenience in route handlers */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: TedographyUser;
    }
  }
}

/**
 * Middleware that rejects unauthenticated requests with 401.
 * Mount after session middleware so req.session is available.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  req.currentUser = user;
  next();
}
