import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVaultDto {
  @ApiProperty({ example: 'Login Facebook' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'my-secret-password-123' })
  @IsString()
  @IsNotEmpty()
  plainTextValue: string; // Password thô, sẽ được CryptoService mã hóa trước khi lưu

  @ApiProperty({ example: '65f123456789...', required: false })
  @IsOptional()
  @IsMongoId()
  groupId?: string; // Nếu gửi lên thì pass này thuộc về Group, không thì là cá nhân
}
