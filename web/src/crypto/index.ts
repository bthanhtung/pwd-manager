/**
 * OpenPass client-side cryptography. Nothing in here ever leaves the browser unencrypted.
 *
 *   master password ──Argon2id(salt, 64 MiB, 3 passes)──▶ master key (32 B)
 *   master key ──HKDF("openpass/auth")──▶ auth key   → sent to the server (which stores argon2id(auth key))
 *   master key ──HKDF("openpass/enc")───▶ enc key    → never leaves the device
 *
 *   user key   (random 32 B)  is stored as AES-256-GCM(enc key)
 *   ECDH P-256 key pair:      public key in clear, private key as AES-256-GCM(user key)
 *   personal items:           AES-256-GCM(user key, JSON, aad = item id)
 *   team key   (random 32 B)  is sealed to each member's public key (ephemeral ECDH + HKDF + AES-GCM)
 *   team items:               AES-256-GCM(team key, JSON, aad = item id)
 *
 * Formats: "1.<iv>.<ciphertext+tag>"  and sealed boxes "e1.<ephemeral pub>.<iv>.<ciphertext+tag>", base64url.
 */
import { argon2id } from 'hash-wasm';

export interface Kdf { alg: 'argon2id'; salt: string; memory: number; iterations: number; parallelism: number }
export const DEFAULT_KDF: Omit<Kdf, 'salt'> = { alg: 'argon2id', memory: 65_536, iterations: 3, parallelism: 1 };

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

export const b64u = {
  enc(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str: string): Uint8Array {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
};
export const utf8 = { enc: (s: string) => te.encode(s), dec: (b: Uint8Array) => td.decode(b) };
export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

export function newKdf(): Kdf { return { ...DEFAULT_KDF, salt: b64u.enc(randomBytes(16)) }; }

export async function deriveMasterKey(password: string, kdf: Kdf): Promise<Uint8Array> {
  if (kdf.alg !== 'argon2id') throw new Error('Unsupported KDF');
  return argon2id({
    password: password.normalize('NFKC'), salt: b64u.dec(kdf.salt), parallelism: kdf.parallelism,
    iterations: kdf.iterations, memorySize: kdf.memory, hashLength: 32, outputType: 'binary',
  });
}

async function hkdf(ikm: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(info) }, key, length * 8);
  return new Uint8Array(bits);
}

/** Splits the master key into a login proof for the server and an encryption key that stays local. */
export async function deriveKeys(password: string, kdf: Kdf) {
  const master = await deriveMasterKey(password, kdf);
  const [auth, enc] = await Promise.all([hkdf(master, 'openpass/auth'), hkdf(master, 'openpass/enc')]);
  master.fill(0);
  return { authKey: b64u.enc(auth), encKey: enc };
}

const aesKey = (raw: Uint8Array, usage: KeyUsage[]) => subtle.importKey('raw', buf(raw), 'AES-GCM', false, usage);

export async function encrypt(key: Uint8Array, data: Uint8Array, aad?: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, ...(aad ? { additionalData: te.encode(aad) } : {}) }, await aesKey(key, ['encrypt']), buf(data));
  return `1.${b64u.enc(iv)}.${b64u.enc(new Uint8Array(ct))}`;
}

export class DecryptError extends Error {}

export async function decrypt(key: Uint8Array, payload: string, aad?: string): Promise<Uint8Array> {
  const [v, iv, ct] = payload.split('.');
  if (v !== '1' || !iv || !ct) throw new DecryptError('Unknown ciphertext format');
  try {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: buf(b64u.dec(iv)), ...(aad ? { additionalData: te.encode(aad) } : {}) },
      await aesKey(key, ['decrypt']), buf(b64u.dec(ct)));
    return new Uint8Array(pt);
  } catch {
    throw new DecryptError('Wrong key or tampered data');
  }
}

