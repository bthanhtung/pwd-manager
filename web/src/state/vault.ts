import { create } from 'zustand';
import {
  createAccountKeys, decrypt, decryptJson, DecryptError, deriveKeys, encryptJson, importPrivateKey, open, randomBytes,
  rewrapUserKey, seal, uuid,
} from '../crypto';
import { api, ApiError, Member, Profile, RawItem, Role, SyncResponse } from '../lib/api';
import type { Folder, Item, ItemData, Team } from '../lib/types';

export type Status = 'boot' | 'out' | 'locked' | 'unlocked';

/**
 * Key material lives in this closure, outside React state, and is wiped on lock.
 * Nothing here is ever written to storage.
 */
let K: { userKey: Uint8Array; privateKey: CryptoKey; teamKeys: Map<string, Uint8Array> } | null = null;

const CACHE = 'op_cache';          // last sync response (ciphertext only) so the vault can open offline
const saveCache = (s: SyncResponse) => { try { localStorage.setItem(CACHE, JSON.stringify(s)); } catch { /* quota */ } };
const readCache = (): SyncResponse | null => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch { return null; } };

interface VaultState {
  status: Status;
  profile: Profile | null;
  items: Item[];
  folders: Folder[];
  teams: Team[];
  offline: boolean;
  syncing: boolean;
  undecryptable: number;
  lastSync: string | null;

  boot(): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  login(email: string, password: string, totp?: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): void;
  logout(): Promise<void>;
  sync(): Promise<void>;

  saveItem(data: ItemData, opts: { id?: string; folderId: string | null; teamId: string | null }): Promise<Item>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  importItems(list: ItemData[], target: { folderId: string | null; teamId: string | null }): Promise<number>;

  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;

  createTeam(name: string): Promise<Team>;
  renameTeam(id: string, name: string): Promise<void>;
  deleteTeam(id: string): Promise<void>;
  leaveTeam(id: string): Promise<void>;
  members(id: string): Promise<Member[]>;
  invite(teamId: string, email: string, role: Role): Promise<void>;
  setRole(teamId: string, userId: string, role: Role): Promise<void>;
  removeMember(teamId: string, userId: string): Promise<void>;

  changePassword(current: string, next: string): Promise<void>;
  verifyPassword(password: string): Promise<string>;
  setProfile(p: Profile): void;
  deleteAccount(password: string): Promise<void>;
}

function keyFor(teamId: string | null): Uint8Array {
  if (!K) throw new Error('Vault is locked');
  if (!teamId) return K.userKey;
  const k = K.teamKeys.get(teamId);
  if (!k) throw new Error('Missing team key');
  return k;
}

