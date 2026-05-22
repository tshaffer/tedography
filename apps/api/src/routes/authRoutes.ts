import { Router, type IRouter } from 'express';
import type { LoginRequest, LoginResponse, MeResponse, UserListResponse } from '@tedography/domain';
import { verifyPin } from '../auth/authService.js';
import { listUsers } from '../repositories/userRepository.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes: IRouter = Router();

/** POST /api/auth/login — exchange userId + PIN for a session */
authRoutes.post('/login', async (req, res) => {
  const { userId, pin } = req.body as LoginRequest;

  if (!userId || typeof userId !== 'string' || !pin || typeof pin !== 'string') {
    res.status(400).json({ error: 'userId and pin are required' });
    return;
  }

  const user = await verifyPin(userId, pin);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  req.session.user = user;
  const response: LoginResponse = { user };
  res.json(response);
});

/** POST /api/auth/logout — destroy the current session */
authRoutes.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ ok: true });
  });
});

/** GET /api/auth/me — return the currently logged-in user, or 401 */
authRoutes.get('/me', requireAuth, (req, res) => {
  const response: MeResponse = { user: req.currentUser! };
  res.json(response);
});

/** GET /api/auth/users — list all users (names only, no PIN hashes) — requires auth */
authRoutes.get('/users', requireAuth, async (_req, res) => {
  const users = await listUsers();
  const response: UserListResponse = { users };
  res.json(response);
});
