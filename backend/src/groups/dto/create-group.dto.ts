import { IsString, IsNotEmpty, IsMongoId, IsEnum, IsOptional } from 'class-validator';

// create-group.dto.ts
export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

// add-member.dto.ts
export class AddMemberDto {
  @IsMongoId()
  userId: string;

  @IsEnum(['ADMIN', 'MEMBER'])
  @IsOptional()
  role?: string;
}