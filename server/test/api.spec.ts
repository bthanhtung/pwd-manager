import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config';
import { configureApp } from '../src/main';

// Shapes that match what the web client produces; the server never looks inside them.
const b64 = (n: number) => randomBytes(n).toString('base64url');
const cipher = (n = 48) => `1.${b64(12)}.${b64(n)}`;
const sealed = () => `e1.${b64(65)}.${b64(12)}.${b64(48)}`;
const kdf = { alg: 'argon2id', salt: b64(16), memory: 65536, iterations: 3, parallelism: 1 };

process.env.AUTH_RATE_LIMIT = '1000';
let app: INestApplication;
const H = { 'X-OpenPass': '1' };

function agent() { return request.agent(app.getHttpServer()); }
async function signup(email: string, authKey = b64(32)) {
  const a = agent();
  const res = await a.post('/api/auth/register').set(H).send({
    email, name: email.split('@')[0], authKey, kdf, protectedUserKey: cipher(), publicKey: b64(91), protectedPrivateKey: cipher(150),
  });
  expect(res.status).toBe(201);
  return { a, authKey, id: res.body.id as string };
}

beforeAll(async () => {
  const config = { ...loadConfig({ DATABASE_URL: 'sqlite::memory:', SERVER_SECRET: 'test-secret' }), trustProxy: false };
  const mod = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
  app = mod.createNestApplication();
  configureApp(app, config);
  await app.init();
});
afterAll(() => app.close());

describe('auth', () => {
  it('prelogin hides whether an account exists', async () => {
    const r1 = await agent().post('/api/auth/prelogin').set(H).send({ email: 'nobody@example.com' });
    const r2 = await agent().post('/api/auth/prelogin').set(H).send({ email: 'NOBODY@example.com' });
    expect(r1.status).toBe(200);
    expect(r1.body.kdf.salt).toBe(r2.body.kdf.salt);
    expect(r1.body.kdf.alg).toBe('argon2id');
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const r = await agent().post('/api/auth/prelogin').send({ email: 'a@example.com' });
    expect(r.status).toBe(403);
  });

  it('registers, rejects duplicates, logs in and out', async () => {
    const { a, authKey } = await signup('alice@example.com');
    expect((await a.get('/api/me')).body.email).toBe('alice@example.com');
    expect((await agent().post('/api/auth/register').set(H).send({
      email: 'Alice@Example.com', name: 'x', authKey: b64(32), kdf, protectedUserKey: cipher(), publicKey: b64(91), protectedPrivateKey: cipher(150),
    })).status).toBe(409);
    const b = agent();
    expect((await b.post('/api/auth/login').set(H).send({ email: 'alice@example.com', authKey: b64(32) })).status).toBe(401);
    const ok = await b.post('/api/auth/login').set(H).send({ email: 'alice@example.com', authKey });
    expect(ok.status).toBe(200);
    expect(ok.body.protectedUserKey).toBeDefined();
    await b.post('/api/auth/logout').set(H).expect(204);
    expect((await b.get('/api/me')).status).toBe(401);
  });

  it('rejects plaintext where ciphertext is expected', async () => {
    const r = await agent().post('/api/auth/register').set(H).send({
      email: 'p@example.com', name: 'p', authKey: b64(32), kdf, protectedUserKey: 'hunter2', publicKey: b64(91), protectedPrivateKey: cipher(150),
    });
    expect(r.status).toBe(400);
  });
});

describe('vault items', () => {
  it('creates, updates with revisions, trashes, restores and deletes', async () => {
    const { a } = await signup('bob@example.com');
    const id = randomUUID();
    expect((await a.post('/api/items').set(H).send({ id, data: cipher() })).status).toBe(201);
    const up = await a.put(`/api/items/${id}`).set(H).send({ data: cipher(), revision: 1 });
    expect(up.body.revision).toBe(2);
    expect((await a.put(`/api/items/${id}`).set(H).send({ data: cipher(), revision: 1 })).status).toBe(409);
    expect((await a.delete(`/api/items/${id}`).set(H)).body.deletedAt).toBeTruthy();
    expect((await a.post(`/api/items/${id}/restore`).set(H)).body.deletedAt).toBeNull();
    await a.delete(`/api/items/${id}/permanent`).set(H).expect(204);
    expect((await a.get('/api/sync')).body.items).toHaveLength(0);
  });

  it('never lets another user read or change an item', async () => {
    const { a } = await signup('carol@example.com');
    const { a: eve } = await signup('eve@example.com');
    const id = randomUUID();
    await a.post('/api/items').set(H).send({ id, data: cipher() }).expect(201);
    expect((await eve.put(`/api/items/${id}`).set(H).send({ data: cipher(), revision: 1 })).status).toBe(404);
    expect((await eve.delete(`/api/items/${id}/permanent`).set(H)).status).toBe(404);
    expect((await eve.get('/api/sync')).body.items).toHaveLength(0);
  });

  it('imports in bulk and moves items out of a deleted folder', async () => {
    const { a } = await signup('dave@example.com');
    const folder = randomUUID();
    await a.post('/api/folders').set(H).send({ id: folder, data: cipher() }).expect(201);
    const items = Array.from({ length: 30 }, () => ({ id: randomUUID(), data: cipher(), folderId: folder }));
    expect((await a.post('/api/items/import').set(H).send({ items })).body.imported).toBe(30);
    await a.delete(`/api/folders/${folder}`).set(H).expect(204);
    const s = await a.get('/api/sync');
    expect(s.body.items.every((i: any) => i.folderId === null)).toBe(true);
  });
});

