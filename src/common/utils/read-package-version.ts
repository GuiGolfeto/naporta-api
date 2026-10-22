import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_VERSION = '0.0.0';

/**
 * Lê a versão da aplicação a partir do `package.json`.
 *
 * Funciona tanto em desenvolvimento (`src/common/utils/...`) quanto em
 * produção (`dist/common/utils/...`) — nos dois casos o `package.json` está
 * três níveis acima.
 */
export function readPackageVersion(): string {
  try {
    const packageJsonPath = join(import.meta.dirname, '..', '..', '..', 'package.json');
    const raw = readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: unknown };

    return typeof parsed.version === 'string' ? parsed.version : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}
