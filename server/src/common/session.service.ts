import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppConfig, CONFIG } from '../config';
import { DB, Db } from '../db/database.module';

export const SESSION_COOKIE = 'op_session';
const SESSION_DAYS = 30;
const TOUCH_EVERY_MS = 5 * 60_000;

export const now = () => new Date().toISOString();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Opaque, server-side sessions in an httpOnly SameSite=Strict cookie. Only a hash of the token is stored. */
@Injectable()
export class SessionService {
  constructor(@Inject(DB) private db: Db, @Inject(CONFIG) private config: AppConfig) {}

  async create(userId: string, req: Request, res: Response) {
    const token = randomBytes(32).toString('base64url');
    const t = now();
    await this.db.insertInto('sessions').values({
      id: hash(token), user_id: userId, user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      created_at: t, last_seen_at: t, expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
    }).execute();
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'strict', secure: this.config.secureCookies, path: '/api', maxAge: SESSION_DAYS * 864e5,
    });
  }

  /** Returns the user id for a valid session, sliding the expiry forward. */
  async resolve(token: string | undefined): Promise<{ userId: string; sessionId: string } | null> {
    if (!token) return null;
    const id = hash(token);
    const s = await this.db.selectFrom('sessions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!s || s.expires_at < now()) return null;
    if (Date.now() - Date.parse(s.last_seen_at) > TOUCH_EVERY_MS) {
      await this.db.updateTable('sessions').set({
        last_seen_at: now(), expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
      }).where('id', '=', id).execute();
    }
    return { userId: s.user_id, sessionId: id };
  }

  async destroy(token: string | undefined, res: Response) {
    if (token) await this.db.deleteFrom('sessions').where('id', '=', hash(token)).execute();
    res.clearCookie(SESSION_COOKIE, { path: '/api' });
  }

  /** Sign out every other device (after a master password change, for example). */
  async destroyOthers(userId: string, keepSessionId?: string) {
    let q = this.db.deleteFrom('sessions').where('user_id', '=', userId);
    if (keepSessionId) q = q.where('id', '!=', keepSessionId);
    await q.execute();
  }
}
