import { Body, ConflictException, Controller, Delete, HttpCode, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserId } from '../common/guards';
import { now } from '../common/session.service';
import { IsCipher, IsUuid } from '../common/validators';
import { DB, Db } from '../db/database.module';

class CreateFolderDto { @IsUuid() id: string; @IsCipher(2000) data: string; }
class UpdateFolderDto { @IsCipher(2000) data: string; }
export const folderOut = (f: { id: string; data: string; created_at: string; updated_at: string }) =>
  ({ id: f.id, data: f.data, createdAt: f.created_at, updatedAt: f.updated_at });

@ApiTags('folders')
@Controller('folders')
export class FoldersController {
  constructor(@Inject(DB) private db: Db) {}

  @Post()
  async create(@UserId() uid: string, @Body() dto: CreateFolderDto) {
    const id = dto.id.toLowerCase();
    if (await this.db.selectFrom('folders').select('id').where('id', '=', id).executeTakeFirst()) {
      throw new ConflictException({ code: 'FOLDER_EXISTS', message: 'Folder id already used' });
    }
    const t = now();
    const row = { id, user_id: uid, data: dto.data, created_at: t, updated_at: t };
    await this.db.insertInto('folders').values(row).execute();
    return folderOut(row);
  }

  @Put(':id')
  async rename(@UserId() uid: string, @Param('id') id: string, @Body() dto: UpdateFolderDto) {
    const r = await this.db.updateTable('folders').set({ data: dto.data, updated_at: now() })
      .where('id', '=', id).where('user_id', '=', uid).executeTakeFirst();
    if (!Number(r.numUpdatedRows)) throw new NotFoundException({ code: 'FOLDER_NOT_FOUND', message: 'Folder not found' });
    const f = await this.db.selectFrom('folders').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    return folderOut(f);
  }

  /** Items inside move back to "no folder"; nothing is deleted. */
  @Delete(':id') @HttpCode(204)
  async remove(@UserId() uid: string, @Param('id') id: string) {
    await this.db.transaction().execute(async trx => {
      const r = await trx.deleteFrom('folders').where('id', '=', id).where('user_id', '=', uid).executeTakeFirst();
      if (!Number(r.numDeletedRows)) throw new NotFoundException({ code: 'FOLDER_NOT_FOUND', message: 'Folder not found' });
      await trx.updateTable('items').set({ folder_id: null }).where('folder_id', '=', id).where('user_id', '=', uid).execute();
    });
  }
}
