import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Runtime configuration, read once from environment variables.
 *
 *   DATABASE_URL      sqlite:///data/openpass.db (default) or postgres://user:pass@host/db
 *   PORT              HTTP port (default 8080)
 *   APP_URL           public URL, e.g. https://pass.example.com (enables Secure cookies when https)
 *   SIGNUPS_ALLOWED   "true" (default) or "false" to close registration after you created your accounts
 *   SERVER_SECRET     optional; random value persisted next to the SQLite file when omitted
 *   TRUST_PROXY       "true" when running behind a reverse proxy (default true)
 */
export interface AppConfig {
  databaseUrl: string;
  port: number;
  appUrl: string;
  signupsAllowed: boolean;
  serverSecret: string;
  trustProxy: boolean;
  secureCookies: boolean;
  webDir: string;
}

const bool = (v: string | undefined, d: boolean) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

function loadSecret(env: NodeJS.ProcessEnv, databaseUrl: string): string {
  if (env.SERVER_SECRET) return env.SERVER_SECRET;
  // Persist a generated secret beside the SQLite file so restarts keep it stable (not for in-memory databases).
  const path = databaseUrl.startsWith('sqlite:') ? sqlitePath(databaseUrl) : ':memory:';
  const file = path !== ':memory:' ? join(dirname(path), '.server-secret') : null;
  if (file && existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('base64url');
  if (file) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, secret, { mode: 0o600 });
  }
  return secret;
}

export function sqlitePath(url: string): string {
  const p = url.replace(/^sqlite:(\/\/)?/, '');
  return p === ':memory:' ? p : p || './data/openpass.db';
}

export function loadConfig(env = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL || 'sqlite://./data/openpass.db';
  const appUrl = (env.APP_URL || `http://localhost:${env.PORT || 8080}`).replace(/\/$/, '');
  return {
    databaseUrl,
    port: Number(env.PORT || 8080),
    appUrl,
    signupsAllowed: bool(env.SIGNUPS_ALLOWED, true),
    serverSecret: loadSecret(env, databaseUrl),
    trustProxy: bool(env.TRUST_PROXY, true),
    secureCookies: appUrl.startsWith('https://'),
    webDir: env.WEB_DIR || join(__dirname, '..', 'public'),
  };
}

export const CONFIG = Symbol('CONFIG');
