import 'reflect-metadata';
import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getStorageToken } from '@nestjs/throttler';
import type { ThrottlerStorageService } from '@nestjs/throttler';

// Nos testes e2e usamos o banco de testes (DATABASE_URL_TEST), isolado do
// banco de desenvolvimento. O `.env` já foi carregado acima, então a variável
// existe quando configurada.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// A suíte roda todas as requisições a partir de 127.0.0.1: com o limite
// rígido de credenciais (5/min), os testes de autenticação se auto-bloqueiam.
// O limite é relaxado apenas no ambiente de teste.
process.env.AUTH_THROTTLE_LIMIT = '1000';

// Import dinâmico: o `ConfigModule` lê o ambiente no momento em que o módulo
// é avaliado — por isso as variáveis acima precisam estar definidas antes.
const { AppModule } = await import('../src/app.module.js');
const { configureApp } = await import('../src/app.setup.js');

/**
 * Sobe a aplicação Nest em memória, com o mesmo pipeline de configuração
 * usado em produção (`src/app.setup.ts`).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);

  await app.init();

  return app;
}

/**
 * Limpa o contador do rate limit.
 *
 * O throttler é chaveado por IP e a suíte roda toda em 127.0.0.1 — sem o
 * reset, os testes de autenticação se auto-bloqueiam pelo limite de tentativas.
 */
export function resetThrottler(app: INestApplication): void {
  // O storage padrão do throttler é o `ThrottlerStorageService` (Map em memória),
  // registrado sob o token `getStorageToken()`.
  const storage = app.get<ThrottlerStorageService>(getStorageToken());

  storage.storage.clear();
}
