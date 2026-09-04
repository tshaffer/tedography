import type { HelpTopic } from '../types.js';

export const usersAndPermissions: HelpTopic = {
  slug: 'users-and-permissions',
  title: 'Users and Permissions',
  category: 'Admin',
  order: 2,
  keywords: ['login', 'pin', 'role', 'admin', 'permissions', 'roles', 'users'],
  body: `Tedography supports multiple users with role-based access control. Every feature has a permission per role: **allow** (always usable), **deny** (never usable), or **per-album** (usable only in albums where the user has been granted write access).

**Built-in roles:**

| Feature | Admin | Full | Limited |
|---|---|---|---|
| Import | allow | allow | deny |
| Rotate and crop | allow | allow | per-album |
| Set photo state | allow | allow | per-album |
| Create albums | allow | allow | allow |
| Move / remove from album | allow | allow | per-album |
| Keyword management | allow | allow | deny |
| People face review | allow | allow | per-album |
| Print | allow | allow | per-album |
| Maintenance | allow | deny | deny |

Custom roles can combine permissions any way you like.

**Logging in:** select your name on the login screen and enter your PIN. Once in, your name appears top-right; **Log out** ends the session; **Change PIN** requires your current PIN (new PIN must be at least 4 characters).

**Limited** users see locked albums (🔒) where they lack write access — state changes, moving/removing, rotating, printing, and people review are enabled only where they've been granted access; Import, keyword management, and maintenance are hidden entirely. **Full** users get everything except Maintenance. **Admin** users get everything, including user and role management.

**Admin tools:** right-click an album → **Manage Writers…** to grant/revoke Limited-user write access on that album. The **Users** page (\`/admin/users\`) lists users and lets you change roles, create users, or delete them (not your own account). The **Roles** page (\`/admin/roles\`, via Manage Roles → on the Users page) shows every role's full permission grid, editable inline; built-in roles can be edited but not deleted, custom roles can be deleted once unassigned.`,
};
