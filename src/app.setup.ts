import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuração compartilhada entre o bootstrap (`main.ts`) e os testes e2e.
 *
 * Fonte única de verdade: evita que a aplicação se comporte de um jeito em
 * desenvolvimento e de outro nos testes.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.getOrThrow<string>('app.apiPrefix'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.getOrThrow<string>('app.apiVersion'),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Remove properties que não estão declaradas no DTO.
      whitelist: true,
      // Rejeita a requisição quando chega property desconhecida.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validateCustomDecorators: true,
    }),
  );

  const corsOrigins = configService.getOrThrow<string[]>('http.corsOrigins');

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 3600,
  });
}
