import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { IsBrazilianDocument } from '../../../common/validators/brazilian-document.validator.js';
import { OrderStatus } from '../../../generated/prisma/client.js';
import { AddressDto } from './address.dto.js';
import { EXPECTED_DELIVERY_DATE_PATTERN } from './create-order.dto.js';
import { OrderItemDto } from './order-item.dto.js';

/**
 * Payload de atualização de um pedido.
 *
 * Todos os campos são opcionais — o que não for enviado permanece intacto.
 * Substituir `items` recalcula o total do pedido.
 */
export class UpdateOrderDto {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'A data prevista deve ser uma data válida (YYYY-MM-DD).' },
  )
  @Matches(EXPECTED_DELIVERY_DATE_PATTERN, {
    message: 'A data prevista deve ser uma data válida (YYYY-MM-DD).',
  })
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsBrazilianDocument()
  customerDocument?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'O pedido deve ter ao menos um item.' })
  @ArrayMaxSize(50, { message: 'O pedido não pode ter mais de 50 itens.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  /** Novo status — a transição é validada contra as regras de negócio. */
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Status inválido.' })
  status?: OrderStatus;
}
