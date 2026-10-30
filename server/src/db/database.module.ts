import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import { AppConfig, CONFIG, sqlitePath } from '../config';
import { Database, migrate } from './schema';

export const DB = Symbol('DB');
export type Db = Kysely<Database>;

export async function createDb(databaseUrl: string): Promise<Db> {
  let db: Db;
  if (/^postgres(ql)?:\/\//.test(databaseUrl)) {
    const { Pool } = await import('pg');
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseUrl, max: 10 }) }) });
  } else {
    const BetterSqlite = (await import('better-sqlite3')).default;
    const file = sqlitePath(databaseUrl);
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    const sqlite = new BetterSqlite(file);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    db = new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
  }
  await migrate(db);
  return db;
}

@Global()
@Module({
  providers: [{ provide: DB, inject: [CONFIG], useFactory: (c: AppConfig) => createDb(c.databaseUrl) }],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db) {}
  async onApplicationShutdown() { await this.db.destroy(); }
}
