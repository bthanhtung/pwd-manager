// backend/src/vault/schemas/vault.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type VaultDocument = HydratedDocument<Vault>;

@Schema({ timestamps: true })
export class Vault {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  encryptedData: string;

  @Prop({ required: true })
  iv: string;

  @Prop({ required: true })
  tag: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Group', default: null })
  groupId: string;
}

export const VaultSchema = SchemaFactory.createForClass(Vault);