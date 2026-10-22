import 'reflect-metadata';

import { execFileSync } from 'node:child_process';

import { loadDotEnv } from '../src/config/load-dotenv.js';

/**
 * Preparação global dos testes e2e.
 *
 * Aplica as migrations no banco de testes (`DATABASE_URL_TEST`) para que a
 * suite sempre rode sobre o schema atual — sem depender de passos manuais.
 */
export default function globalSetup(): void {
  // O .env fica na raiz do monorepo; o app roda a partir de apps/api.
  loadDotEnv();

  const testDatabaseUrl = process.env.DATABASE_URL_TEST;

  if (!testDatabaseUrl) {
    throw new Error(
      'DATABASE_URL_TEST não configurada. Copie o .env.example para .env e ajuste a porta do banco de testes.',
    );
  }

  assertIsTestDatabase(testDatabaseUrl);

  // A partir daqui a aplicação (e qualquer ConfigModule) resolve o banco de
  // testes — nunca o de desenvolvimento.
  process.env.DATABASE_URL = testDatabaseUrl;

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}

/**
 * Rede de segurança: a suíte **nunca** pode rodar contra o banco de
 * desenvolvimento — os testes fazem `TRUNCATE` e apagariam os dados de
 * trabalho.
 */
function assertIsTestDatabase(databaseUrl: string): void {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Refuso a rodar os testes contra o banco "${databaseName}": a URL de teste precisa apontar para um banco de testes (com "test" no nome).`,
    );
  }
}
