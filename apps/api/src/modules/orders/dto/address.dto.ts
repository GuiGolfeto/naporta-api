import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { onlyDigits } from '../../../common/validators/brazilian-document.validator.js';

/** Endereço de entrega. */
export class AddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  street!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  complement?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  neighborhood!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  /** Sigla da unidade federativa (2 letras). */
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'A UF deve ter 2 letras.' })
  state!: string;

  /** CEP — apenas dígitos, 8 posições. */
  @Matches(/^\d{8}$/, { message: 'O CEP deve ter 8 dígitos.' })
  zipCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}

/**
 * Documento do cliente (CPF ou CNPJ), apenas dígitos.
 *
 * A validação dos dígitos verificadores acontece em
 * `@IsBrazilianDocument()`; aqui fica apenas o formato.
 */
export class CustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Matches(/^\d{11,14}$/, { message: 'O documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.' })
  document!: string;
}

/** Normaliza o CEP removendo pontuação. */
export function normalizeZipCode(value: string): string {
  return onlyDigits(value);
}
