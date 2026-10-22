import { OrderStatus } from '../../generated/prisma/client.js';

/**
 * Transições de status permitidas.
 *
 * O fluxo normal é PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED.
 * `CANCELLED` é alcançável a partir de qualquer etapa não terminal
 * (um pedido em trânsito pode ser cancelado).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * A transição de status é permitida?
 *
 * Manter o mesmo status é permitido (a operação é um no-op idempotente).
 * Status terminais (`DELIVERED`, `CANCELLED`) não aceitam mais nada.
 */
export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }

  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/** Status a partir dos quais o pedido não pode mais mudar. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[status] ?? []).length === 0;
}
