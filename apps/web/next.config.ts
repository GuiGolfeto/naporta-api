import { resolve } from 'node:path';

import { config } from 'dotenv';
import type { NextConfig } from 'next';

// O `.env` do monorepo fica na raiz; o Next carrega apenas o do app.
config({ path: resolve(import.meta.dirname, '../../.env') });

const nextConfig: NextConfig = {
  // Saída standalone: a imagem Docker do portal fica pequena e não precisa do
  // `node_modules` completo.
  output: 'standalone',
  reactStrictMode: true,
  // Não revela a stack do framework.
  poweredByHeader: false,
  // O pacote de contratos é TypeScript puro (workspace) e precisa ser
  // transpilado pelo Next.
  transpilePackages: ['@naporta/contracts'],
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
};

export default nextConfig;
