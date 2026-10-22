import { canTransitionTo, ORDER_STATUS_TRANSITIONS } from '@naporta/contracts';
import type { OrderStatus } from '../../generated/prisma/client.js';

/**
 * As transições de status e a regra `canTransitionTo` moram no contrato
 * (`@naporta/contracts`): a API valida e o portal oferece as ações, e os
 * dois precisam concordar com o fluxo.
 */
export { canTransitionTo, ORDER_STATUS_TRANSITIONS };

/** Status a partir dos quais o pedido não pode mais mudar. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[status] ?? []).length === 0;
}
