import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { AddMemberDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(@InjectModel(Group.name) private groupModel: Model<GroupDocument>) {}

  async create(name: string, ownerId: string) {
    const newGroup = new this.groupModel({
      name,
      ownerId,
      members: [{ userId: ownerId, role: 'ADMIN' }],
    });
    return newGroup.save();
  }

  async addMember(groupId: string, adminId: string, memberDto: AddMemberDto) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    // Chỉ Owner hoặc Admin nhóm mới được thêm thành viên
    const isAdmin = group.members.some(m => m.userId.toString() === adminId && m.role === 'ADMIN');
    if (group.ownerId.toString() !== adminId && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền thêm thành viên');
    }

    group.members.push(memberDto as any);
    return group.save();
  }

  // Hàm quan trọng để kiểm tra quyền truy cập mật khẩu sau này
  async isUserInGroup(userId: string, groupId: string): Promise<boolean> {
    const group = await this.groupModel.findById(groupId);
    return group?.members.some(m => m.userId.toString() === userId) ?? false;
  }
}