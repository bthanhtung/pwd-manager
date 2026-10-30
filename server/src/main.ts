import 'reflect-metadata';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AppConfig, loadConfig } from './config';

/** Shared by main() and the e2e tests so both run the exact same HTTP pipeline. */
export function configureApp(app: INestApplication, config: AppConfig) {
  const http = app as NestExpressApplication;
  if (config.trustProxy) http.set('trust proxy', 1);
  http.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'wasm-unsafe-eval'"],   // Argon2 runs as WebAssembly in the browser
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'https://api.pwnedpasswords.com'],
        'upgrade-insecure-requests': config.secureCookies ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

function serveWeb(app: NestExpressApplication, dir: string) {
  if (!existsSync(join(dir, 'index.html'))) return;
  app.useStaticAssets(dir, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, path) => {
    // index.html, the service worker and the manifest must always be revalidated
    if (/(index\.html|sw\.js|manifest\.webmanifest|registerSW\.js)$/.test(path)) res.setHeader('Cache-Control', 'no-cache');
  } });
  // Single-page app: every non-API GET falls back to index.html.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dir, 'index.html'));
  });
}

async function main() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { bufferLogs: false });
  configureApp(app, config);
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('OpenPass API').setDescription('Zero-knowledge password manager. Every vault payload is client-side ciphertext.')
    .setVersion('2.0.0').addCookieAuth('op_session').build());
  SwaggerModule.setup('api/docs', app, doc);
  serveWeb(app, config.webDir);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`OpenPass listening on ${config.appUrl} (db: ${config.databaseUrl.split(':')[0]})`, 'Bootstrap');
}

if (require.main === module) main();
