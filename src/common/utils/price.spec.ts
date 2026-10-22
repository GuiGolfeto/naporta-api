import { describe, expect, it } from 'vitest';

import { parsePrice, priceToNumber, toPriceString } from './price.js';

describe('toPriceString', () => {
  it('normaliza números para string', () => {
    expect(toPriceString(49.9)).toBe('49.9');
    expect(toPriceString(49)).toBe('49');
    expect(toPriceString(0)).toBe('0');
  });

  it('preserva strings já normalizadas', () => {
    expect(toPriceString('49.90')).toBe('49.90');
    expect(toPriceString(' 49.90 ')).toBe('49.90');
  });

  it('não arredonda silenciosamente (valores com mais de 2 casas são rejeitados)', () => {
    expect(toPriceString(49.905)).toBe('49.905');
  });

  it('devolve string vazia para valores inválidos', () => {
    expect(toPriceString('abc')).toBe('abc');
    expect(toPriceString(Number.NaN)).toBe('');
    expect(toPriceString(null)).toBe('');
    expect(toPriceString(undefined)).toBe('');
  });
});

describe('parsePrice', () => {
  it('mantém a precisão decimal', () => {
    expect(parsePrice('49.90').toString()).toBe('49.9');
    expect(parsePrice('0.10').toString()).toBe('0.1');
    expect(parsePrice('1234.56').toString()).toBe('1234.56');
  });

  it('arredonda para 2 casas', () => {
    expect(parsePrice('10.005').toDecimalPlaces(2).toString()).toBe('10.01');
  });

  it('evita o erro de ponto flutante', () => {
    // 0.1 + 0.2 em float é 0.30000000000000004; em decimal, 0.30.
    const total = parsePrice('0.1').plus(parsePrice('0.2'));

    expect(total.toString()).toBe('0.3');
    expect(total.toFixed(2)).toBe('0.30');
  });
});

describe('priceToNumber', () => {
  it('converte para number com 2 casas', () => {
    expect(priceToNumber(parsePrice('49.90'))).toBe(49.9);
    expect(priceToNumber(parsePrice('0.10'))).toBe(0.1);
  });
});
