import { describe, expect, it } from 'vitest';

import { isValidBrazilianDocument, onlyDigits } from './brazilian-document.validator.js';

describe('isValidBrazilianDocument', () => {
  it('aceita CPFs válidos (com e sem máscara)', () => {
    expect(isValidBrazilianDocument('11144477735')).toBe(true);
    expect(isValidBrazilianDocument('111.444.777-35')).toBe(true);
  });

  it('rejeita CPFs com dígito verificador errado', () => {
    expect(isValidBrazilianDocument('11144477734')).toBe(false);
    expect(isValidBrazilianDocument('111.444.777-00')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    expect(isValidBrazilianDocument('11111111111')).toBe(false);
    expect(isValidBrazilianDocument('00000000000')).toBe(false);
  });

  it('aceita CNPJs válidos (com e sem máscara)', () => {
    expect(isValidBrazilianDocument('11222333000181')).toBe(true);
    expect(isValidBrazilianDocument('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJs com dígito verificador errado', () => {
    expect(isValidBrazilianDocument('11222333000182')).toBe(false);
  });

  it('rejeita documentos com tamanho inválido', () => {
    expect(isValidBrazilianDocument('1234567890')).toBe(false);
    expect(isValidBrazilianDocument('123456789012345')).toBe(false);
    expect(isValidBrazilianDocument('')).toBe(false);
    expect(isValidBrazilianDocument(null)).toBe(false);
    expect(isValidBrazilianDocument(12345678901)).toBe(false);
  });
});

describe('onlyDigits', () => {
  it('remove a máscara', () => {
    expect(onlyDigits('123.456.789-09')).toBe('12345678909');
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('devolve string vazia para valores não textuais', () => {
    expect(onlyDigits(undefined)).toBe('');
    expect(onlyDigits(42)).toBe('');
  });
});
