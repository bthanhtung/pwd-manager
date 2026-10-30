import { Controller, DynamicModule, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AccountController, SessionController } from './account/account.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CsrfGuard, Public, SessionGuard } from './common/guards';
import { SessionService } from './common/session.service';
import { AppConfig, CONFIG } from './config';
import { DatabaseModule } from './db/database.module';
import { AccessService } from './vault/access.service';
import { FoldersController } from './vault/folders.controller';
import { ItemsController } from './vault/items.controller';
import { SyncController } from './vault/sync.controller';
import { TeamsController } from './vault/teams.controller';

@ApiTags('meta')
@Controller()
class MetaController {
  constructor(@Inject(CONFIG) private config: AppConfig) {}
  @Public() @Get('health') health() { return { ok: true }; }
  /** What the web client needs to know about this server before sign-in. */
  @Public() @Get('config') config_() { return { signupsAllowed: this.config.signupsAllowed, version: '2.0.0' }; }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        { module: class ConfigHolder {}, global: true, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] },
        DatabaseModule,
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
      ],
      controllers: [MetaController, AuthController, SessionController, AccountController, SyncController, ItemsController, FoldersController, TeamsController],
      providers: [
        SessionService, AuthService, AccessService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    };
  }
}
