import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { profileOf } from '../auth/auth.service';
import { UserId } from '../common/guards';
import { DB, Db } from '../db/database.module';
import { folderOut } from './folders.controller';
import { itemOut } from './items.controller';

/** Everything the client needs to rebuild its local vault, in one round trip. All payloads are ciphertext. */
@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(@Inject(DB) private db: Db) {}

  @Get()
  async sync(@UserId() uid: string) {
    const [user, folders, teams] = await Promise.all([
      this.db.selectFrom('users').selectAll().where('id', '=', uid).executeTakeFirstOrThrow(),
      this.db.selectFrom('folders').selectAll().where('user_id', '=', uid).execute(),
      this.db.selectFrom('team_members').innerJoin('teams', 'teams.id', 'team_members.team_id')
        .select(['teams.id as id', 'teams.data as data', 'team_members.role as role', 'team_members.protected_team_key as protectedTeamKey',
          'teams.created_at as createdAt', 'teams.updated_at as updatedAt'])
        .where('team_members.user_id', '=', uid).execute(),
    ]);
    const teamIds = teams.map(t => t.id);
    let q = this.db.selectFrom('items').selectAll().where('user_id', '=', uid);
    if (teamIds.length) q = this.db.selectFrom('items').selectAll().where(eb => eb.or([eb('user_id', '=', uid), eb('team_id', 'in', teamIds)]));
    const items = await q.execute();
    return { profile: profileOf(user), folders: folders.map(folderOut), teams, items: items.map(itemOut), serverTime: new Date().toISOString() };
  }
}
