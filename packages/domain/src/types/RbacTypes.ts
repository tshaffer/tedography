// ---------------------------------------------------------------------------
// Feature registry — the canonical list of things that can be permission-gated.
// Add new entries here when new controllable features are introduced.
// ---------------------------------------------------------------------------

export const FEATURE_IDS = [
  'import',
  'rotate-and-crop',
  'set-photo-state',
  'create-albums',
  'move-photos-to-album',
  'remove-from-album',
  'keyword-management',
  'people-face-review',
  'print',
  'maintenance',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

/** Human-readable labels for each feature (used in admin UI) */
export const FEATURE_LABELS: Record<FeatureId, string> = {
  'import':              'Import photos',
  'rotate-and-crop':     'Rotate and crop photos',
  'set-photo-state':     'Set photo state (Keep / Discard / Pending)',
  'create-albums':       'Create albums',
  'move-photos-to-album':'Move selected photos to an album',
  'remove-from-album':   'Remove photos from album',
  'keyword-management':  'Keyword management',
  'people-face-review':  'People face review',
  'print':               'Print',
  'maintenance':         'Maintenance tools',
};

// ---------------------------------------------------------------------------
// Permission values
// ---------------------------------------------------------------------------

/** allow = always permitted; deny = always blocked; per-album = allowed only on albums where the user has explicit write access */
export type PermissionValue = 'allow' | 'deny' | 'per-album';

/** Full permission map for a role — every feature must have an entry */
export type PermissionMap = Record<FeatureId, PermissionValue>;

// ---------------------------------------------------------------------------
// Role entity
// ---------------------------------------------------------------------------

export interface TedographyRole {
  id: string;                // e.g. 'admin', 'full', 'limited'
  displayName: string;
  permissions: PermissionMap;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Returned by GET /api/auth/my-permissions */
export interface MyPermissionsResponse {
  roleId: string;
  permissions: PermissionMap;
}
