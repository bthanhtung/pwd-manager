import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: string;

  constructor(private configService: ConfigService) {
    // Lấy key từ file .env (phải đủ 32 ký tự cho aes-256)
    this.masterKey = this.configService.get<string>('SERVER_ENCRYPTION_KEY')!;
  }

  async encrypt(text: string): Promise<{ encryptedData: string; iv: string; tag: string }> {
    const iv = randomBytes(12); // Vector khởi tạo
    const cipher = createCipheriv(this.algorithm, Buffer.from(this.masterKey), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex'); // Auth tag để chống giả mạo dữ liệu

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      tag: tag,
    };
  }

  decrypt(encryptedData: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      this.algorithm,
      Buffer.from(this.masterKey),
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}