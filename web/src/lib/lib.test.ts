import { describe, expect, it } from 'vitest';
import { DEFAULT_GEN, entropyBits, generate, randInt } from './generator';
import { exportEncrypted, parseImport } from './importers';
import { totpNow } from './totp';
import { cardBrand, hostOf } from './types';

describe('generator', () => {
  it('respects length and includes every chosen character set', () => {
    for (let i = 0; i < 200; i++) {
      const p = generate({ ...DEFAULT_GEN, length: 16 });
      expect(p).toHaveLength(16);
      expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/\d/); expect(p).toMatch(/[^A-Za-z0-9]/);
      expect(p).not.toMatch(/[Il1O0o]/);
    }
  });
  it('makes passphrases from the word list', () => {
    const p = generate({ ...DEFAULT_GEN, mode: 'passphrase', words: 5, separator: '-' });
    expect(p.split('-')).toHaveLength(5);
    expect(entropyBits({ ...DEFAULT_GEN, mode: 'passphrase', words: 5, includeNumber: false })).toBe(55);
  });
  it('randInt stays in range and covers it', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) { const n = randInt(7); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(7); seen.add(n); }
    expect(seen.size).toBe(7);
  });
});

describe('importers', () => {
  it('reads Chrome CSV', async () => {
    const items = await parseImport('name,url,username,password,note\nGitHub,https://github.com/login,octo,s3cret,hi\n', 'auto');
    expect(items[0]).toMatchObject({ type: 'login', name: 'GitHub', notes: 'hi', login: { username: 'octo', password: 's3cret', uris: ['https://github.com/login'] } });
  });
  it('reads Bitwarden CSV including notes', async () => {
    const csv = 'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n,1,login,Mail,,,0,https://mail.example.com,me,pw,\n,,note,Wifi,ssid: home,,0,,,,\n';
    const items = await parseImport(csv, 'auto');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ favorite: true, login: { password: 'pw' } });
    expect(items[1]).toMatchObject({ type: 'note', notes: 'ssid: home' });
  });
  it('reads Bitwarden JSON cards and refuses encrypted exports', async () => {
    const json = JSON.stringify({ encrypted: false, items: [{ type: 3, name: 'Visa', card: { cardholderName: 'A B', number: '4111111111111111', expMonth: '1', expYear: '2030', code: '123' } }] });
    expect((await parseImport(json, 'auto'))[0]).toMatchObject({ type: 'card', card: { number: '4111111111111111', cvv: '123' } });
    await expect(parseImport(JSON.stringify({ encrypted: true }), 'auto')).rejects.toThrow(/encrypted/);
  });
  it('round-trips the OpenPass encrypted export', async () => {
    const item = { id: 'x', teamId: null, folderId: null, revision: 1, deletedAt: null, createdAt: '', updatedAt: '', type: 'login' as const, name: 'A', login: { username: 'u', password: 'p', uris: [] } };
    const file = await exportEncrypted([item], [], 'export pw');
    expect(file).not.toContain('"p"');
    await expect(parseImport(file, 'auto')).rejects.toMatchObject({ code: 'NEED_PASSWORD' });
    await expect(parseImport(file, 'auto', 'nope')).rejects.toMatchObject({ code: 'BAD_PASSWORD' });
    expect((await parseImport(file, 'auto', 'export pw'))[0]).toMatchObject({ name: 'A', login: { password: 'p' } });
  }, 30_000);
});

describe('helpers', () => {
  it('totp codes are 6 digits', () => {
    const r = totpNow('JBSWY3DPEHPK3PXP')!;
    expect(r.code).toMatch(/^\d{6}$/);
    expect(r.remaining).toBeGreaterThan(0);
    expect(totpNow('not base32 !!')).toBeNull();
  });
  it('detects card brands and hosts', () => {
    expect(cardBrand('4111 1111 1111 1111')).toBe('Visa');
    expect(cardBrand('5500 0000 0000 0004')).toBe('Mastercard');
    expect(hostOf('www.github.com/login')).toBe('github.com');
  });
});
