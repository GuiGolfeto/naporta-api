import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { OrderStatus } from '../../../generated/prisma/client.js';

/** Campos pelos quais a listagem pode ser ordenada. */
export const ORDER_SORT_FIELDS = [
  'createdAt',
  'expectedDeliveryDate',
  'total',
  'number',
  'status',
] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

/** Direção da ordenação. */
export const ORDER_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type OrderSortDirection = (typeof ORDER_SORT_DIRECTIONS)[number];

/** Filtros e paginação da listagem de pedidos. */
export class OrderQueryDto {
  /** Número do pedido (ex.: `NP-2026-00001`). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  /** Status do pedido. */
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Status inválido.' })
  status?: OrderStatus;

  /** Início do período (data prevista de entrega) — `YYYY-MM-DD`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'A data inicial deve estar no formato YYYY-MM-DD.' })
  startDate?: string;

  /** Fim do período (data prevista de entrega) — `YYYY-MM-DD`. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'A data final deve estar no formato YYYY-MM-DD.' })
  endDate?: string;

  /** Página (começa em 1). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser maior ou igual a 1.' })
  page?: number;

  /** Itens por página (máximo 100). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1, { message: 'O limite deve ser maior ou igual a 1.' })
  @Max(100, { message: 'O limite não pode ser maior que 100.' })
  limit?: number;

  /** Campo de ordenação. */
  @IsOptional()
  @IsIn(ORDER_SORT_FIELDS, { message: 'Campo de ordenação inválido.' })
  sortBy?: OrderSortField;

  /** Direção da ordenação. */
  @IsOptional()
  @IsIn(ORDER_SORT_DIRECTIONS, { message: 'Direção de ordenação inválida.' })
  order?: OrderSortDirection;
}
