import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  configureApp(app);

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  // `trust proxy` define quantos proxies à frente são confiáveis para o IP do
  // cliente. Padrão 0 (não confiar em `X-Forwarded-For`): com a API exposta
  // diretamente, um cliente poderia forjar o header e escapar do rate limit.
  // Ao publicar atrás de um proxy reverso, configure `TRUST_PROXY=1`.
  const trustProxy = configService.getOrThrow<number>('http.trustProxy');
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', trustProxy);

  const port = configService.getOrThrow<number>('app.port');
  const apiPrefix = configService.getOrThrow<string>('app.apiPrefix');
  const apiVersion = configService.getOrThrow<string>('app.apiVersion');

  await app.listen(port, '0.0.0.0');

  app
    .get(PinoLogger)
    .log(`naPorta API no ar em http://localhost:${port}/${apiPrefix}/v${apiVersion}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar a aplicação:', error);
  process.exit(1);
});
