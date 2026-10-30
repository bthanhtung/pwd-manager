import { describe, expect, it } from 'vitest';
import {
  b64u, createAccountKeys, decrypt, DecryptError, decryptJson, encrypt, encryptJson, fingerprint, generateKeyPair,
  importPrivateKey, open, randomBytes, rewrapUserKey, seal, unlockAccount, utf8,
} from './index';

// Lighter Argon2 for tests only; production uses DEFAULT_KDF (64 MiB, 3 passes).
const FAST = { memory: 1024, iterations: 2 };

describe('symmetric', () => {
  it('round-trips and binds associated data', async () => {
    const key = randomBytes(32);
    const ct = await encryptJson(key, { password: 'correct horse' }, 'item-1');
    expect(ct).toMatch(/^1\.[\w-]{16}\.[\w-]+$/);
    expect(await decryptJson(key, ct, 'item-1')).toEqual({ password: 'correct horse' });
    await expect(decrypt(key, ct, 'item-2')).rejects.toBeInstanceOf(DecryptError);       // swapped between items
    await expect(decrypt(randomBytes(32), ct, 'item-1')).rejects.toBeInstanceOf(DecryptError);
  });

  it('detects tampering', async () => {
    const key = randomBytes(32);
    const ct = await encrypt(key, utf8.enc('secret'));
    const parts = ct.split('.');
    const bytes = b64u.dec(parts[2]); bytes[0] ^= 1;
    await expect(decrypt(key, `1.${parts[1]}.${b64u.enc(bytes)}`)).rejects.toBeInstanceOf(DecryptError);
  });

  it('never reuses an IV', async () => {
    const key = randomBytes(32);
    const ivs = new Set(await Promise.all(Array.from({ length: 50 }, async () => (await encrypt(key, utf8.enc('x'))).split('.')[1])));
    expect(ivs.size).toBe(50);
  });
});

describe('sealed boxes', () => {
  it('only the recipient can open', async () => {
    const alice = await generateKeyPair();
    const mallory = await generateKeyPair();
    const teamKey = randomBytes(32);
    const box = await seal(alice.publicKey, teamKey);
    expect(box.startsWith('e1.')).toBe(true);
    expect(await open(await importPrivateKey(alice.privateKey), box)).toEqual(teamKey);
    await expect(open(await importPrivateKey(mallory.privateKey), box)).rejects.toBeInstanceOf(DecryptError);
  });

  it('fingerprints are stable and short', async () => {
    const { publicKey } = await generateKeyPair();
    expect(await fingerprint(publicKey)).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){3}$/);
    expect(await fingerprint(publicKey)).toBe(await fingerprint(publicKey));
  });
});

describe('account', () => {
  it('unlocks with the right password and rejects a wrong one', async () => {
    const acct = await createAccountKeys('Tr0ub4dor&3 but longer');
    acct.kdf = { ...acct.kdf, ...FAST };
    // recreate under the fast KDF so the test stays quick
    const { kdf, authKey, protectedUserKey } = await rewrapUserKey('Tr0ub4dor&3 but longer', acct.userKey).then(async r => {
      const fast = { ...r.kdf, ...FAST };
      const again = await (await import('./index')).deriveKeys('Tr0ub4dor&3 but longer', fast);
      return { kdf: fast, authKey: again.authKey, protectedUserKey: await encrypt(again.encKey, acct.userKey) };
    });
    const unlocked = await unlockAccount('Tr0ub4dor&3 but longer', kdf, protectedUserKey, acct.protectedPrivateKey);
    expect(unlocked.userKey).toEqual(acct.userKey);
    expect(unlocked.authKey).toBe(authKey);
    expect(unlocked.authKey).toHaveLength(43);
    await expect(unlockAccount('wrong password', kdf, protectedUserKey, acct.protectedPrivateKey)).rejects.toBeInstanceOf(DecryptError);
  }, 30_000);

  it('auth key and encryption key are independent', async () => {
    const { deriveKeys } = await import('./index');
    const k = await deriveKeys('pw', { alg: 'argon2id', salt: b64u.enc(randomBytes(16)), parallelism: 1, ...FAST });
    expect(b64u.dec(k.authKey)).not.toEqual(k.encKey);
  });
});