async function decryptItem(r: RawItem): Promise<Item> {
  const data = await decryptJson<ItemData>(keyFor(r.teamId), r.data, r.id);
  return { ...data, id: r.id, teamId: r.teamId, folderId: r.folderId, revision: r.revision, deletedAt: r.deletedAt, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

const strip = (i: Item | ItemData): ItemData => {
  const { type, name, favorite, notes, fields, login, card, identity, passwordHistory } = i;
  return { type, name, favorite, notes, fields, login, card, identity, passwordHistory };
};

export const useVault = create<VaultState>((set, get) => {
  async function decryptAll(s: SyncResponse) {
    if (!K) return;
    const teams: Team[] = [];
    K.teamKeys.clear();
    for (const t of s.teams) {
      try {
        const key = await open(K.privateKey, t.protectedTeamKey);
        K.teamKeys.set(t.id, key);
        const { name } = await decryptJson<{ name: string }>(key, t.data, t.id);
        teams.push({ id: t.id, name, role: t.role, key });
      } catch { /* skip a team we cannot open */ }
    }
    const folders: Folder[] = [];
    for (const f of s.folders) {
      try { folders.push({ id: f.id, ...(await decryptJson<{ name: string }>(K.userKey, f.data, f.id)) }); } catch { /* skip */ }
    }
    const items: Item[] = [];
    let bad = 0;
    for (const r of s.items) {
      try { items.push(await decryptItem(r)); } catch { bad++; }
    }
    teams.sort((a, b) => a.name.localeCompare(b.name));
    folders.sort((a, b) => a.name.localeCompare(b.name));
    set({ teams, folders, items, undecryptable: bad, profile: s.profile, lastSync: s.serverTime });
  }

  async function openKeys(encKey: Uint8Array, profile: Profile) {
    const userKey = await decrypt(encKey, profile.protectedUserKey);
    const priv = await decrypt(userKey, profile.protectedPrivateKey);
    K = { userKey, privateKey: await importPrivateKey(priv), teamKeys: new Map() };
    priv.fill(0);
  }

  const upsert = (item: Item) => set(s => ({ items: [item, ...s.items.filter(i => i.id !== item.id)] }));

  return {
    status: 'boot', profile: null, items: [], folders: [], teams: [], offline: false, syncing: false, undecryptable: 0, lastSync: null,

    async boot() {
      try {
        const s = await api.session();
        if (!s.authenticated || !s.profile) { localStorage.removeItem(CACHE); set({ status: 'out', profile: null }); return; }
        set({ status: 'locked', profile: s.profile, offline: false });
      } catch (e) {
        const cache = readCache();
        if (e instanceof ApiError && e.code === 'OFFLINE' && cache) set({ status: 'locked', profile: cache.profile, offline: true });
        else { localStorage.removeItem(CACHE); set({ status: 'out', profile: null }); }
      }
    },

    async register(name, email, password) {
      const acct = await createAccountKeys(password);
      const profile = await api.register({
        name, email, authKey: acct.authKey, kdf: acct.kdf, protectedUserKey: acct.protectedUserKey,
        publicKey: acct.publicKey, protectedPrivateKey: acct.protectedPrivateKey,
      });
      K = { userKey: acct.userKey, privateKey: await importPrivateKey(acct.privateKey), teamKeys: new Map() };
      set({ profile, status: 'unlocked', items: [], folders: [], teams: [] });
      await get().sync();
    },

    async login(email, password, totp) {
      const { kdf } = await api.prelogin(email);
      const { authKey, encKey } = await deriveKeys(password, kdf);
      const profile = await api.login(email, authKey, totp);
      await openKeys(encKey, profile);
      set({ profile, status: 'unlocked' });
      await get().sync();
    },

    async unlock(password) {
      const profile = get().profile;
      if (!profile) throw new Error('No account');
      const { encKey } = await deriveKeys(password, profile.kdf);
      await openKeys(encKey, profile);       // throws DecryptError on a wrong password — checked locally, no network
      set({ status: 'unlocked' });
      try { await get().sync(); } catch (e) {
        const cache = readCache();
        if (cache) { await decryptAll(cache); set({ offline: true }); } else throw e;
      }
    },

    lock() {
      if (K) { K.userKey.fill(0); K.teamKeys.forEach(k => k.fill(0)); }
      K = null;
      set({ status: get().profile ? 'locked' : 'out', items: [], folders: [], teams: [] });
    },

    async logout() {
      try { await api.logout(); } catch { /* offline: still clear locally */ }
      get().lock();
      localStorage.removeItem(CACHE);
      set({ status: 'out', profile: null });
    },

    async sync() {
      set({ syncing: true });
      try {
        const s = await api.sync();
        saveCache(s);
        await decryptAll(s);
        set({ offline: false });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { get().lock(); localStorage.removeItem(CACHE); set({ status: 'out', profile: null }); }
        if (e instanceof ApiError && e.code === 'OFFLINE') set({ offline: true });
        throw e;
      } finally { set({ syncing: false }); }
    },

    async saveItem(data, { id, folderId, teamId }) {
      const existing = id ? get().items.find(i => i.id === id) : undefined;
      const clean = strip(data);
      if (existing && existing.teamId !== teamId) {
        // Moving between personal and a team means re-encrypting under a different key: copy, then remove the original.
        const moved = await get().saveItem(clean, { folderId: teamId ? null : folderId, teamId });
        await api.purgeItem(existing.id);
        set(s => ({ items: s.items.filter(i => i.id !== existing.id) }));
        return moved;
      }
      if (existing) {
        const raw = await api.updateItem(existing.id, { data: await encryptJson(keyFor(teamId), clean, existing.id), folderId, revision: existing.revision })
          .catch(async e => { if (e instanceof ApiError && e.code === 'STALE') await get().sync(); throw e; });
        const item = { ...clean, id: raw.id, teamId: raw.teamId, folderId: raw.folderId, revision: raw.revision, deletedAt: raw.deletedAt, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
        upsert(item);
        return item;
      }
      const newId = uuid();
      const raw = await api.createItem({ id: newId, data: await encryptJson(keyFor(teamId), clean, newId), folderId: teamId ? null : folderId, teamId });
      const item = { ...clean, id: raw.id, teamId: raw.teamId, folderId: raw.folderId, revision: raw.revision, deletedAt: null, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
      upsert(item);
      return item;
    },

    async trash(id) { upsert(await decryptItem(await api.trashItem(id))); },
    async restore(id) { upsert(await decryptItem(await api.restoreItem(id))); },
    async purge(id) { await api.purgeItem(id); set(s => ({ items: s.items.filter(i => i.id !== id) })); },
    async toggleFavorite(id) {
      const it = get().items.find(i => i.id === id);
      if (it) await get().saveItem({ ...it, favorite: !it.favorite }, { id, folderId: it.folderId, teamId: it.teamId });
    },

    async importItems(list, { folderId, teamId }) {
      const key = keyFor(teamId);
      let n = 0;
      for (let i = 0; i < list.length; i += 500) {
        const chunk = await Promise.all(list.slice(i, i + 500).map(async d => {
          const id = uuid();
          return { id, data: await encryptJson(key, strip(d), id), folderId: teamId ? null : folderId, teamId };
        }));
        n += (await api.importItems(chunk)).imported;
      }
      await get().sync();
      return n;
    },

    async createFolder(name) {
      const id = uuid();
      await api.createFolder(id, await encryptJson(keyFor(null), { name }, id));
      const f = { id, name };
      set(s => ({ folders: [...s.folders, f].sort((a, b) => a.name.localeCompare(b.name)) }));
      return f;
    },
    async renameFolder(id, name) {
      await api.renameFolder(id, await encryptJson(keyFor(null), { name }, id));
      set(s => ({ folders: s.folders.map(f => (f.id === id ? { ...f, name } : f)) }));
    },
    async deleteFolder(id) {
      await api.deleteFolder(id);
      set(s => ({ folders: s.folders.filter(f => f.id !== id), items: s.items.map(i => (i.folderId === id ? { ...i, folderId: null } : i)) }));
    },

    async createTeam(name) {
      const profile = get().profile!;
      const id = uuid();
      const key = randomBytes(32);
      await api.createTeam({ id, data: await encryptJson(key, { name }, id), protectedTeamKey: await seal(profile.publicKey, key) });
      K!.teamKeys.set(id, key);
      const team: Team = { id, name, role: 'owner', key };
      set(s => ({ teams: [...s.teams, team].sort((a, b) => a.name.localeCompare(b.name)) }));
      return team;
    },
    async renameTeam(id, name) {
      await api.renameTeam(id, await encryptJson(keyFor(id), { name }, id));
      set(s => ({ teams: s.teams.map(t => (t.id === id ? { ...t, name } : t)) }));
    },
    async deleteTeam(id) { await api.deleteTeam(id); await get().sync(); },
    async leaveTeam(id) { await api.removeMember(id, get().profile!.id); await get().sync(); },
    members: id => api.members(id),
    async invite(teamId, email, role) {
      const user = await api.lookupUser(email);
      // The team key is sealed to the invitee's public key right here; the server never sees it.
      await api.addMember(teamId, { userId: user.id, role, protectedTeamKey: await seal(user.publicKey, keyFor(teamId)) });
    },
    setRole: (teamId, userId, role) => api.setRole(teamId, userId, role),
    removeMember: (teamId, userId) => api.removeMember(teamId, userId),

    async verifyPassword(password) {
      const profile = get().profile!;
      const { authKey, encKey } = await deriveKeys(password, profile.kdf);
      await decrypt(encKey, profile.protectedUserKey).catch(() => { throw new DecryptError('Wrong master password'); });
      return authKey;
    },
    async changePassword(current, next) {
      const currentAuthKey = await get().verifyPassword(current);
      const r = await rewrapUserKey(next, keyFor(null));
      const profile = await api.changePassword({ currentAuthKey, newAuthKey: r.authKey, newKdf: r.kdf, newProtectedUserKey: r.protectedUserKey });
      set({ profile });
      await get().sync();
    },
    setProfile: profile => set({ profile }),
    async deleteAccount(password) {
      await api.deleteAccount(await get().verifyPassword(password));
      get().lock();
      localStorage.removeItem(CACHE);
      set({ status: 'out', profile: null });
    },
  };
});

