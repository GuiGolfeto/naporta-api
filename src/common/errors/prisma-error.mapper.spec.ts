import { describe, expect, it } from 'vitest';

import { isPrismaKnownError, mapPrismaError } from './prisma-error.mapper.js';

describe('mapPrismaError', () => {
  it('traduz violação de unicidade em conflito (409)', () => {
    const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

    expect(mapPrismaError(error)).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('traduz registro não encontrado em 404', () => {
    const error = Object.assign(new Error('Record not found'), { code: 'P2025' });

    expect(mapPrismaError(error)).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('traduz violação de foreign key em requisição inválida (400)', () => {
    const error = Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' });

    expect(mapPrismaError(error)).toMatchObject({ statusCode: 400, error: 'Bad Request' });
  });

  it('traduz erro de conexão do driver em indisponibilidade (503)', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    expect(mapPrismaError(error)).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
    });
  });

  it('traduz os códigos de conexão do próprio Prisma em 503', () => {
    for (const code of ['P1001', 'P1002', 'P1008', 'P1017']) {
      const error = Object.assign(new Error('timeout'), { code });

      expect(mapPrismaError(error)).toMatchObject({ statusCode: 503 });
    }
  });

  it('devolve null para erros que não são do banco', () => {
    expect(mapPrismaError(new Error('erro qualquer'))).toBeNull();
    expect(mapPrismaError('string')).toBeNull();
    expect(mapPrismaError(undefined)).toBeNull();
  });

  it('devolve null para códigos desconhecidos do Prisma', () => {
    const error = Object.assign(new Error('desconhecido'), { code: 'P9999' });

    expect(mapPrismaError(error)).toBeNull();
  });
});

describe('isPrismaKnownError', () => {
  it('reconhece erros do Prisma e de conexão do driver', () => {
    expect(isPrismaKnownError(Object.assign(new Error('x'), { code: 'P2002' }))).toBe(true);
    expect(isPrismaKnownError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(true);
  });

  it('ignora erros comuns', () => {
    expect(isPrismaKnownError(new Error('x'))).toBe(false);
    expect(isPrismaKnownError(new TypeError('x'))).toBe(false);
    expect(isPrismaKnownError(null)).toBe(false);
  });
});
