import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import { AppConfig, CONFIG } from '../config';
import { DB, Db } from '../db/database.module';
import { now } from '../common/session.service';
import { LoginDto, RegisterDto } from './dto';

export const DEFAULT_KDF = { alg: 'argon2id', memory: 65_536, iterations: 3, parallelism: 1 } as const;
// authKey is already a 256-bit random-looking value, so a light server-side hash is enough;
// it still makes a stolen database useless for logging in.
const SERVER_HASH = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const normEmail = (e: string) => e.trim().toLowerCase();

export function profileOf(u: {
  id: string; email: string; name: string; kdf: string; protected_user_key: string; public_key: string;
  protected_private_key: string; totp_enabled: number; created_at: string;
}) {
  return {
    id: u.id, email: u.email, name: u.name, kdf: JSON.parse(u.kdf), protectedUserKey: u.protected_user_key,
    publicKey: u.public_key, protectedPrivateKey: u.protected_private_key, twoFactor: !!u.totp_enabled, createdAt: u.created_at,
  };
}

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private db: Db, @Inject(CONFIG) private config: AppConfig) {}

  /**
   * KDF parameters for an email. Unknown emails get stable, plausible fake parameters
   * so the endpoint cannot be used to discover who has an account.
   */
  async prelogin(email: string) {
    const u = await this.db.selectFrom('users').select('kdf').where('email', '=', normEmail(email)).executeTakeFirst();
    if (u) return { kdf: JSON.parse(u.kdf) };
    const salt = createHmac('sha256', this.config.serverSecret).update(normEmail(email)).digest().subarray(0, 16).toString('base64url');
    return { kdf: { ...DEFAULT_KDF, salt } };
  }

  async register(dto: RegisterDto) {
    if (!this.config.signupsAllowed) throw new ForbiddenException({ code: 'SIGNUPS_CLOSED', message: 'Registration is closed on this server' });
    const email = normEmail(dto.email);
    const exists = await this.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists' });
    const t = now();
    const user = {
      id: randomUUID(), email, name: dto.name.trim(), auth_hash: await argon2.hash(dto.authKey, SERVER_HASH),
      kdf: JSON.stringify(dto.kdf), protected_user_key: dto.protectedUserKey, public_key: dto.publicKey,
      protected_private_key: dto.protectedPrivateKey, totp_secret: null, totp_enabled: 0,
      security_stamp: randomBytes(16).toString('hex'), created_at: t, updated_at: t,
    };
    await this.db.insertInto('users').values(user).execute();
    return user;
  }

  async login(dto: LoginDto) {
    const u = await this.db.selectFrom('users').selectAll().where('email', '=', normEmail(dto.email)).executeTakeFirst();
    // Verify against a dummy hash for unknown users to keep timing similar.
    const ok = u ? await argon2.verify(u.auth_hash, dto.authKey) : (await argon2.hash(dto.authKey, SERVER_HASH), false);
    if (!u || !ok) throw new UnauthorizedException({ code: 'BAD_CREDENTIALS', message: 'Email or master password is incorrect' });
    if (u.totp_enabled) {
      if (!dto.totp) throw new UnauthorizedException({ code: 'TOTP_REQUIRED', message: 'Enter the code from your authenticator app' });
      if (!authenticator.verify({ token: dto.totp, secret: u.totp_secret! })) {
        throw new UnauthorizedException({ code: 'TOTP_INVALID', message: 'That code is not valid' });
      }
    }
    return u;
  }

  async verifyAuthKey(userId: string, authKey: string) {
    const u = await this.db.selectFrom('users').select('auth_hash').where('id', '=', userId).executeTakeFirstOrThrow();
    if (!(await argon2.verify(u.auth_hash, authKey))) {
      throw new UnauthorizedException({ code: 'BAD_CREDENTIALS', message: 'Master password is incorrect' });
    }
  }

  hashAuthKey(authKey: string) { return argon2.hash(authKey, SERVER_HASH); }
}
