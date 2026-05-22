import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  MyPermissionsResponse,
  UserListResponse,
} from '@tedography/domain';

type ApiErrorPayload = { error?: string };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: 'include', ...init });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function login(userId: string, pin: string): Promise<LoginResponse> {
  const body: LoginRequest = { userId, pin };
  return fetchJson<LoginResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function logout(): Promise<void> {
  await fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<MeResponse> {
  return fetchJson<MeResponse>('/api/auth/me');
}

export async function getUsers(): Promise<UserListResponse> {
  return fetchJson<UserListResponse>('/api/auth/users');
}

/** Fetches user names + IDs without requiring a session — for the login screen */
export async function getPublicUsers(): Promise<UserListResponse> {
  return fetchJson<UserListResponse>('/api/auth/users/public');
}

export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  return fetchJson<MyPermissionsResponse>('/api/auth/my-permissions');
}
