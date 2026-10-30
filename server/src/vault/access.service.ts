import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DB, Db } from '../db/database.module';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

/** One place that answers "may this user do that?" so controllers never re-implement it. */
@Injectable()
export class AccessService {
  constructor(@Inject(DB) private db: Db) {}

  async teamRole(userId: string, teamId: string): Promise<Role | null> {
    const m = await this.db.selectFrom('team_members').select('role')
      .where('team_id', '=', teamId).where('user_id', '=', userId).executeTakeFirst();
    return (m?.role as Role) ?? null;
  }

  async requireTeamRole(userId: string, teamId: string, min: Role): Promise<Role> {
    const role = await this.teamRole(userId, teamId);
    // Non-members get 404 so team ids cannot be probed.
    if (!role) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    if (!atLeast(role, min)) throw new ForbiddenException({ code: 'FORBIDDEN', message: `Requires ${min} role` });
    return role;
  }

  /** Loads an item the user can see; with `write`, also requires permission to change it. */
  async item(userId: string, itemId: string, write: boolean) {
    const item = await this.db.selectFrom('items').selectAll().where('id', '=', itemId).executeTakeFirst();
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Item not found' });
    if (item.user_id) {
      if (item.user_id !== userId) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Item not found' });
    } else if (item.team_id) {
      await this.requireTeamRole(userId, item.team_id, write ? 'editor' : 'viewer');
    }
    return item;
  }

  async requireFolder(userId: string, folderId: string | null | undefined) {
    if (!folderId) return;
    const f = await this.db.selectFrom('folders').select('id').where('id', '=', folderId).where('user_id', '=', userId).executeTakeFirst();
    if (!f) throw new NotFoundException({ code: 'FOLDER_NOT_FOUND', message: 'Folder not found' });
  }
}
