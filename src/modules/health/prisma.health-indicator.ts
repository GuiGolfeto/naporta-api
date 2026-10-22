import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthCheckAttempt } from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Health indicator do banco de dados.
 *
 * Implementação própria (em vez do `PrismaHealthIndicator` do Terminus) para
 * não depender de uma API específica de versão, para usar `$queryRaw`
 * parametrizado e para expor a latência da consulta no payload.
 */
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Executa um `SELECT 1` no banco. Se a consulta falhar ou exceder o
   * timeout, o indicador é marcado como `down` e o Terminus responde 503.
   */
  pingCheck(key: string, timeoutMs = 1_000): HealthCheckAttempt {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        const startedAt = Date.now();

        try {
          await this.prisma.$queryRaw`SELECT 1`;
        } catch (error) {
          // O Prisma 7 propaga o código do driver (`ECONNREFUSED`, ...) com uma
          // mensagem pouco descritiva — devolvemos algo acionável.
          const code = extractErrorCode(error);

          throw new Error(
            code
              ? `Não foi possível conectar ao banco de dados (${code}).`
              : 'Não foi possível conectar ao banco de dados.',
            { cause: error },
          );
        }

        return { latencyMs: Date.now() - startedAt };
      })
      .withTimeout(timeoutMs);
  }
}

/** Extrai o código de erro do driver, quando existir. */
function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' && code.length > 0 ? code : undefined;
}
