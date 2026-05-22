Here's how I'd sequence it, organized into phases where each builds on the previous:

---

**Phase 1 — Authentication foundation**
*Nothing else works without this.*
- `users` MongoDB collection + PIN hashing (bcrypt)
- Session middleware (express-session)
- Auth endpoints: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- Auth middleware attaches current user to every request
- Bootstrap script to create the first admin user (chicken-and-egg problem — can't use the UI to create the first user)
- Frontend: PIN entry login screen, session persistence

**Phase 2 — Role and permission model**
*Defines what permissions mean before enforcing them.*
- `roles` MongoDB collection with embedded permission map
- Seed default roles (admin / full / limited) from our feature table
- `hasFeaturePermission(user, feature)` helper
- Role management API (CRUD)

**Phase 3 — Feature-level guards (backend)**
*The ❌ features — hard blocks regardless of album.*
- Apply role checks to every mutating endpoint
- Mechanical but important — every route file gets guards
- Returns 403 for blocked features

**Phase 4 — Album-level grants**
*The 🔓 features — role + per-album checks.*
- `writerUserIds: string[]` added to AlbumTreeNode schema
- `canWriteAlbum(user, albumId)` and `canWriteAsset(user, asset)` helpers
- Auto-grant write access when limited user creates an album
- Special case for Move: requires write access to both source and destination
- Update all 🔓 endpoints to use album grant checks

**Phase 5 — Frontend enforcement**
*Hide/disable controls based on the current user's permissions.*
- User context provider wrapping the app
- Each toolbar button, menu item, and action checks permissions before rendering
- This is the most spread-out frontend work given how large App.tsx is

**Phase 6 — Admin UI**
*The management interfaces.*
- User management screen: add/edit/remove users, assign roles, set PINs
- Role management screen: create/delete roles, permission matrix editor
- Album write access: assign/revoke per-user write grants per album

---

**A few observations before starting:**

- **Phase 1 is the riskiest** — session management and PIN security need to be solid even for a home network app
- **Phase 5 is the most time-consuming** — write controls are scattered throughout App.tsx; it will need a clean `usePermissions()` hook to avoid repeating logic everywhere
- **Phases 1–3 can ship and be useful** before Phase 4 is done — you'd have authentication and hard role blocks, just not per-album nuance yet
- **The bootstrapping problem** in Phase 1 needs a decision: a CLI seed script is the simplest approach

Does this sequencing make sense, or do you want to adjust priorities before we start coding?