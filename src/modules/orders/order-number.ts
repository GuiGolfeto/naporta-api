import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Prefixo e máscara do número do pedido.
 *
 * Formato: `NP-AAAA-NNNNN` (ex.: `NP-2026-00001`).
 */
export const ORDER_NUMBER_PREFIX = 'NP';
export const ORDER_NUMBER_SEQUENCE_LENGTH = 5;

/** Monta o número do pedido a partir do ano e do sequencial. */
export function formatOrderNumber(year: number, sequence: number): string {
  return `${ORDER_NUMBER_PREFIX}-${year}-${String(sequence).padStart(ORDER_NUMBER_SEQUENCE_LENGTH, '0')}`;
}

/**
 * Executa consultas raw — o client estendido ou o client transacional.
 */
export type OrderNumberStore = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Reserva o próximo número de pedido de um ano.
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
 */
export async function nextOrderNumber(
  store: OrderNumberStore,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const rows = await store.$queryRaw<Array<{ last_number: number }>>`
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
