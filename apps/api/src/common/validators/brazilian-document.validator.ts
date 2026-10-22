import {
  ValidatorConstraint,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Valida documentos brasileiros (CPF e CNPJ) pelos dígitos verificadores.
 *
 * Aceita o valor com ou sem máscara (`123.456.789-09` ou `12345678909`).
 */
@ValidatorConstraint({ name: 'isBrazilianDocument', async: false })
export class IsBrazilianDocumentConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isValidBrazilianDocument(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'O documento deve ser um CPF ou CNPJ válido.';
  }
}

/** Decorator: `@IsBrazilianDocument()`. */
export function IsBrazilianDocument(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isBrazilianDocument',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsBrazilianDocumentConstraint,
    });
  };
}

/** Remove tudo que não for dígito. */
export function onlyDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

/**
 * Verifica um CPF (11 dígitos) ou CNPJ (14 dígitos).
 *
 * Além dos dígitos verificadores, rejeita documentos com todos os dígitos
 * iguais (000.000.000-00), que passam no cálculo mas não existem.
 */
export function isValidBrazilianDocument(value: unknown): boolean {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  if (digits.length === 14) {
    return isValidCnpj(digits);
  }

  return false;
}

/** CPF: dois dígitos verificadores. */
function isValidCpf(digits: string): boolean {
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(digits.slice(0, 9) + firstCheckDigit, 11);

  return digits[9] === firstCheckDigit && digits[10] === secondCheckDigit;
}

/** CNPJ: dois dígitos verificadores, com pesos 2..9 e 0..5. */
function isValidCnpj(digits: string): boolean {
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const firstCheckDigit = calculateCnpjCheckDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondCheckDigit = calculateCnpjCheckDigit(
    digits.slice(0, 12) + firstCheckDigit,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return digits[12] === firstCheckDigit && digits[13] === secondCheckDigit;
}

/** Dígito verificador genérico (CPF): pesos decrescentes a partir de `startWeight`. */
function calculateCheckDigit(partial: string, startWeight: number): string {
  let sum = 0;

  for (let index = 0; index < partial.length; index += 1) {
    sum += Number(partial[index]) * (startWeight - index);
  }

  const remainder = (sum * 10) % 11;

  return remainder === 10 ? '0' : String(remainder);
}

/** Dígito verificador do CNPJ, com a tabela de pesos específica. */
function calculateCnpjCheckDigit(partial: string, weights: number[]): string {
  let sum = 0;

  for (let index = 0; index < partial.length; index += 1) {
    sum += Number(partial[index]) * (weights[index] ?? 0);
  }

  const remainder = sum % 11;

  return remainder < 2 ? '0' : String(11 - remainder);
}
