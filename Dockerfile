# syntax=docker/dockerfile:1

# =============================================================================
# naPorta API — imagem de produção
#
# Estágios:
#   deps     → instala todas as dependências (cacheável)
#   build    → gera o Prisma Client e compila o TypeScript
#   prod-deps→ dependências de produção (sem as de desenvolvimento)
#   runtime  → imagem final: só o necessário, usuário sem privilégios
#
# A imagem final NÃO tem o CLI do Prisma: as migrations rodam em um serviço
# separado (`migrate`), que usa o estágio `build`.
# =============================================================================

# ---------------------------------------------------------------- dependências
FROM node:24-bookworm-slim AS deps

WORKDIR /app

# Camada de dependências separada: só o package.json muda quando as deps mudam
COPY package.json package-lock.json ./

# `--ignore-scripts`: o `postinstall` roda `prisma generate`, que precisa do
# schema — ele é gerado no estágio `build`, com o schema já presente.
RUN npm ci --ignore-scripts

# ------------------------------------------------------------------- compilação
FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# O Prisma 7 gera o client como TypeScript: ele é compilado junto com o app.
RUN npx prisma generate
RUN npm run build

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
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

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
