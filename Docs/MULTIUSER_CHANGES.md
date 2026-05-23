# Tedography — Multi-User Support: User-Visible Changes

This document describes the user-visible changes introduced by the multi-user
RBAC implementation (commits starting from `10cbaf6`). Changes are grouped by
the audience that sees them.

---

## Feature Permission Reference

Every action in Tedography is tied to a **feature**. Each role is granted one of
three permission values for each feature:

| Permission | Meaning |
|---|---|
| **allow** | Role can always use this feature |
| **deny** | Role can never use this feature |
| **per-album** | Role can use this feature only in albums where they have been explicitly granted write access |

### Role permission table

| Feature | Admin | Full | Limited |
|---|---|---|---|
| `import` | allow | allow | **deny** |
| `rotate-and-crop` | allow | allow | per-album |
| `set-photo-state` | allow | allow | per-album |
| `create-albums` | allow | allow | allow |
| `move-photos-to-album` | allow | allow | per-album |
| `remove-from-album` | allow | allow | per-album |
| `keyword-management` | allow | allow | **deny** |
| `people-face-review` | allow | allow | per-album |
| `print` | allow | allow | per-album |
| `maintenance` | allow | **deny** | **deny** |

---

## Changes visible to all users

These changes apply regardless of role.

### Login screen

- A login screen is shown before the application loads. Users select their name
  from a list and enter their PIN to start a session.
- The application remains blank while the existing session is verified on startup,
  then either shows the login screen or the library directly.

### Toolbar — user identity

- The logged-in user's **name** is displayed in the top-right corner of the toolbar.
- A **Log out** button ends the session and returns to the login screen.
- A **Change PIN** button opens a dialog to update your own PIN. You must supply
  your current PIN before a new one is accepted. The new PIN must be at least
  4 characters.

### Per-album access reflected in the UI

- Toolbar action buttons (Set State, Move to Album, Remove from Album, Rotate,
  Print) are **disabled** when the current album context does not grant write
  access, and re-enable when you navigate to an album where you have access.
- The **Set Capture Date** button in the inspector is similarly gated.
- **Keyboard shortcuts** (`s`, `p`, `r`, `u`, `Delete`/`Backspace`) for setting
  photo state are silently ignored when you lack write access to the current album.
- The **Survey mode** state buttons are disabled and visually dimmed when you
  lack write access.

---

## Changes visible to users in the Limited role

### What is hidden entirely

Because these features are permanently unavailable to the Limited role, their
toolbar controls are hidden rather than shown as disabled:

- **Import** button (cloud-download icon)
- **Publish to Google Photos** button
- **Keyword Management** button (tag icon)

### Album tree — lock icon

- Albums for which you have **no write access** show a small **lock icon (🔒)**
  next to the album name. Albums where you are listed as a writer show no icon.
  Admin and Full users always have full access and never see the lock icon.

### Per-album gating

- Controls for `set-photo-state`, `move-photos-to-album`, `remove-from-album`,
  `rotate-and-crop`, `print`, and `people-face-review` are enabled only when
  you are viewing an album you have been granted write access to. In the general
  library view (no album selected), they are disabled.
- Inspector actions (Reimport, Rebuild Derived Files) are hidden because
  `maintenance` is denied.
- The Keyword Management panel in the inspector shows no add/remove controls
  because `keyword-management` is denied.

---

## Changes visible to users in the Full role

### Maintenance tools hidden

- The **Maintenance** item in the overflow (⋯) menu is hidden for the Full role.
  (`maintenance` is denied for Full.)
- **Reimport** and **Rebuild Derived Files** buttons in the asset inspector are
  hidden.
- The **Crop photo in Preview** action is restricted to Admin only at the API level.

### All other features enabled

- Full users have `allow` for all other features and are not subject to per-album
  restrictions. All toolbar controls behave the same as for Admin, except for
  Maintenance.

---

## Changes visible to the Admin user

### Album writers management

- Right-clicking any **Album node** in the album tree reveals a **Manage
  Writers…** context menu item.
- The **Manage Writers** dialog lists:
  - **Full access** — Admin and Full users, who always have write access by virtue
    of their role (shown as "always", not removable here).
  - **Explicit writers (Limited)** — Limited users who have been granted per-album
    write access. A **×** button removes them.
  - A **dropdown + Add button** to grant access to additional Limited users who
    are not yet writers for the album.

### Users page

- A **Users** link appears in the overflow (⋯) Tools section for Admin users only.
- Navigating to `/admin/users` opens the **Users** management page with three
  capabilities:

  **View all users**
  A table showing every user's name, role badge, and user ID.

  **Change a user's role**
  Each non-self row shows an inline role dropdown. Selecting a different role
  reveals a **Save** button. The change takes effect immediately after saving.
  An admin cannot change their own role.

  **Create a user**
  A form at the bottom of the page accepts a display name, role, and initial PIN
  (minimum 4 characters). Submitting creates the account immediately.

  **Delete a user**
  Each non-self row has a **×** button. Clicking it shows an inline
  **Delete / Cancel** confirmation before the account is permanently removed.
  An admin cannot delete their own account.

### Maintenance tools

- Admin is the only role with access to the **Maintenance** dialog, **Reimport**,
  **Rebuild Derived Files**, **Crop photo in Preview**, and the AI queue processing
  and export operations.
