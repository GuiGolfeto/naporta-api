import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { calculateTotal, calculateTotalFrom } from './orders.service.js';

describe('calculateTotal', () => {
  it('soma os itens (preço unitário × quantidade)', () => {
    const total = calculateTotal([
      { quantity: 2, unitPrice: '49.90' },
      { quantity: 1, unitPrice: '5.50' },
    ]);

    expect(total.toString()).toBe('105.3');
  });

  it('não acumula erro de ponto flutante', () => {
    const total = calculateTotal([
      { quantity: 3, unitPrice: '0.10' },
      { quantity: 1, unitPrice: '0.20' },
    ]);

    expect(total.toString()).toBe('0.5');
    expect(total.toFixed(2)).toBe('0.50');
  });

  it('devolve zero para uma lista vazia', () => {
    expect(calculateTotal([]).toString()).toBe('0');
  });

  it('arredonda o preço unitário para 2 casas antes de multiplicar', () => {
    // O preço unitário é arredondado para 2 casas (10.005 → 10.01) e só então
    // multiplicado pela quantidade — é o mesmo que acontece na coluna
    // `Decimal(12,2)` do banco. (Pela API esse caso não chega: o DTO exige
    // no máximo 2 casas decimais.)
    const total = calculateTotal([{ quantity: 3, unitPrice: '10.005' }]);

    expect(total.toFixed(2)).toBe('30.03');
  });
});

describe('calculateTotalFrom', () => {
  it('soma itens já convertidos em Decimal', () => {
    const total = calculateTotalFrom([
      { quantity: 2, unitPrice: new Prisma.Decimal('19.99') },
      { quantity: 3, unitPrice: new Prisma.Decimal('5.50') },
      { quantity: 1, unitPrice: new Prisma.Decimal('0.01') },
    ]);

    expect(total.toFixed(2)).toBe('56.49');
  });
});
