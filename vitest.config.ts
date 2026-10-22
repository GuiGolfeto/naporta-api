import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Configuração do Vitest (testes unitários).
 *
 * O SWC é usado no lugar do esbuild porque o Nest depende de
 * `emitDecoratorMetadata` — recurso que o esbuild não implementa.
 * O plugin `unplugin-swc` lê as opções de decorator direto do `tsconfig.json`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/main.ts', '**/*.module.ts'],
    },
  },
  plugins: [swc.vite()],
});
