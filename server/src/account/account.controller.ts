import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { AuthService, profileOf } from '../auth/auth.service';
import { KdfDto } from '../auth/dto';
import { authLimit, Public, SessionId, UserId } from '../common/guards';
import { now, SESSION_COOKIE, SessionService } from '../common/session.service';
import { B64URL_RE, IsCipher } from '../common/validators';
import { DB, Db } from '../db/database.module';

class AuthKeyDto { @Matches(B64URL_RE) @Length(43, 43) authKey: string; }
class NameDto { @IsString() @MinLength(1) @MaxLength(120) name: string; }
class CodeDto { @Matches(/^\d{6}$/) code: string; }
class DisableTotpDto extends AuthKeyDto { @Matches(/^\d{6}$/) code: string; }
class ChangePasswordDto {
  @Matches(B64URL_RE) @Length(43, 43) currentAuthKey: string;
  @Matches(B64URL_RE) @Length(43, 43) newAuthKey: string;
  @ValidateNested() @Type(() => KdfDto) newKdf: KdfDto;
  @IsCipher(400) newProtectedUserKey: string;
}

/** Lets the web app ask "am I signed in?" without producing a 401 for logged-out visitors. */
@ApiTags('account')
@Controller('session')
export class SessionController {
  constructor(@Inject(DB) private db: Db) {}
  @Public() @Get()
  async current(@Req() req: Request & { userId?: string }) {
    if (!req.userId) return { authenticated: false };
    const u = await this.db.selectFrom('users').selectAll().where('id', '=', req.userId).executeTakeFirst();
    return u ? { authenticated: true, profile: profileOf(u) } : { authenticated: false };
  }
}

@ApiTags('account')
@Controller('me')
export class AccountController {
  constructor(@Inject(DB) private db: Db, private auth: AuthService, private sessions: SessionService) {}

  private async user(id: string) {
    return this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  @Get()
  async me(@UserId() id: string) { return profileOf(await this.user(id)); }

  @Patch()
  async rename(@UserId() id: string, @Body() dto: NameDto) {
    await this.db.updateTable('users').set({ name: dto.name.trim(), updated_at: now() }).where('id', '=', id).execute();
    return profileOf(await this.user(id));
  }

  /**
   * Changing the master password only re-wraps the user key: vault items stay untouched,
   * because they are encrypted with the user key, not with the password itself.
   */
  @Post('password') @HttpCode(200) @Throttle({ default: { limit: authLimit, ttl: 60_000 } })
  async changePassword(@UserId() id: string, @SessionId() sid: string, @Body() dto: ChangePasswordDto) {
    await this.auth.verifyAuthKey(id, dto.currentAuthKey);
    await this.db.updateTable('users').set({
      auth_hash: await this.auth.hashAuthKey(dto.newAuthKey), kdf: JSON.stringify(dto.newKdf),
      protected_user_key: dto.newProtectedUserKey, security_stamp: randomBytes(16).toString('hex'), updated_at: now(),
    }).where('id', '=', id).execute();
    await this.sessions.destroyOthers(id, sid);
    return profileOf(await this.user(id));
  }

  @Post('2fa/setup') @HttpCode(200)
  async setupTotp(@UserId() id: string) {
    const u = await this.user(id);
    if (u.totp_enabled) throw new BadRequestException({ code: 'TOTP_ALREADY_ENABLED', message: 'Two-step login is already on' });
    const secret = authenticator.generateSecret(20);
    await this.db.updateTable('users').set({ totp_secret: secret }).where('id', '=', id).execute();
    return { secret, otpauthUrl: authenticator.keyuri(u.email, 'OpenPass', secret) };
  }

  @Post('2fa/enable') @HttpCode(200)
  async enableTotp(@UserId() id: string, @Body() dto: CodeDto) {
    const u = await this.user(id);
    if (!u.totp_secret || !authenticator.verify({ token: dto.code, secret: u.totp_secret })) {
      throw new BadRequestException({ code: 'TOTP_INVALID', message: 'That code is not valid' });
    }
    await this.db.updateTable('users').set({ totp_enabled: 1, updated_at: now() }).where('id', '=', id).execute();
    return profileOf(await this.user(id));
  }

  @Post('2fa/disable') @HttpCode(200)
  async disableTotp(@UserId() id: string, @Body() dto: DisableTotpDto) {
    await this.auth.verifyAuthKey(id, dto.authKey);
    const u = await this.user(id);
    if (u.totp_enabled && !authenticator.verify({ token: dto.code, secret: u.totp_secret! })) {
      throw new BadRequestException({ code: 'TOTP_INVALID', message: 'That code is not valid' });
    }
    await this.db.updateTable('users').set({ totp_enabled: 0, totp_secret: null, updated_at: now() }).where('id', '=', id).execute();
    return profileOf(await this.user(id));
  }

  @Get('sessions')
  async listSessions(@UserId() id: string, @SessionId() sid: string) {
    const rows = await this.db.selectFrom('sessions').select(['id', 'user_agent', 'created_at', 'last_seen_at'])
      .where('user_id', '=', id).orderBy('last_seen_at', 'desc').execute();
    return rows.map(r => ({ id: r.id.slice(0, 16), userAgent: r.user_agent, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === sid }));
  }

  @Delete('sessions/:id') @HttpCode(204)
  async revokeSession(@UserId() id: string, @Param('id') short: string) {
    if (!/^[0-9a-f]{16}$/.test(short)) throw new BadRequestException();
    const rows = await this.db.selectFrom('sessions').select('id').where('user_id', '=', id).execute();
    const target = rows.find(r => r.id.startsWith(short));
    if (target) await this.db.deleteFrom('sessions').where('id', '=', target.id).execute();
  }

  @Post('sessions/revoke-others') @HttpCode(204)
  async revokeOthers(@UserId() id: string, @SessionId() sid: string) { await this.sessions.destroyOthers(id, sid); }

  /** Permanently deletes the account, personal items, folders and memberships. Teams it solely owns go too. */
  @Delete() @HttpCode(204) @Throttle({ default: { limit: authLimit, ttl: 60_000 } })
  async deleteAccount(@UserId() id: string, @Body() dto: AuthKeyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.verifyAuthKey(id, dto.authKey);
    await this.db.transaction().execute(async trx => {
      const owned = await trx.selectFrom('team_members').select('team_id').where('user_id', '=', id).where('role', '=', 'owner').execute();
      for (const { team_id } of owned) {
        const otherOwners = await trx.selectFrom('team_members').select('user_id')
          .where('team_id', '=', team_id).where('role', '=', 'owner').where('user_id', '!=', id).execute();
        if (!otherOwners.length) {
          await trx.deleteFrom('items').where('team_id', '=', team_id).execute();
          await trx.deleteFrom('team_members').where('team_id', '=', team_id).execute();
          await trx.deleteFrom('teams').where('id', '=', team_id).execute();
        }
      }
      await trx.deleteFrom('items').where('user_id', '=', id).execute();
      await trx.deleteFrom('folders').where('user_id', '=', id).execute();
      await trx.deleteFrom('team_members').where('user_id', '=', id).execute();
      await trx.deleteFrom('sessions').where('user_id', '=', id).execute();
      await trx.deleteFrom('users').where('id', '=', id).execute();
    });
    res.clearCookie(SESSION_COOKIE, { path: '/api' });
    void req;
  }
}
