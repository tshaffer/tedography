import { Router, type IRouter } from 'express';
import type { CreateRoleRequest, CreateUserRequest, LoginRequest, LoginResponse, MeResponse, MyPermissionsResponse, RoleListResponse, UserListResponse } from '@tedography/domain';
import { FEATURE_IDS } from '@tedography/domain';
import { hashPin, verifyPin } from '../auth/authService.js';
import { createUser, deleteUser, listUsers, updateUserPin, updateUserRole } from '../repositories/userRepository.js';
import { countUsersWithRole } from '../repositories/userRepository.js';
import { deleteRole, findRoleById, listRoles, upsertRole } from '../repositories/roleRepository.js';
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

/** GET /api/auth/users/public — list user names + IDs, no auth required (for login screen) */
authRoutes.get('/users/public', async (_req, res) => {
  const users = await listUsers();
  const response: UserListResponse = { users };
  res.json(response);
});

/** GET /api/auth/my-permissions — returns the resolved permission map for the current user */
authRoutes.get('/my-permissions', requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const role = await findRoleById(user.roleId);
  if (!role) {
    res.status(500).json({ error: `Role "${user.roleId}" not found — run pnpm roles:seed` });
    return;
  }
  const response: MyPermissionsResponse = { roleId: role.id, permissions: role.permissions };
  res.json(response);
});

/** GET /api/auth/users — list all users (names only, no PIN hashes) — requires auth */
authRoutes.get('/users', requireAuth, async (_req, res) => {
  const users = await listUsers();
  const response: UserListResponse = { users };
  res.json(response);
});

/** PATCH /api/auth/pin — change the current user's PIN */
authRoutes.patch('/pin', requireAuth, async (req, res) => {
  const { currentPin, newPin } = req.body as { currentPin?: unknown; newPin?: unknown };

  if (typeof currentPin !== 'string' || currentPin.trim().length === 0) {
    res.status(400).json({ error: 'currentPin is required' });
    return;
  }

  if (typeof newPin !== 'string' || newPin.trim().length < 4) {
    res.status(400).json({ error: 'newPin must be at least 4 characters' });
    return;
  }

  const userId = req.currentUser!.id;

  // Verify the current PIN before allowing the change
  const verified = await verifyPin(userId, currentPin);
  if (!verified) {
    res.status(401).json({ error: 'Current PIN is incorrect' });
    return;
  }

  const pinHash = await hashPin(newPin);
  const updated = await updateUserPin(userId, pinHash);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ ok: true });
});

/** GET /api/auth/roles — list all roles with full permission maps (admin only) */
authRoutes.get('/roles', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const roles = await listRoles();
  const response: RoleListResponse = { roles };
  res.json(response);
});

/** POST /api/auth/roles — create a new role (admin only) */
authRoutes.post('/roles', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const body = req.body as CreateRoleRequest;

  if (typeof body.id !== 'string' || body.id.trim().length === 0) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
    res.status(400).json({ error: 'displayName is required' });
    return;
  }

  if (!body.permissions || typeof body.permissions !== 'object') {
    res.status(400).json({ error: 'permissions map is required' });
    return;
  }

  const missingFeatures = FEATURE_IDS.filter((f) => !['allow', 'deny', 'per-album'].includes(body.permissions[f]));
  if (missingFeatures.length > 0) {
    res.status(400).json({ error: `Missing or invalid permission values for: ${missingFeatures.join(', ')}` });
    return;
  }

  const existing = await findRoleById(body.id.trim());
  if (existing) {
    res.status(409).json({ error: `Role "${body.id}" already exists` });
    return;
  }

  const role = await upsertRole({ id: body.id.trim(), displayName: body.displayName.trim(), permissions: body.permissions });
  res.status(201).json(role);
});

/** PATCH /api/auth/roles/:id — update a role's displayName and/or permissions (admin only) */
authRoutes.patch('/roles/:id', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const roleId = req.params.id as string;
  const existing = await findRoleById(roleId);
  if (!existing) {
    res.status(404).json({ error: `Role "${roleId}" not found` });
    return;
  }

  const body = req.body as Partial<CreateRoleRequest>;

  const displayName = typeof body.displayName === 'string' && body.displayName.trim().length > 0
    ? body.displayName.trim()
    : existing.displayName;

  let permissions = existing.permissions;
  if (body.permissions) {
    const missingFeatures = FEATURE_IDS.filter((f) => !['allow', 'deny', 'per-album'].includes(body.permissions![f]));
    if (missingFeatures.length > 0) {
      res.status(400).json({ error: `Missing or invalid permission values for: ${missingFeatures.join(', ')}` });
      return;
    }
    permissions = body.permissions;
  }

  const updated = await upsertRole({ id: roleId, displayName, permissions });
  res.json(updated);
});

/** DELETE /api/auth/roles/:id — delete a role (admin only; 'admin' role and roles with assigned users are protected) */
authRoutes.delete('/roles/:id', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const roleId = req.params.id as string;

  if (roleId === 'admin') {
    res.status(400).json({ error: 'The admin role cannot be deleted' });
    return;
  }

  const count = await countUsersWithRole(roleId);
  if (count > 0) {
    res.status(400).json({ error: `Cannot delete role "${roleId}" — ${count} user(s) are still assigned to it` });
    return;
  }

  const deleted = await deleteRole(roleId);
  if (!deleted) {
    res.status(404).json({ error: `Role "${roleId}" not found` });
    return;
  }

  res.json({ ok: true });
});

/** PATCH /api/auth/users/:id/role — change a user's role (admin only) */
authRoutes.patch('/users/:id/role', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const targetId = req.params.id as string;
  if (targetId === req.currentUser!.id) {
    res.status(400).json({ error: 'You cannot change your own role' });
    return;
  }

  const { roleId } = req.body as { roleId?: unknown };
  if (typeof roleId !== 'string' || roleId.trim().length === 0) {
    res.status(400).json({ error: 'roleId is required' });
    return;
  }

  const role = await findRoleById(roleId);
  if (!role) {
    res.status(400).json({ error: `Unknown role: ${roleId}` });
    return;
  }

  const updated = await updateUserRole(targetId, roleId);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(updated);
});

/** POST /api/auth/users — create a new user (admin only) */
authRoutes.post('/users', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const body = req.body as CreateUserRequest;

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (typeof body.roleId !== 'string' || body.roleId.trim().length === 0) {
    res.status(400).json({ error: 'roleId is required' });
    return;
  }

  if (typeof body.pin !== 'string' || body.pin.trim().length < 4) {
    res.status(400).json({ error: 'pin must be at least 4 characters' });
    return;
  }

  const role = await findRoleById(body.roleId);
  if (!role) {
    res.status(400).json({ error: `Unknown role: ${body.roleId}` });
    return;
  }

  const pinHash = await hashPin(body.pin);
  const user = await createUser({ name: body.name.trim(), roleId: body.roleId, pinHash });
  res.status(201).json(user);
});

/** DELETE /api/auth/users/:id — delete a user (admin only, cannot delete self) */
authRoutes.delete('/users/:id', requireAuth, async (req, res) => {
  if (req.currentUser!.roleId !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const targetId = req.params.id as string;
  if (targetId === req.currentUser!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const deleted = await deleteUser(targetId);
  if (!deleted) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ ok: true });
});