export const encryptJson = (key: Uint8Array, value: unknown, aad?: string) => encrypt(key, te.encode(JSON.stringify(value)), aad);
export const decryptJson = async <T>(key: Uint8Array, payload: string, aad?: string): Promise<T> =>
  JSON.parse(td.decode(await decrypt(key, payload, aad))) as T;

// ---------- asymmetric: sharing team keys ----------
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

export async function generateKeyPair() {
  const kp = await subtle.generateKey(ECDH, true, ['deriveBits']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', kp.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey));
  return { publicKey: b64u.enc(spki), privateKey: pkcs8 };
}

export const importPrivateKey = (pkcs8: Uint8Array) => subtle.importKey('pkcs8', buf(pkcs8), ECDH, false, ['deriveBits']);

async function shareKey(priv: CryptoKey, pub: CryptoKey, ephRaw: Uint8Array) {
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256));
  return hkdf(secret, `openpass/seal/${b64u.enc(ephRaw)}`);
}

/** Encrypts `data` so only the holder of the matching private key can read it. */
export async function seal(recipientSpki: string, data: Uint8Array): Promise<string> {
  const recipient = await subtle.importKey('spki', buf(b64u.dec(recipientSpki)), ECDH, false, []);
  const eph = await subtle.generateKey(ECDH, true, ['deriveBits']) as CryptoKeyPair;
  const ephRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const key = await shareKey(eph.privateKey, recipient, ephRaw);
  const inner = await encrypt(key, data);
  return `e1.${b64u.enc(ephRaw)}.${inner.slice(2)}`;
}

export async function open(privateKey: CryptoKey, sealed: string): Promise<Uint8Array> {
  const [v, eph, iv, ct] = sealed.split('.');
  if (v !== 'e1' || !eph || !iv || !ct) throw new DecryptError('Unknown sealed format');
  const ephRaw = b64u.dec(eph);
  const ephKey = await subtle.importKey('raw', buf(ephRaw), ECDH, false, []);
  return decrypt(await shareKey(privateKey, ephKey, ephRaw), `1.${iv}.${ct}`);
}

/** Short, human-comparable fingerprint of a public key ("1A2B 3C4D 5E6F 7A8B"), to verify who you share with. */
export async function fingerprint(spki: string): Promise<string> {
  const h = new Uint8Array(await subtle.digest('SHA-256', buf(b64u.dec(spki))));
  const hex = Array.from(h.subarray(0, 8), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{4}/g)!.join(' ');
}

// ---------- account bootstrap ----------
/** Everything a new account needs, generated on the device. */
export async function createAccountKeys(password: string) {
  const kdf = newKdf();
  const { authKey, encKey } = await deriveKeys(password, kdf);
  const userKey = randomBytes(32);
  const pair = await generateKeyPair();
  return {
    kdf, authKey, userKey, privateKey: pair.privateKey,
    protectedUserKey: await encrypt(encKey, userKey),
    publicKey: pair.publicKey,
    protectedPrivateKey: await encrypt(userKey, pair.privateKey),
  };
}

/** Unlocks an account: returns the user key and private key, or throws DecryptError on a wrong password. */
export async function unlockAccount(password: string, kdf: Kdf, protectedUserKey: string, protectedPrivateKey: string) {
  const { authKey, encKey } = await deriveKeys(password, kdf);
  const userKey = await decrypt(encKey, protectedUserKey);
  const privateKey = await decrypt(userKey, protectedPrivateKey);
  return { authKey, userKey, privateKeyPkcs8: privateKey, privateKey: await importPrivateKey(privateKey) };
}

/** Re-wraps the same user key under a new master password; vault items are untouched. */
export async function rewrapUserKey(newPassword: string, userKey: Uint8Array) {
  const kdf = newKdf();
  const { authKey, encKey } = await deriveKeys(newPassword, kdf);
  return { kdf, authKey, protectedUserKey: await encrypt(encKey, userKey) };
}

export function uuid(): string { return crypto.randomUUID(); }
