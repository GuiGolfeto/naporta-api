/**
 * Configuração do Prisma CLI (Prisma 7+).
 *
 * A URL do datasource, o caminho das migrations e o comando de seed são
 * definidos aqui — e não no `schema.prisma`.
 *
 * Por que não usamos o helper `env()` do Prisma?
 * O `env()` lança exceção quando a variável não existe, o que quebraria o
 * `prisma generate` executado no `postinstall` (clone novo ainda sem `.env`).
 * Usamos `process.env` com um fallback de desenvolvimento — que é exatamente
 * o mesmo valor documentado no `.env.example`.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const DEFAULT_DATABASE_URL = 'postgresql://naporta:naporta_dev_password@localhost:5432/naporta';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
