import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ _id: false })
export class GroupMember {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' })
  role: string;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: string;

  @Prop({ type: [GroupMemberSchema], default: [] })
  members: GroupMember[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
