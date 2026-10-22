import { describe, expect, it } from 'vitest';

import { DEV_JWT_SECRET, validateEnv } from './env.validation.js';

const MINIMAL_ENV = {
  NODE_ENV: 'development',
  PORT: '3000',
  API_PREFIX: 'api',
  API_VERSION: '1',
  DATABASE_URL: 'postgresql://naporta:naporta_dev_password@localhost:5432/naporta',
  JWT_SECRET: DEV_JWT_SECRET,
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'dev-only-refresh-secret-change-me-0123456789',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGINS: 'http://localhost:3000',
  THROTTLE_TTL: '60000',
  THROTTLE_LIMIT: '100',
  LOG_LEVEL: 'info',
};

describe('validateEnv', () => {
  it('devolve o ambiente validado com os valores convertidos', () => {
    const env = validateEnv({ ...MINIMAL_ENV });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.THROTTLE_TTL).toBe(60_000);
    expect(env.THROTTLE_LIMIT).toBe(100);
  });

  it('aplica os defaults quando as variáveis opcionais não existem', () => {
    const env = validateEnv({});

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.API_PREFIX).toBe('api');
    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('rejeita uma DATABASE_URL que não é uma URI do PostgreSQL', () => {
    expect(() => validateEnv({ ...MINIMAL_ENV, DATABASE_URL: 'nao-e-uma-uri' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  it('rejeita uma porta fora do intervalo válido', () => {
    expect(() => validateEnv({ ...MINIMAL_ENV, PORT: '70000' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  it('rejeita um segredo mais curto que 32 caracteres', () => {
    expect(() => validateEnv({ ...MINIMAL_ENV, JWT_SECRET: 'curto' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  it('rejeita um NODE_ENV desconhecido', () => {
    expect(() => validateEnv({ ...MINIMAL_ENV, NODE_ENV: 'staging' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  it('exige segredos explícitos em produção', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '3000',
        // Sem DATABASE_URL, JWT_SECRET e JWT_REFRESH_SECRET.
      }),
    ).toThrow(/são obrigatórias em produção/);
  });

  it('rejeita segredos de desenvolvimento em produção', () => {
    expect(() =>
      validateEnv({
        ...MINIMAL_ENV,
        NODE_ENV: 'production',
        JWT_SECRET: DEV_JWT_SECRET,
        JWT_REFRESH_SECRET: 'outro-segredo-de-producao-bem-seguro-123456',
      }),
    ).toThrow(/segredos de desenvolvimento não podem ser usados/);
  });

  it('rejeita segredos de acesso e refresh idênticos em produção', () => {
    expect(() =>
      validateEnv({
        ...MINIMAL_ENV,
        NODE_ENV: 'production',
        JWT_SECRET: 'segredo-de-producao-acessivel-suficientemente-longo',
        JWT_REFRESH_SECRET: 'segredo-de-producao-acessivel-suficientemente-longo',
      }),
    ).toThrow(/devem ser diferentes entre si/);
  });
});
