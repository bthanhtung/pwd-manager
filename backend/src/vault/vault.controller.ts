import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VaultService } from './vault.service';
import { CreateVaultDto } from './dto/create-vault.dto';

@Controller('vault')
@UseGuards(JwtAuthGuard) // Bắt buộc phải login
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post()
  async create(@Body() createVaultDto: CreateVaultDto, @Req() req) {
    // req.user.id lấy từ JWT sau khi login thành công
    return this.vaultService.create(createVaultDto, req.user.id);
  }

  @Get()
  async getMyPasswords(@Req() req) {
    return this.vaultService.findAllForUser(req.user.id);
  }
}
