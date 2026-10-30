import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { normEmail } from '../auth/auth.service';
import { UserId } from '../common/guards';
import { now } from '../common/session.service';
import { IsCipher, IsSealed, IsUuid } from '../common/validators';
import { DB, Db } from '../db/database.module';
import { AccessService, atLeast, Role } from './access.service';

const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
class CreateTeamDto { @IsUuid() id: string; @IsCipher(2000) data: string; @IsSealed() protectedTeamKey: string; }
class UpdateTeamDto { @IsCipher(2000) data: string; }
class AddMemberDto { @IsUuid() userId: string; @IsIn(ROLES) role: Role; @IsSealed() protectedTeamKey: string; }
class RoleDto { @IsIn(ROLES) role: Role; }
class LookupDto { @IsEmail() @MaxLength(320) email: string; }

@ApiTags('teams')
@Controller()
export class TeamsController {
  constructor(@Inject(DB) private db: Db, private access: AccessService) {}

  /** Public key of another user, needed to seal the team key for them before inviting. */
  @Get('users/lookup') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async lookup(@Query() q: LookupDto) {
    const u = await this.db.selectFrom('users').select(['id', 'name', 'email', 'public_key'])
      .where('email', '=', normEmail(q.email)).executeTakeFirst();
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'No account uses this email on this server' });
    return { id: u.id, name: u.name, email: u.email, publicKey: u.public_key };
  }

  @Post('teams')
  async create(@UserId() uid: string, @Body() dto: CreateTeamDto) {
    const id = dto.id.toLowerCase();
    if (await this.db.selectFrom('teams').select('id').where('id', '=', id).executeTakeFirst()) {
      throw new ConflictException({ code: 'TEAM_EXISTS', message: 'Team id already used' });
    }
    const t = now();
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('teams').values({ id, data: dto.data, created_by: uid, created_at: t, updated_at: t }).execute();
      await trx.insertInto('team_members').values({ team_id: id, user_id: uid, role: 'owner', protected_team_key: dto.protectedTeamKey, created_at: t }).execute();
    });
    return { id, data: dto.data, role: 'owner', protectedTeamKey: dto.protectedTeamKey, createdAt: t, updatedAt: t };
  }

  @Put('teams/:id')
  async update(@UserId() uid: string, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    await this.access.requireTeamRole(uid, id, 'admin');
    await this.db.updateTable('teams').set({ data: dto.data, updated_at: now() }).where('id', '=', id).execute();
    return { id, data: dto.data };
  }

  @Delete('teams/:id') @HttpCode(204)
  async remove(@UserId() uid: string, @Param('id') id: string) {
    await this.access.requireTeamRole(uid, id, 'owner');
    await this.db.transaction().execute(async trx => {
      await trx.deleteFrom('items').where('team_id', '=', id).execute();
      await trx.deleteFrom('team_members').where('team_id', '=', id).execute();
      await trx.deleteFrom('teams').where('id', '=', id).execute();
    });
  }

  @Get('teams/:id/members')
  async members(@UserId() uid: string, @Param('id') id: string) {
    await this.access.requireTeamRole(uid, id, 'viewer');
    const rows = await this.db.selectFrom('team_members').innerJoin('users', 'users.id', 'team_members.user_id')
      .select(['users.id as id', 'users.name as name', 'users.email as email', 'users.public_key as publicKey', 'team_members.role as role', 'team_members.created_at as joinedAt'])
      .where('team_members.team_id', '=', id).orderBy('team_members.created_at').execute();
    return rows;
  }

  @Post('teams/:id/members')
  async addMember(@UserId() uid: string, @Param('id') id: string, @Body() dto: AddMemberDto) {
    const myRole = await this.access.requireTeamRole(uid, id, 'admin');
    if (!atLeast(myRole, dto.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You cannot grant a role above your own' });
    const user = await this.db.selectFrom('users').select('id').where('id', '=', dto.userId).executeTakeFirst();
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (await this.access.teamRole(dto.userId, id)) throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'Already a member' });
    await this.db.insertInto('team_members').values({
      team_id: id, user_id: dto.userId, role: dto.role, protected_team_key: dto.protectedTeamKey, created_at: now(),
    }).execute();
    return { userId: dto.userId, role: dto.role };
  }

  @Patch('teams/:id/members/:userId')
  async setRole(@UserId() uid: string, @Param('id') id: string, @Param('userId') target: string, @Body() dto: RoleDto) {
    const myRole = await this.access.requireTeamRole(uid, id, 'admin');
    const current = await this.access.teamRole(target, id);
    if (!current) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found' });
    if (!atLeast(myRole, current) || !atLeast(myRole, dto.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not allowed for your role' });
    if (current === 'owner' && dto.role !== 'owner') await this.keepAnOwner(id, target);
    await this.db.updateTable('team_members').set({ role: dto.role }).where('team_id', '=', id).where('user_id', '=', target).execute();
    return { userId: target, role: dto.role };
  }

  /** Admins remove members; anyone may leave. */
  @Delete('teams/:id/members/:userId') @HttpCode(204)
  async removeMember(@UserId() uid: string, @Param('id') id: string, @Param('userId') target: string) {
    const current = await this.access.teamRole(target, id);
    if (target === uid) {
      if (!current) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    } else {
      const myRole = await this.access.requireTeamRole(uid, id, 'admin');
      if (!current) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found' });
      if (!atLeast(myRole, current)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not allowed for your role' });
    }
    if (current === 'owner') await this.keepAnOwner(id, target);
    await this.db.deleteFrom('team_members').where('team_id', '=', id).where('user_id', '=', target).execute();
  }

  private async keepAnOwner(teamId: string, leaving: string) {
    const others = await this.db.selectFrom('team_members').select('user_id')
      .where('team_id', '=', teamId).where('role', '=', 'owner').where('user_id', '!=', leaving).execute();
    if (!others.length) throw new BadRequestException({ code: 'LAST_OWNER', message: 'A team needs at least one owner' });
  }
}
