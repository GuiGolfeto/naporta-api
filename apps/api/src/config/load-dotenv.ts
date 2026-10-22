import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';

/**
 * Carrega o arquivo `.env` procurando-o no diretório atual e nos seus
 * ancestors.
 *
 * No monorepo o `.env` fica na **raiz** (`naporta-desafio/.env`), enquanto os
 * apps rodam a partir de `apps/<app>`. O `dotenv` não sobrescreve variáveis já
 * existentes, então o `.env` mais próximo (o do app) tem precedência sobre o
 * da raiz ✓.
 */
export function loadDotEnv(maxDepth = 4): void {
  let current = process.cwd();

  for (let depth = 0; depth < maxDepth; depth += 1) {
    config({ path: resolve(current, '.env'), quiet: true });

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }
}
