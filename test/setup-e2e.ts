import 'reflect-metadata';
import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Nos testes e2e usamos o banco de testes (DATABASE_URL_TEST), isolado do
// banco de desenvolvimento. O `.env` já foi carregado acima, então a variável
// existe quando configurada.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

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
