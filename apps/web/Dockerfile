# syntax=docker/dockerfile:1

# =============================================================================
# naPorta — portal web (Next.js)
#
# Estágios:
#   deps   → dependências do workspace (cacheável)
#   build  → build do Next (`output: standalone`)
#   runner → imagem final com o servidor standalone, usuário sem privilégios
#
# O contexto de build é a **raiz do monorepo** (o `package-lock.json` é do
# workspace npm e precisa estar junto dos manifestos de cada app).
# =============================================================================

# ------------------------------------------------------------- dependências
FROM node:24-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --ignore-scripts

# ------------------------------------------------------------------- build
FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Contratos compartilhados (o portal tipa as respostas da API a partir deles)
RUN npm run build --workspace @naporta/contracts

# O Next compila o app e gera a saída `standalone` (servidor + arquivos
# mínimos em `node_modules`).
RUN npm run build --workspace @naporta/web

# ------------------------------------------------------------------ runner
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `tini` como PID 1: encaminha o SIGTERM e recolhe processos zumbis.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# A saída standalone do Next já traz o `node_modules` mínimo e o servidor.
# Como o app é um workspace, os caminhos mantêm a estrutura `apps/web/`.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

# O health check usa o próprio Node (fetch nativo) — sem curl na imagem.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
