export interface TedographyUser {
  id: string;
  name: string;
  roleId: string;   // 'admin' | 'full' | 'limited' (extensible)
  createdAt: string; // ISO-8601
}

/** What the frontend sends to POST /api/auth/login */
export interface LoginRequest {
  userId: string;
  pin: string;
}

/** What POST /api/auth/login returns on success */
export interface LoginResponse {
  user: TedographyUser;
}

/** What GET /api/auth/me returns */
export interface MeResponse {
  user: TedographyUser;
}

/** What GET /api/auth/users returns (no pinHash exposed) */
export interface UserListResponse {
  users: TedographyUser[];
}

/** What POST /api/auth/users accepts */
export interface CreateUserRequest {
  name: string;
  roleId: string;
  pin: string;
}

/** What GET /api/auth/roles returns — full role objects including permissions */
export interface RoleListResponse {
  roles: import('./RbacTypes.js').TedographyRole[];
}

/** What POST /api/auth/roles accepts */
export interface CreateRoleRequest {
  id: string;
  displayName: string;
  permissions: import('./RbacTypes.js').PermissionMap;
}
