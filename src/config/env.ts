/**
 * Tipos do ambiente de execução.
 *
 * A validação (e a normalização) acontece em `env.validation.ts`; este arquivo
 * descreve o formato esperado depois de validado.
 */

export type NodeEnv = 'development' | 'test' | 'production';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface ValidatedEnv {
  NODE_ENV: NodeEnv;
  PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  DATABASE_URL: string;
  DATABASE_URL_TEST?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CORS_ORIGINS: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  LOG_LEVEL: LogLevel;
}

/** Ambiente cru, ainda não validado (usado para checar o que foi explícito). */
export type RawEnv = Record<string, unknown>;
