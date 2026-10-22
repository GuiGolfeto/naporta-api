import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('gera um hash argon2id (nunca a senha em texto puro)', async () => {
    const hash = await service.hashPassword('Senha1234');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Senha1234');
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const [first, second] = await Promise.all([
      service.hashPassword('Senha1234'),
      service.hashPassword('Senha1234'),
    ]);

    expect(first).not.toBe(second);
  });

  it('confere a senha correta', async () => {
    const hash = await service.hashPassword('Senha1234');

    await expect(service.verifyPassword(hash, 'Senha1234')).resolves.toBe(true);
  });

  it('rejeita a senha incorreta', async () => {
    const hash = await service.hashPassword('Senha1234');

    await expect(service.verifyPassword(hash, 'SenhaErrada9')).resolves.toBe(false);
  });

  it('devolve false (sem lançar) para hash corrompido', async () => {
    await expect(service.verifyPassword('hash-invalido', 'Senha1234')).resolves.toBe(false);
  });

  it('verifica o hash descartável sem falhar', async () => {
    await expect(service.verifyDummy('SenhaQualquer1')).resolves.toBeUndefined();
  });
});