describe('teams', () => {
  it('shares items with members and enforces roles', async () => {
    const owner = await signup('owner@example.com');
    const editor = await signup('editor@example.com');
    const viewer = await signup('viewer@example.com');
    const outsider = await signup('outsider@example.com');
    const team = randomUUID();
    await owner.a.post('/api/teams').set(H).send({ id: team, data: cipher(), protectedTeamKey: sealed() }).expect(201);

    const look = await owner.a.get('/api/users/lookup').query({ email: 'Editor@example.com' });
    expect(look.body.id).toBe(editor.id);
    await owner.a.post(`/api/teams/${team}/members`).set(H).send({ userId: editor.id, role: 'admin', protectedTeamKey: sealed() }).expect(201);
    await owner.a.post(`/api/teams/${team}/members`).set(H).send({ userId: viewer.id, role: 'viewer', protectedTeamKey: sealed() }).expect(201);

    // admins cannot hand out ownership
    expect((await editor.a.patch(`/api/teams/${team}/members/${viewer.id}`).set(H).send({ role: 'owner' })).status).toBe(403);

    const item = randomUUID();
    await editor.a.post('/api/items').set(H).send({ id: item, data: cipher(), teamId: team }).expect(201);
    expect((await viewer.a.get('/api/sync')).body.items.map((i: any) => i.id)).toContain(item);
    expect((await viewer.a.put(`/api/items/${item}`).set(H).send({ data: cipher(), revision: 1 })).status).toBe(403);
    expect((await viewer.a.post('/api/items').set(H).send({ id: randomUUID(), data: cipher(), teamId: team })).status).toBe(403);
    expect((await outsider.a.get(`/api/teams/${team}/members`)).status).toBe(404);
    expect((await outsider.a.post('/api/items').set(H).send({ id: randomUUID(), data: cipher(), teamId: team })).status).toBe(404);

    // the last owner cannot leave; removing a member cuts access
    expect((await owner.a.delete(`/api/teams/${team}/members/${owner.id}`).set(H)).status).toBe(400);
    await owner.a.delete(`/api/teams/${team}/members/${viewer.id}`).set(H).expect(204);
    expect((await viewer.a.get('/api/sync')).body.items).toHaveLength(0);
  });
});

describe('account', () => {
  it('changes the master password and signs out other devices', async () => {
    const { a, authKey } = await signup('frank@example.com');
    const other = agent();
    await other.post('/api/auth/login').set(H).send({ email: 'frank@example.com', authKey }).expect(200);
    const newAuthKey = b64(32);
    await a.post('/api/me/password').set(H).send({ currentAuthKey: authKey, newAuthKey, newKdf: { ...kdf, salt: b64(16) }, newProtectedUserKey: cipher() }).expect(200);
    expect((await other.get('/api/me')).status).toBe(401);
    expect((await a.get('/api/me')).status).toBe(200);
    await agent().post('/api/auth/login').set(H).send({ email: 'frank@example.com', authKey: newAuthKey }).expect(200);
  });

  it('enforces two-step login once enabled', async () => {
    const { a, authKey } = await signup('grace@example.com');
    const { secret } = (await a.post('/api/me/2fa/setup').set(H)).body;
    await a.post('/api/me/2fa/enable').set(H).send({ code: authenticator.generate(secret) }).expect(200);
    const b = agent();
    const r = await b.post('/api/auth/login').set(H).send({ email: 'grace@example.com', authKey });
    expect(r.body.code).toBe('TOTP_REQUIRED');
    await b.post('/api/auth/login').set(H).send({ email: 'grace@example.com', authKey, totp: authenticator.generate(secret) }).expect(200);
  });

  it('deletes the account and everything in it', async () => {
    const { a, authKey } = await signup('heidi@example.com');
    await a.post('/api/items').set(H).send({ id: randomUUID(), data: cipher() }).expect(201);
    expect((await a.delete('/api/me').set(H).send({ authKey: b64(32) })).status).toBe(401);
    await a.delete('/api/me').set(H).send({ authKey }).expect(204);
    expect((await agent().post('/api/auth/login').set(H).send({ email: 'heidi@example.com', authKey })).status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('slows down password guessing', async () => {
    process.env.AUTH_RATE_LIMIT = '3';
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await agent().post('/api/auth/login').set(H).set('X-Forwarded-For', '10.9.9.9').send({ email: 'x@example.com', authKey: b64(32) })).status);
    expect(codes).toContain(429);
    process.env.AUTH_RATE_LIMIT = '1000';
  });
});
