import type { Kdf } from '../crypto';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: any) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'X-OpenPass': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'You are offline');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message || `HTTP ${res.status}`;
    throw new ApiError(res.status, data.code || (res.status === 429 ? 'RATE_LIMITED' : 'ERROR'), msg, data);
  }
  return data as T;
}

export interface Profile {
  id: string; email: string; name: string; kdf: Kdf; protectedUserKey: string; publicKey: string;
  protectedPrivateKey: string; twoFactor: boolean; createdAt: string;
}
export interface RawItem { id: string; teamId: string | null; folderId: string | null; data: string; revision: number; deletedAt: string | null; createdAt: string; updatedAt: string }
export interface RawFolder { id: string; data: string; createdAt: string; updatedAt: string }
export interface RawTeam { id: string; data: string; role: Role; protectedTeamKey: string; createdAt: string; updatedAt: string }
export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export interface SyncResponse { profile: Profile; folders: RawFolder[]; teams: RawTeam[]; items: RawItem[]; serverTime: string }
export interface Member { id: string; name: string; email: string; publicKey: string; role: Role; joinedAt: string }
export interface SessionInfo { id: string; userAgent: string; createdAt: string; lastSeenAt: string; current: boolean }

export const api = {
  config: () => call<{ signupsAllowed: boolean; version: string }>('GET', '/config'),
  prelogin: (email: string) => call<{ kdf: Kdf }>('POST', '/auth/prelogin', { email }),
  register: (b: object) => call<Profile>('POST', '/auth/register', b),
  login: (email: string, authKey: string, totp?: string) => call<Profile>('POST', '/auth/login', { email, authKey, totp }),
  logout: () => call<void>('POST', '/auth/logout'),
  me: () => call<Profile>('GET', '/me'),
  session: () => call<{ authenticated: boolean; profile?: Profile }>('GET', '/session'),
  rename: (name: string) => call<Profile>('PATCH', '/me', { name }),
  changePassword: (b: object) => call<Profile>('POST', '/me/password', b),
  totpSetup: () => call<{ secret: string; otpauthUrl: string }>('POST', '/me/2fa/setup'),
  totpEnable: (code: string) => call<Profile>('POST', '/me/2fa/enable', { code }),
  totpDisable: (authKey: string, code: string) => call<Profile>('POST', '/me/2fa/disable', { authKey, code }),
  sessions: () => call<SessionInfo[]>('GET', '/me/sessions'),
  revokeSession: (id: string) => call<void>('DELETE', `/me/sessions/${id}`),
  revokeOthers: () => call<void>('POST', '/me/sessions/revoke-others'),
  deleteAccount: (authKey: string) => call<void>('DELETE', '/me', { authKey }),
  sync: () => call<SyncResponse>('GET', '/sync'),
  createItem: (b: { id: string; data: string; folderId?: string | null; teamId?: string | null }) => call<RawItem>('POST', '/items', b),
  importItems: (items: object[]) => call<{ imported: number }>('POST', '/items/import', { items }),
  updateItem: (id: string, b: { data: string; folderId?: string | null; revision: number }) => call<RawItem>('PUT', `/items/${id}`, b),
  trashItem: (id: string) => call<RawItem>('DELETE', `/items/${id}`),
  restoreItem: (id: string) => call<RawItem>('POST', `/items/${id}/restore`),
  purgeItem: (id: string) => call<void>('DELETE', `/items/${id}/permanent`),
  createFolder: (id: string, data: string) => call<RawFolder>('POST', '/folders', { id, data }),
  renameFolder: (id: string, data: string) => call<RawFolder>('PUT', `/folders/${id}`, { data }),
  deleteFolder: (id: string) => call<void>('DELETE', `/folders/${id}`),
  lookupUser: (email: string) => call<{ id: string; name: string; email: string; publicKey: string }>('GET', `/users/lookup?email=${encodeURIComponent(email)}`),
  createTeam: (b: { id: string; data: string; protectedTeamKey: string }) => call<RawTeam>('POST', '/teams', b),
  renameTeam: (id: string, data: string) => call<void>('PUT', `/teams/${id}`, { data }),
  deleteTeam: (id: string) => call<void>('DELETE', `/teams/${id}`),
  members: (id: string) => call<Member[]>('GET', `/teams/${id}/members`),
  addMember: (id: string, b: { userId: string; role: Role; protectedTeamKey: string }) => call<void>('POST', `/teams/${id}/members`, b),
  setRole: (id: string, userId: string, role: Role) => call<void>('PATCH', `/teams/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => call<void>('DELETE', `/teams/${id}/members/${userId}`),
};
