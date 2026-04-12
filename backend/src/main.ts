// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // 👈 Enable CORS for frontend requests

  // 1. Tự động validate dữ liệu theo DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Xóa bỏ các field thừa không có trong DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 2. Setup Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Open Pass Manager API')
    .setDescription('Hệ thống quản lý mật khẩu an toàn cho đội nhóm')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
}
bootstrap();
