import Papa from 'papaparse';
import { decryptJson, deriveMasterKey, encryptJson, newKdf, type Kdf } from '../crypto';
import type { CustomField, ItemData, Item, Folder } from './types';

export type ImportFormat = 'auto' | 'bitwarden-json' | 'bitwarden-csv' | 'onepassword-csv' | 'chrome-csv' | 'firefox-csv' | 'safari-csv' | 'lastpass-csv' | 'openpass-json';

export const FORMATS: { id: ImportFormat; label: string; accept: string }[] = [
  { id: 'auto', label: 'Detect automatically', accept: '.csv,.json' },
  { id: 'openpass-json', label: 'OpenPass (encrypted .json)', accept: '.json' },
  { id: 'bitwarden-json', label: 'Bitwarden (.json, unencrypted)', accept: '.json' },
  { id: 'bitwarden-csv', label: 'Bitwarden (.csv)', accept: '.csv' },
  { id: 'onepassword-csv', label: '1Password (.csv)', accept: '.csv' },
  { id: 'chrome-csv', label: 'Chrome / Edge / Brave (.csv)', accept: '.csv' },
  { id: 'safari-csv', label: 'Safari / iCloud Keychain (.csv)', accept: '.csv' },
  { id: 'firefox-csv', label: 'Firefox (.csv)', accept: '.csv' },
  { id: 'lastpass-csv', label: 'LastPass (.csv)', accept: '.csv' },
];

const login = (name: string, username = '', password = '', url = '', notes = '', totp = ''): ItemData => ({
  type: 'login', name: name || hostName(url) || username || 'Untitled', notes,
  login: { username, password, uris: url ? [url] : [], totp }, fields: [],
});
function hostName(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

function rows(text: string): Record<string, string>[] {
  const r = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase() });
  return r.data;
}
const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k] != null && r[k] !== '') return String(r[k]); return ''; };

function fromCsv(text: string, fmt: ImportFormat): ItemData[] {
  const data = rows(text);
  if (!data.length) return [];
  const headers = Object.keys(data[0]);
  const has = (...h: string[]) => h.every(x => headers.includes(x));
  if (fmt === 'auto') {
    fmt = has('login_uri', 'login_password') ? 'bitwarden-csv'
      : has('url', 'username', 'password', 'grouping') ? 'lastpass-csv'
      : has('httprealm') || has('formactionorigin') ? 'firefox-csv'
      : has('title', 'url', 'username', 'password', 'otpauth') ? 'safari-csv'
      : has('title', 'username', 'password') ? 'onepassword-csv'
      : 'chrome-csv';
  }
  return data.map(r => {
    switch (fmt) {
      case 'bitwarden-csv': {
        const type = pick(r, 'type');
        if (type === 'note') return { type: 'note', name: pick(r, 'name') || 'Note', notes: pick(r, 'notes'), fields: [] } as ItemData;
        return { ...login(pick(r, 'name'), pick(r, 'login_username'), pick(r, 'login_password'), pick(r, 'login_uri').split(',')[0], pick(r, 'notes'), pick(r, 'login_totp')), favorite: pick(r, 'favorite') === '1' };
      }
      case 'lastpass-csv':
        if (pick(r, 'url') === 'http://sn') return { type: 'note', name: pick(r, 'name') || 'Note', notes: pick(r, 'extra'), fields: [] } as ItemData;
        return { ...login(pick(r, 'name'), pick(r, 'username'), pick(r, 'password'), pick(r, 'url'), pick(r, 'extra'), pick(r, 'totp')), favorite: pick(r, 'fav') === '1' };
      case 'firefox-csv': return login('', pick(r, 'username'), pick(r, 'password'), pick(r, 'url'));
      case 'safari-csv': return login(pick(r, 'title'), pick(r, 'username'), pick(r, 'password'), pick(r, 'url'), pick(r, 'notes'), pick(r, 'otpauth'));
      case 'onepassword-csv': return login(pick(r, 'title'), pick(r, 'username'), pick(r, 'password'), pick(r, 'url', 'website'), pick(r, 'notes', 'notesplain'), pick(r, 'otpauth', 'one-time password'));
      default: return login(pick(r, 'name'), pick(r, 'username'), pick(r, 'password'), pick(r, 'url'), pick(r, 'note', 'notes'));
    }
  }).filter(i => i.name || i.login?.password || i.notes);
}

