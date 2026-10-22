import 'dotenv/config';

import { execFileSync } from 'node:child_process';

/**
 * Preparação global dos testes e2e.
 *
 * Aplica as migrations no banco de testes (`DATABASE_URL_TEST`) para que a
 * suite sempre rode sobre o schema atual — sem depender de passos manuais.
 */
export default function globalSetup(): void {
  const testDatabaseUrl = process.env.DATABASE_URL_TEST;

  if (!testDatabaseUrl) {
    throw new Error(
      'DATABASE_URL_TEST não configurada. Copie o .env.example para .env e ajuste a porta do banco de testes.',
    );
  }

  // A partir daqui a aplicação (e qualquer ConfigModule) resolve o banco de
  // testes — nunca o de desenvolvimento.
  process.env.DATABASE_URL = testDatabaseUrl;

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}
