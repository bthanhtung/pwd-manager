import { BadRequestException, Body, ConflictException, Controller, Delete, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min, ValidateIf, ValidateNested } from 'class-validator';
import { UserId } from '../common/guards';
import { now } from '../common/session.service';
import { IsCipher, IsUuid, UUID_RE } from '../common/validators';
import { DB, Db } from '../db/database.module';
import { AccessService } from './access.service';

class CreateItemDto {
  @IsUuid() id: string;
  @IsCipher() data: string;
  @IsOptional() @ValidateIf(o => o.folderId !== null) @IsUuid() folderId?: string | null;
  @IsOptional() @ValidateIf(o => o.teamId !== null) @IsUuid() teamId?: string | null;
}
class UpdateItemDto {
  @IsCipher() data: string;
  @IsOptional() @ValidateIf(o => o.folderId !== null) @IsUuid() folderId?: string | null;
  @IsInt() @Min(1) revision: number;
}
class ImportDto {
  @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => CreateItemDto) items: CreateItemDto[];
}
const ITEM_FIELDS = ['id', 'user_id', 'team_id', 'folder_id', 'data', 'revision', 'deleted_at', 'created_at', 'updated_at'] as const;
export const itemOut = (i: Record<(typeof ITEM_FIELDS)[number], any>) => ({
  id: i.id, teamId: i.team_id, folderId: i.folder_id, data: i.data, revision: i.revision,
  deletedAt: i.deleted_at, createdAt: i.created_at, updatedAt: i.updated_at,
});

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(@Inject(DB) private db: Db, private access: AccessService) {}

  private async prepare(userId: string, dto: CreateItemDto) {
    if (dto.teamId) {
      await this.access.requireTeamRole(userId, dto.teamId, 'editor');
      if (dto.folderId) throw new BadRequestException({ code: 'BAD_FOLDER', message: 'Team items cannot use personal folders' });
    } else await this.access.requireFolder(userId, dto.folderId);
    const t = now();
    return {
      id: dto.id.toLowerCase(), user_id: dto.teamId ? null : userId, team_id: dto.teamId ?? null, folder_id: dto.folderId ?? null,
      data: dto.data, revision: 1, deleted_at: null, created_at: t, updated_at: t,
    };
  }

  @Post()
  async create(@UserId() uid: string, @Body() dto: CreateItemDto) {
    const row = await this.prepare(uid, dto);
    const exists = await this.db.selectFrom('items').select('id').where('id', '=', row.id).executeTakeFirst();
    if (exists) throw new ConflictException({ code: 'ITEM_EXISTS', message: 'Item id already used' });
    await this.db.insertInto('items').values(row).execute();
    return itemOut(row);
  }

  /** Bulk insert for imports; all-or-nothing. */
  @Post('import')
  async import(@UserId() uid: string, @Body() dto: ImportDto) {
    const rows: Awaited<ReturnType<ItemsController['prepare']>>[] = [];
    for (const it of dto.items) rows.push(await this.prepare(uid, it));
    const ids = rows.map(r => r.id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException({ code: 'DUPLICATE_IDS', message: 'Duplicate item ids' });
    await this.db.transaction().execute(async trx => {
      for (let i = 0; i < rows.length; i += 200) await trx.insertInto('items').values(rows.slice(i, i + 200)).execute();
    });
    return { imported: rows.length };
  }

  /** Optimistic concurrency: the client sends the revision it edited; a stale edit gets 409. */
  @Put(':id')
  async update(@UserId() uid: string, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    if (!UUID_RE.test(id)) throw new BadRequestException();
    const item = await this.access.item(uid, id, true);
    if (item.revision !== dto.revision) throw new ConflictException({ code: 'STALE', message: 'This item changed on another device', current: itemOut(item) });
    if (item.user_id) await this.access.requireFolder(uid, dto.folderId);
    const patch = {
      data: dto.data, folder_id: item.user_id ? dto.folderId ?? null : null, revision: item.revision + 1, updated_at: now(),
    };
    await this.db.updateTable('items').set(patch).where('id', '=', id).execute();
    return itemOut({ ...item, ...patch });
  }

  @Delete(':id') @HttpCode(200)
  async trash(@UserId() uid: string, @Param('id') id: string) {
    const item = await this.access.item(uid, id, true);
    const patch = { deleted_at: now(), updated_at: now(), revision: item.revision + 1 };
    await this.db.updateTable('items').set(patch).where('id', '=', id).execute();
    return itemOut({ ...item, ...patch });
  }

  @Post(':id/restore') @HttpCode(200)
  async restore(@UserId() uid: string, @Param('id') id: string) {
    const item = await this.access.item(uid, id, true);
    const patch = { deleted_at: null, updated_at: now(), revision: item.revision + 1 };
    await this.db.updateTable('items').set(patch).where('id', '=', id).execute();
    return itemOut({ ...item, ...patch });
  }

  @Delete(':id/permanent') @HttpCode(204)
  async destroy(@UserId() uid: string, @Param('id') id: string) {
    await this.access.item(uid, id, true);
    await this.db.deleteFrom('items').where('id', '=', id).execute();
  }
}
