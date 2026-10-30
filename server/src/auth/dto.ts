import { Type } from 'class-transformer';
import { Equals, IsEmail, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { B64URL_RE, IsCipher } from '../common/validators';

export class KdfDto {
  @Equals('argon2id') alg: 'argon2id';
  @Matches(B64URL_RE) @Length(22, 64) salt: string;
  @IsInt() @Min(19_456) @Max(1_048_576) memory: number;     // KiB (OWASP minimum 19 MiB)
  @IsInt() @Min(2) @Max(20) iterations: number;
  @IsInt() @Min(1) @Max(8) parallelism: number;
}

export class EmailDto {
  @IsEmail() @MaxLength(320) email: string;
}

export class RegisterDto {
  @IsEmail() @MaxLength(320) email: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @Matches(B64URL_RE) @Length(43, 43) authKey: string;       // 32 bytes, derived client-side
  @ValidateNested() @Type(() => KdfDto) kdf: KdfDto;
  @IsCipher(400) protectedUserKey: string;
  @Matches(B64URL_RE) @Length(80, 200) publicKey: string;
  @IsCipher(2000) protectedPrivateKey: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(320) email: string;
  @Matches(B64URL_RE) @Length(43, 43) authKey: string;
  @IsOptional() @Matches(/^\d{6}$/) totp?: string;
}
