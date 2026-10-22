import { Injectable } from '@nestjs/common';

// Import como valor (e não `import type`): o Nest resolve a dependência pelo
// tipo emitido em `design:paramtypes`, que precisa do valor em runtime.
import { PrismaService } from '../prisma/prisma.service.js';
import { nextOrderNumber } from './order-number.js';
import type { OrderNumberStore } from './order-number.js';

export { formatOrderNumber } from './order-number.js';

/**
 * Gera o próximo número de pedido.
 *
 * O sequencial é anual e atribuído com um *upsert atômico* no Postgres
 * (ver `order-number.ts`).
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
  next(year?: number, tx?: OrderNumberStore): Promise<string> {
    return nextOrderNumber(tx ?? this.prisma.client, year);
  }
}
