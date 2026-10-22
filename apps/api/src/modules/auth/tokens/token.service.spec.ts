import { describe, expect, it } from 'vitest';

import { parseDurationToSeconds } from './token.service.js';

describe('parseDurationToSeconds', () => {
  it('converte segundos', () => {
    expect(parseDurationToSeconds('30')).toBe(30);
    expect(parseDurationToSeconds('30s')).toBe(30);
  });

  it('converte minutos', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
  });

  it('converte horas e dias', () => {
    expect(parseDurationToSeconds('2h')).toBe(7_200);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
  });

  it('converte milissegundos', () => {
    expect(parseDurationToSeconds('500ms')).toBe(0);
  });

  it('devolve zero para formato inválido', () => {
    expect(parseDurationToSeconds('sem-numero')).toBe(0);
  });
});
