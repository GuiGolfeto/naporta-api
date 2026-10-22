import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

import { toPriceString } from '../../../common/utils/price.js';

/** Formato aceito para o preço unitário: até 2 casas decimais. */
export const PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Item do pedido. */
export class OrderItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(9_999)
  quantity!: number;

  /**
   * Preço unitário.
   *
   * Aceito como número (`49.9`) ou string (`"49.90"`) e normalizado para
   * string — evita que imprecisão de ponto flutante chegue ao banco.
   */
  @Transform(({ value }: { value: unknown }) => toPriceString(value))
  @Matches(PRICE_PATTERN, {
    message: 'O preço deve ser um valor positivo com até 2 casas decimais.',
  })
  unitPrice!: string;
}
