import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Configuração do Vitest para os testes e2e (Supertest).
 *
 * Os testes e2e sobem a aplicação Nest em memória e falam com o Postgres
 * de teste (serviço `db-test` do docker-compose).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup-e2e.ts'],
    globalSetup: ['test/global-setup.ts'],
    // O banco de testes é compartilhado: os arquivos rodam em sequência.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage-e2e',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/main.ts', '**/*.module.ts'],
    },
  },
  plugins: [swc.vite()],
});
