import { describe, expect, it } from 'vitest';

import { OrderStatus } from '../../generated/prisma/client.js';
import { canTransitionTo, isTerminalStatus } from './order-status.js';

describe('canTransitionTo', () => {
  it('permite o fluxo normal do pedido', () => {
    expect(canTransitionTo(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransitionTo(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransitionTo(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransitionTo(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('permite cancelar a partir de qualquer etapa não terminal', () => {
    expect(canTransitionTo(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionTo(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionTo(OrderStatus.PROCESSING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionTo(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(true);
  });

  it('impede pular etapas do fluxo', () => {
    expect(canTransitionTo(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransitionTo(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    expect(canTransitionTo(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(false);
  });

  it('impede voltar etapas', () => {
    expect(canTransitionTo(OrderStatus.DELIVERED, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransitionTo(OrderStatus.PROCESSING, OrderStatus.CONFIRMED)).toBe(false);
    expect(canTransitionTo(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
  });

  it('não altera status terminais', () => {
    expect(canTransitionTo(OrderStatus.DELIVERED, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransitionTo(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransitionTo(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransitionTo(OrderStatus.CANCELLED, OrderStatus.DELIVERED)).toBe(false);
  });

  it('trata repetir o mesmo status como operação idempotente', () => {
    expect(canTransitionTo(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(true);
    expect(canTransitionTo(OrderStatus.SHIPPED, OrderStatus.SHIPPED)).toBe(true);
  });
});

describe('isTerminalStatus', () => {
  it('identifica os status finais do fluxo', () => {
    expect(isTerminalStatus(OrderStatus.DELIVERED)).toBe(true);
    expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
  });

  it('identifica os status intermediários', () => {
    expect(isTerminalStatus(OrderStatus.PENDING)).toBe(false);
    expect(isTerminalStatus(OrderStatus.CONFIRMED)).toBe(false);
    expect(isTerminalStatus(OrderStatus.PROCESSING)).toBe(false);
    expect(isTerminalStatus(OrderStatus.SHIPPED)).toBe(false);
  });
});
