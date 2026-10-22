import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
// Import como valor (e não `import type`): o Nest resolve a dependência pelo
// tipo emitido em `design:paramtypes`, que precisa do valor em runtime.
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Prefixo e máscara do número do pedido.
 *
 * Formato: `NP-AAAA-NNNNN` (ex.: `NP-2026-00001`).
 */
const ORDER_NUMBER_PREFIX = 'NP';
const ORDER_NUMBER_SEQUENCE_LENGTH = 5;

/** Monta o número do pedido a partir do ano e do sequencial. */
export function formatOrderNumber(year: number, sequence: number): string {
  return `${ORDER_NUMBER_PREFIX}-${year}-${String(sequence).padStart(ORDER_NUMBER_SEQUENCE_LENGTH, '0')}`;
}

/**
 * Executa consultas raw — o client estendido ou o client transacional.
 */
type RawQueryRunner = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Gera o próximo número de pedido.
 *
 * O sequencial é anual e atribuído com um *upsert atômico* no Postgres:
 *
 * ```sql
 * INSERT INTO order_counters (year, last_number) VALUES ($1, 1)
 * ON CONFLICT (year) DO UPDATE SET last_number = order_counters.last_number + 1
 * RETURNING last_number;
 * ```
 *
 * A instrução é atômica no nível do banco, portanto duas requisições
 * simultâneas nunca recebem o mesmo número — não é preciso lock explícito.
 *
 * Observação: a chamada deve ocorrer dentro da mesma transação da criação
 * do pedido (ver `OrdersService.create`), para que número e pedido sejam
 * gravados de forma consistente.
 */
@Injectable()
export class OrderNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserva (e devolve) o próximo número do pedido para o ano informado.
   *
   * @param year ano do contador — por padrão, o ano corrente
   * @param tx cliente transacional (opcional): reserva dentro da transação
   */
  async next(year: number = new Date().getFullYear(), tx?: RawQueryRunner): Promise<string> {
    const client: RawQueryRunner = tx ?? this.prisma.client;

    const rows = await client.$queryRaw<Array<{ last_number: number }>>`
      INSERT INTO order_counters (year, last_number)
      VALUES (${year}, 1)
      ON CONFLICT (year)
      DO UPDATE SET last_number = order_counters.last_number + 1
      RETURNING last_number
    `;

    const counter = rows[0];

    if (!counter) {
      throw new Error('Não foi possível gerar o número do pedido.');
    }

    return formatOrderNumber(year, counter.last_number);
  }
}
