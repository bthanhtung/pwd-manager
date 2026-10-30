export type ItemType = 'login' | 'card' | 'note' | 'identity';

export interface CustomField { name: string; value: string; hidden: boolean }

/** The decrypted shape of an item. The whole object (name included) is encrypted before upload. */
export interface ItemData {
  type: ItemType;
  name: string;
  favorite?: boolean;
  notes?: string;
  fields?: CustomField[];
  login?: { username: string; password: string; uris: string[]; totp?: string };
  card?: { holder: string; number: string; expMonth: string; expYear: string; cvv: string };
  identity?: { firstName: string; lastName: string; email: string; phone: string; company: string; address: string };
  passwordHistory?: { password: string; changedAt: string }[];
}

export interface Item extends ItemData {
  id: string;
  teamId: string | null;
  folderId: string | null;
  revision: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder { id: string; name: string }
export interface Team { id: string; name: string; role: 'owner' | 'admin' | 'editor' | 'viewer'; key: Uint8Array }

export function emptyItem(type: ItemType): ItemData {
  const base: ItemData = { type, name: '', notes: '', fields: [] };
  if (type === 'login') base.login = { username: '', password: '', uris: [''], totp: '' };
  if (type === 'card') base.card = { holder: '', number: '', expMonth: '', expYear: '', cvv: '' };
  if (type === 'identity') base.identity = { firstName: '', lastName: '', email: '', phone: '', company: '', address: '' };
  return base;
}

export function itemSubtitle(i: ItemData): string {
  if (i.type === 'login') return i.login?.username || hostOf(i.login?.uris?.[0]) || '';
  if (i.type === 'card') return i.card?.number ? `•••• ${i.card.number.replace(/\D/g, '').slice(-4)}` : i.card?.holder || '';
  if (i.type === 'identity') return [i.identity?.firstName, i.identity?.lastName].filter(Boolean).join(' ') || i.identity?.email || '';
  return (i.notes || '').split('\n')[0].slice(0, 60);
}

export function hostOf(uri?: string): string {
  if (!uri) return '';
  try { return new URL(/^[a-z]+:\/\//i.test(uri) ? uri : `https://${uri}`).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function cardBrand(num: string): string {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
  if (/^35/.test(n)) return 'JCB';
  if (/^(62|81)/.test(n)) return 'UnionPay';
  return '';
}
