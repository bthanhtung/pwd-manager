import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { VaultModule } from './vault/vault.module';

@Module({
  imports: [
    // 1. Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'], // look in backend/ then project root
    }),

    // 2. MongoDB connection via env
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),

    // 3. Feature modules
    AuthModule,
    GroupsModule,
    VaultModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
