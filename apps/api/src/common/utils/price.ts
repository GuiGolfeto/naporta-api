import { Prisma } from '../../generated/prisma/client.js';

/**
 * Normaliza um preço recebido do cliente para string decimal.
 *
 * Números viram `String(value)` (sem arredondar) para que valores com mais
 * de duas casas decimais sejam **rejeitados** pela validação, em vez de
 * silenciosamente truncados.
 */
export function toPriceString(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return '';
}

/** Converte um preço (string decimal) em Decimal com 2 casas. */
export function parsePrice(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

/** Converte um Decimal em `number` com 2 casas, para a resposta da API. */
export function priceToNumber(value: Prisma.Decimal): number {
  return new Prisma.Decimal(value).toDecimalPlaces(2).toNumber();
}
