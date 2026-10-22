# syntax=docker/dockerfile:1

# =============================================================================
# naPorta API — imagem de produção
#
# Estágios:
#   deps     → instala as dependências do workspace (cacheável)
#   build    → gera o Prisma Client, compila os contratos e a API
#   prod-deps→ dependências de produção (sem as de desenvolvimento)
#   runtime  → imagem final: só o necessário, usuário sem privilégios
#
# O contexto de build é a **raiz do monorepo** (o `package-lock.json` é do
# workspace npm e precisa estar junto dos manifestos de cada app).
#
# A imagem final NÃO tem o CLI do Prisma: as migrations rodam em um serviço
# separado (`migrate`), no estágio `build`.
# =============================================================================

# ---------------------------------------------------------------- dependências
FROM node:24-bookworm-slim AS deps

WORKDIR /app

# O lockfile é do monorepo (npm workspaces): os manifestos dos workspaces
# precisam estar presentes para o `npm ci` resolver a árvore.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

# `--ignore-scripts`: o `postinstall` roda `prisma generate`, que precisa do
# schema — ele é gerado no estágio `build`, com o schema já presente.
RUN npm ci --ignore-scripts

# ------------------------------------------------------------------- compilação
FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=development

# `openssl` é pedido pelo CLI do Prisma (usado no estágio de build para
# gerar o client e aplicar as migrations).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Contratos compartilhados (tipos + regras de transição de status)
RUN npm run build --workspace @naporta/contracts

# O Prisma 7 gera o client como TypeScript: ele é compilado junto com o app.
RUN npx prisma generate --config apps/api/prisma.config.ts
RUN npm run build --workspace @naporta/api

# ------------------------------------------------- dependências de produção
# Instala **somente** as dependências de produção (`npm ci --omit=dev`).
# `npm prune` não serviria aqui: o npm 11 mantém as dev deps na árvore.
#
# `--ignore-scripts` evita downloads de engine (o client do Prisma 7 é
# "Rust-free" e não precisa deles) e compilação local do argon2 — o binário
# pronto (glibc) já vem no pacote e é carregado pelo `node-gyp-build`.
FROM node:24-bookworm-slim AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev --ignore-scripts

# ------------------------------------------------------------------- runtime
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# `tini` como PID 1: encaminha sinais (SIGTERM) e recolhe processos zumbis.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Dependências de produção + artefatos de build
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./package.json
# O pacote de contratos é um workspace: o link em `node_modules` precisa do
# alvo ao lado (o código da API usa as regras de transição em runtime).
COPY --from=build --chown=node:node /app/packages/contracts ./packages/contracts

# O `@prisma/client` declara o CLI (`prisma`) como dependência — e com ele vêm
# o Prisma Studio e os dev tools (~190 MB) que a API não usa em runtime.
# As migrations rodam no serviço `migrate`, que usa o estágio `build`.
RUN rm -rf \
        node_modules/prisma \
        node_modules/.bin/prisma \
        node_modules/@prisma/studio-core \
        node_modules/@prisma/dev \
        node_modules/typescript \
    && chown -R node:node /app

# O health check usa o próprio Node (fetch nativo) — a imagem não precisa de curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Usuário sem privilégios (o usuário `node` já existe na imagem oficial)
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
