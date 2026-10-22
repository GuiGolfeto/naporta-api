import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IsBrazilianDocument } from '../../../common/validators/brazilian-document.validator.js';
import { AddressDto } from './address.dto.js';
import { OrderItemDto } from './order-item.dto.js';

/** Data esperada para a entrega (ISO 8601, `YYYY-MM-DD`). */
export const EXPECTED_DELIVERY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Payload de criação de um pedido. */
export class CreateOrderDto {
  /** Data prevista de entrega. */
  @IsDateString(
    { strict: true },
    { message: 'A data prevista deve ser uma data válida (YYYY-MM-DD).' },
  )
  @Matches(EXPECTED_DELIVERY_DATE_PATTERN, {
    message: 'A data prevista deve ser uma data válida (YYYY-MM-DD).',
  })
  expectedDeliveryDate!: string;

  /** Nome do cliente. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  /** CPF ou CNPJ do cliente (apenas dígitos). */
  @IsBrazilianDocument()
  customerDocument!: string;

  /** Endereço de entrega. */
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  /** Itens do pedido (ao menos um). */
  @IsArray()
  @ArrayMinSize(1, { message: 'O pedido deve ter ao menos um item.' })
  @ArrayMaxSize(50, { message: 'O pedido não pode ter mais de 50 itens.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
