import { registerAs } from '@nestjs/config';

/**
 * Configurações tipadas, agrupadas por namespace.
 *
 * `ConfigService.getOrThrow('app.port')` — o `getOrThrow` garante que a
 * aplicação não rode com uma configuração incompleta.
 *
 * Os valores vêm de `process.env`, que já foi normalizado pela validação
 * de ambiente (defaults aplicados) antes deste módulo ser instanciado.
 */
export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiVersion: process.env.API_VERSION ?? '1',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  urlTest: process.env.DATABASE_URL_TEST,
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const httpConfig = registerAs('http', () => ({
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  throttleTtl: Number(process.env.THROTTLE_TTL ?? 60_000),
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 100),
}));

export const loggerConfig = registerAs('logger', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
}));

export const configuration = [appConfig, databaseConfig, authConfig, httpConfig, loggerConfig];
