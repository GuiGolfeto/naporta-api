import { describe, expect, it } from 'vitest';

import { formatOrderNumber } from './order-number.service.js';

describe('formatOrderNumber', () => {
  it('formata o número no padrão NP-AAAA-NNNNN', () => {
    expect(formatOrderNumber(2026, 1)).toBe('NP-2026-00001');
  });

  it('completa com zeros à esquerda', () => {
    expect(formatOrderNumber(2026, 42)).toBe('NP-2026-00042');
    expect(formatOrderNumber(2026, 999)).toBe('NP-2026-00999');
  });

  it('preserva números com cinco dígitos', () => {
    expect(formatOrderNumber(2026, 12345)).toBe('NP-2026-12345');
  });
});