function fromBitwardenJson(json: any): ItemData[] {
  if (json.encrypted) throw new Error('This Bitwarden export is encrypted. Export again as "JSON" (not "JSON (Encrypted)").');
  return (json.items || []).map((i: any): ItemData => {
    const fields: CustomField[] = (i.fields || []).map((f: any) => ({ name: f.name || '', value: f.value || '', hidden: f.type === 1 }));
    const base = { name: i.name || 'Untitled', notes: i.notes || '', favorite: !!i.favorite, fields };
    if (i.type === 1) return { ...base, type: 'login', login: { username: i.login?.username || '', password: i.login?.password || '', uris: (i.login?.uris || []).map((u: any) => u.uri).filter(Boolean), totp: i.login?.totp || '' } };
    if (i.type === 3) return { ...base, type: 'card', card: { holder: i.card?.cardholderName || '', number: i.card?.number || '', expMonth: i.card?.expMonth || '', expYear: i.card?.expYear || '', cvv: i.card?.code || '' } };
    if (i.type === 4) return { ...base, type: 'identity', identity: { firstName: i.identity?.firstName || '', lastName: i.identity?.lastName || '', email: i.identity?.email || '', phone: i.identity?.phone || '', company: i.identity?.company || '', address: [i.identity?.address1, i.identity?.city, i.identity?.country].filter(Boolean).join(', ') } };
    return { ...base, type: 'note' };
  });
}

// ---------- OpenPass encrypted export ----------
interface OpenPassExport { format: 'openpass-export'; version: 1; kdf: Kdf; data: string }

export async function exportEncrypted(items: Item[], folders: Folder[], password: string): Promise<string> {
  const kdf = newKdf();
  const key = await deriveMasterKey(password, kdf);
  const payload = {
    exportedAt: new Date().toISOString(),
    folders: folders.map(f => ({ id: f.id, name: f.name })),
    items: items.filter(i => !i.deletedAt).map(({ id: _id, teamId: _t, revision: _r, deletedAt: _d, createdAt: _c, updatedAt: _u, ...rest }) => rest),
  };
  const out: OpenPassExport = { format: 'openpass-export', version: 1, kdf, data: await encryptJson(key, payload, 'openpass-export') };
  key.fill(0);
  return JSON.stringify(out, null, 2);
}

export function exportCsv(items: Item[]): string {
  return Papa.unparse(items.filter(i => !i.deletedAt && i.type === 'login').map(i => ({
    name: i.name, url: i.login?.uris?.[0] || '', username: i.login?.username || '', password: i.login?.password || '', note: i.notes || '', totp: i.login?.totp || '',
  })));
}

/** Parses an import file. OpenPass encrypted exports need the export password. */
export async function parseImport(text: string, fmt: ImportFormat, exportPassword?: string): Promise<ItemData[]> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed);
    if (json.format === 'openpass-export') {
      if (!exportPassword) throw Object.assign(new Error('This export is password-protected'), { code: 'NEED_PASSWORD' });
      const key = await deriveMasterKey(exportPassword, json.kdf);
      const payload = await decryptJson<{ items: (ItemData & { folderId?: string })[] }>(key, json.data, 'openpass-export')
        .catch(() => { throw Object.assign(new Error('Wrong export password'), { code: 'BAD_PASSWORD' }); });
      return payload.items.map(({ folderId: _f, ...i }) => i);
    }
    return fromBitwardenJson(json);
  }
  if (fmt.endsWith('json')) throw new Error('Expected a JSON file');
  return fromCsv(text, fmt);
}
