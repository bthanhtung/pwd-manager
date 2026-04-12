import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vault, VaultDocument } from './schemas/vault.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { CryptoService } from '../common/crypto.service';
import { CreateVaultDto } from './dto/create-vault.dto';

@Injectable()
export class VaultService {
  constructor(
    @InjectModel(Vault.name) private vaultModel: Model<VaultDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private cryptoService: CryptoService,
  ) {}

  async create(createVaultDto: CreateVaultDto, userId: string) {
    // 1. Mã hóa password/token thực tế
    const { encryptedData, iv, tag } = await this.cryptoService.encrypt(createVaultDto.plainTextValue);

    // 2. Lưu vào DB
    const newVault = new this.vaultModel({
      title: createVaultDto.title,
      encryptedData,
      iv,
      tag,
      ownerId: userId,
      groupId: createVaultDto.groupId || null,
    });

    return newVault.save();
  }

  async findAllForUser(userId: string) {
    // 1. Lấy danh sách ID các nhóm mà user là thành viên
    const userGroups = await this.groupModel.find({ 'members.userId': userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    // 2. Query: Lấy pass mà mình là chủ sở hữu HOẶC thuộc về nhóm mình tham gia
    return this.vaultModel.find({
      $or: [
        { ownerId: userId },
        { groupId: { $in: groupIds } }
      ]
    }).sort({ createdAt: -1 }).exec();
  }
}