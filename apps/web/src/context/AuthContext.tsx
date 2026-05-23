import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { FeatureId, PermissionMap, TedographyUser, UserListResponse } from '@tedography/domain';
import { getMe, getMyPermissions, getUsers, login as apiLogin, logout as apiLogout } from '../api/authApi';

interface AuthContextValue {
  /** The currently logged-in user, or null if not authenticated */
  user: TedographyUser | null;
  /** True while the initial session check is in progress */
  loading: boolean;
  /** All users (for login picker) — populated after first fetch */
  users: TedographyUser[];
  /** Resolved permission map for the current user — null until loaded */
  permissions: PermissionMap | null;
  /**
   * Returns true if the current user is allowed to use a feature.
   * For per-album features this is optimistic (returns true if not explicitly denied).
   * Use canInAlbum() when an album context is known.
   */
  can: (feature: FeatureId) => boolean;
  /**
   * Like can(), but resolves per-album features against a specific album's writerUserIds.
   * Pass the album's writerUserIds when you know which album the action targets.
   * If writerUserIds is undefined, falls back to optimistic (same as can()).
   */
  canInAlbum: (feature: FeatureId, writerUserIds?: string[]) => boolean;
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<TedographyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TedographyUser[]>([]);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);

  // Check for an existing session on mount
  useEffect(() => {
    getMe()
      .then(({ user: u }) => {
        setUser(u);
        return Promise.all([getUsers(), getMyPermissions()]);
      })
      .then(([{ users: all }, { permissions: perms }]) => {
        setUsers(all);
        setPermissions(perms);
      })
      .catch(() => {
        // 401 = not authenticated; ignore
        setUser(null);
        setPermissions(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function loadUsers(): void {
    // getUsers requires auth; if not authed, the login screen will handle loading users
    // by calling getUsers after a successful login. No-op here.
  }

  const login = useCallback(async (userId: string, pin: string) => {
    const { user: u } = await apiLogin(userId, pin);
    setUser(u);
    // Load user list and permissions now that we're authenticated
    const [{ users: all }, { permissions: perms }] = await Promise.all([getUsers(), getMyPermissions()]);
    setUsers(all);
    setPermissions(perms);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setPermissions(null);
  }, []);

  const can = useCallback((feature: FeatureId): boolean => {
    if (!permissions) return false;
    // 'per-album' treated as optimistically allowed; use canInAlbum() when album context is known.
    return permissions[feature] !== 'deny';
  }, [permissions]);

  const canInAlbum = useCallback((feature: FeatureId, writerUserIds?: string[]): boolean => {
    if (!permissions) return false;
    const perm = permissions[feature];
    if (perm === 'deny') return false;
    if (perm === 'allow') return true;
    // per-album: check writerUserIds when available
    if (writerUserIds !== undefined) {
      return user !== null && writerUserIds.includes(user.id);
    }
    // No album context — optimistic
    return true;
  }, [permissions, user]);

  return (
    <AuthContext.Provider value={{ user, loading, users, permissions, can, canInAlbum, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
