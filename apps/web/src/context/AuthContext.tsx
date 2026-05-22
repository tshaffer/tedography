import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { TedographyUser, UserListResponse } from '@tedography/domain';
import { getMe, getUsers, login as apiLogin, logout as apiLogout } from '../api/authApi';

interface AuthContextValue {
  /** The currently logged-in user, or null if not authenticated */
  user: TedographyUser | null;
  /** True while the initial session check is in progress */
  loading: boolean;
  /** All users (for login picker) — populated after first fetch */
  users: TedographyUser[];
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<TedographyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TedographyUser[]>([]);

  // Check for an existing session on mount
  useEffect(() => {
    getMe()
      .then(({ user: u }) => {
        setUser(u);
        // Also pre-load the user list so the login screen shows names
        return getUsers();
      })
      .then(({ users: all }) => setUsers(all))
      .catch(() => {
        // 401 = not authenticated; ignore
        setUser(null);
        // Still try to load users for the login picker (public endpoint)
        loadUsers();
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
    // Load user list now that we're authenticated
    const { users: all } = await getUsers();
    setUsers(all);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, users, login, logout }}>
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
