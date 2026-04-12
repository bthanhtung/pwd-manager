import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vault, VaultSchema } from './schemas/vault.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { CryptoService } from '../common/crypto.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vault.name, schema: VaultSchema }]),
    MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
    AuthModule,
  ],
  controllers: [VaultController],
  providers: [VaultService, CryptoService],
})
export class VaultModule {}
