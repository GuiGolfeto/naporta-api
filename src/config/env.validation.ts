import Joi from 'joi';

import type { LogLevel, NodeEnv, RawEnv, ValidatedEnv } from './env.js';

/**
 * Valores de desenvolvimento.
 *
 * Permitem rodar a API sem `.env` (clone novo, `npm run dev`).
 * Em `production` a validação recusa explicitamente o uso deles.
 */
export const DEV_DATABASE_URL = 'postgresql://naporta:naporta_dev_password@localhost:5432/naporta';
export const DEV_JWT_SECRET = 'dev-only-access-secret-change-me-0123456789';
export const DEV_JWT_REFRESH_SECRET = 'dev-only-refresh-secret-change-me-0123456789';

const NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];
const LOG_LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * Schema de validação do ambiente.
 *
 * Roda ANTES do container de DI subir: se algo estiver errado, a aplicação
 * morre imediatamente com uma mensagem explícita, em vez de falhar depois
 * na primeira requisição.
 */
export const envValidationSchema = Joi.object<ValidatedEnv>({
  NODE_ENV: Joi.string()
    .valid(...NODE_ENVS)
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().min(1).default('api'),
  API_VERSION: Joi.string().trim().min(1).default('1'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .default(DEV_DATABASE_URL),
  DATABASE_URL_TEST: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .optional(),

  JWT_SECRET: Joi.string().min(32).default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: Joi.string().trim().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).default(DEV_JWT_REFRESH_SECRET),
  JWT_REFRESH_EXPIRES_IN: Joi.string().trim().default('7d'),

  CORS_ORIGINS: Joi.string().trim().default('http://localhost:3000'),
  // Quantos proxies à frente da API são confiáveis para o IP do cliente.
  // 0 = não confiar em X-Forwarded-For (padrão seguro quando a API é
  // exposta diretamente); 1 = há um proxy reverso (nginx) à frente.
  TRUST_PROXY: Joi.number().integer().min(0).max(10).default(0),
  THROTTLE_TTL: Joi.number().integer().min(1000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  AUTH_THROTTLE_TTL: Joi.number().integer().min(1000).default(60_000),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(5),

  LOG_LEVEL: Joi.string()
    .valid(...LOG_LEVELS)
    .default('info'),
  LOG_FORMAT: Joi.string().valid('pretty', 'json').default('json'),
}).unknown(true);

/**
 * Valida e normaliza o ambiente.
 *
 * @param config ambiente bruto (arquivo `.env` + variáveis do processo)
 * @returns o ambiente validado, já com defaults aplicados
 * @throws Error com a lista de problemas encontrados
 */
export function validateEnv(config: RawEnv): ValidatedEnv {
  const result = envValidationSchema.validate(config, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  });

  if (result.error) {
    const details = result.error.details.map((detail) => `  - ${detail.message}`).join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }

  const validated = toValidatedEnv(result.value);

  assertProductionEnv(config, validated);

  return validated;
}

/**
 * O Joi tipa o resultado da validação como `any`; esta função é o único
 * ponto onde confiamos no schema para afirmar o tipo do ambiente.
 */
function toValidatedEnv(value: unknown): ValidatedEnv {
  return value as ValidatedEnv;
}

/**
 * Regras extras aplicadas apenas em produção.
 *
 * Em desenvolvimento usamos defaults para facilitar o setup; em produção
 * exigimos que o operador configure os segredos explicitamente.
 */
function assertProductionEnv(raw: RawEnv, env: ValidatedEnv): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];
  if (!raw.DATABASE_URL) missing.push('DATABASE_URL');
  if (!raw.JWT_SECRET) missing.push('JWT_SECRET');
  if (!raw.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n  - as variáveis ${missing.join(', ')} são obrigatórias em produção`,
    );
  }

  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      'Configuração de ambiente inválida:\n  - JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes entre si',
    );
  }

  if (env.JWT_SECRET === DEV_JWT_SECRET || env.JWT_REFRESH_SECRET === DEV_JWT_REFRESH_SECRET) {
    throw new Error(
      'Configuração de ambiente inválida:\n  - os segredos de desenvolvimento não podem ser usados em produção',
    );
  }
}
