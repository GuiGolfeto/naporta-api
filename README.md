# naPorta API

Web API da **naPorta** para gestão de pedidos de entrega — NestJS, Prisma e PostgreSQL, com
autenticação JWT, exclusão lógica, testes automatizados e imagem Docker de produção.

> **Escopo do desafio:** pedidos com criação, listagem filtrável, edição e exclusão lógica,
> com autenticação por Bearer token, banco relacional, ORM, seed e documentação.

|                             |                                                               |
| --------------------------- | ------------------------------------------------------------- |
| **Documentação interativa** | http://localhost:3000/docs (Swagger UI)                       |
| **Health check**            | http://localhost:3000/api/v1/health                           |
| **Testes**                  | 64 unitários · 89 e2e · cobertura de 78% (pisos configurados) |
| **Imagem Docker**           | 179 MB, usuário sem privilégios, health check                 |

---

## Sumário

- [Como avaliar em 5 minutos](#como-avaliar-em-5-minutos)
- [O monorepo](#o-monorepo)
- [O portal](#o-portal)
- [Stack](#stack)
- [Como executar](#como-executar)
- [Arquitetura](#arquitetura)
- [API](#api)
- [Autenticação e segurança](#autenticação-e-segurança)
- [Pedidos](#pedidos)
- [Dados de demonstração (seed)](#dados-de-demonstração-seed)
- [Modelo de dados](#modelo-de-dados)
- [Testes](#testes)
- [Docker](#docker)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Decisões e justificativas](#decisões-e-justificativas)
- [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)

---

## Como avaliar em 5 minutos

```bash
# 1) sobe a stack completa (banco + migrations + API + portal)
docker compose up -d --build

# 2) popula o banco com dados fictícios
docker compose exec -T api npm run seed
#   (ou, sem Docker: npm run seed)

# 3) autentica e cria um pedido
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@naporta.local","password":"Admin@1234"}' | jq -r .accessToken)

curl -s -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"expectedDeliveryDate":"2026-12-25","customerName":"Maria Silva",
       "customerDocument":"11144477735",
       "address":{"street":"Rua das Flores","number":"123","neighborhood":"Centro",
                  "city":"São Paulo","state":"SP","zipCode":"01001000"},
       "items":[{"description":"Caixa de papelão","quantity":2,"unitPrice":49.90}]}' | jq

# 4) filtra e pagina
curl -s "http://localhost:3000/api/v1/orders?status=PENDING&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.meta'
```

| O que olhar                                     | Onde                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Documentação interativa com o botão "Authorize" | http://localhost:3000/docs                                                                        |
| Exclusão lógica (a linha continua no banco)     | `docker compose exec -T db psql -U naporta -d naporta -c "select number, deleted_at from orders"` |
| Suíte completa                                  | `npm run test:all`                                                                                |
| Decisões técnicas                               | [Decisões e justificativas](#decisões-e-justificativas)                                           |

**Credenciais da seed:** `admin@naporta.local / Admin@1234` (ADMIN) · `operador@naporta.local / Operador@1234` (USER).

---

## O monorepo

```
naporta-desafio/
├── apps/
│   ├── api/                    # Web API (NestJS + Prisma + PostgreSQL)
│   └── web/                    # Portal web (Next.js 16 + React 19 + Tailwind 4)
├── packages/
│   └── contracts/              # Contrato de dados compartilhado (tipos + regras)
├── docker-compose.yml          # db + migrate + api + web
└── package.json                # npm workspaces
```

| Workspace            | Papel                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| `@naporta/api`       | A API: autenticação, pedidos, health checks, seed e testes.                         |
| `@naporta/web`       | O portal: login, dashboard, criação, detalhe e ações de status.                     |
| `@naporta/contracts` | Tipos do contrato da API (respostas e payloads) e as regras de transição de status. |

**O contrato é a fonte única:** as classes de resposta da API `implementam` os tipos do
`@naporta/contracts` — se a API mudar o formato, o portal **não compila**. As regras de
transição de status também vivem no contrato: a API valida e o portal oferece as ações, e os
dois concordam com o fluxo.

**Scripts da raiz:**

```bash
npm run dev:api        # API em watch (3000)
npm run dev:web        # portal em dev (3001)
npm run build           # contracts -> api -> web
npm run lint            # ESLint (API + contratos) e o lint próprio do portal
npm run typecheck       # type-check de todos os workspaces
npm run test            # testes da API
npm run test:all        # unitários + e2e
npm run seed            # popula o banco com dados fictícios
```

> Sem Turborepo/Nx: com dois apps, os scripts da raiz resolvem — menos uma dependência e menos
> uma camada de abstração.

## O portal

| Rota           | Tela                                                   |
| -------------- | ------------------------------------------------------ |
| `/login`       | Login (e-mail e senha)                                 |
| `/`            | Dashboard: lista de pedidos, filtros e paginação       |
| `/orders/new`  | Novo pedido (cliente, endereço e itens)                |
| `/orders/[id]` | Detalhe: itens, endereço, mudança de status e exclusão |

### Como o portal fala com a API

Dois caminhos, com o **token nunca exposto ao JavaScript do browser**:

| Caminho                                         | Quem chama           | Token                                                                         |
| ----------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| **Server** (Server Components e Server Actions) | O servidor do portal | Lido do cookie `httpOnly` e enviado no header `Authorization`                 |
| **Browser** (filtros instantâneos)              | O navegador          | Access token **em memória** (nunca em `localStorage`), entregue pelo servidor |

- O login é uma **Server Action**: a API devolve access + refresh token e o portal grava
  cookies `httpOnly` + `sameSite=lax` + `secure`;
- o **refresh token nunca sai do cookie `httpOnly`** — a rotação acontece no servidor;
- quando uma chamada do browser volta com `401`, o cliente chama a Server Action de renovação
  (que usa o refresh token) e **repete** a requisição;
- como o browser fala com a API, a **origem do portal precisa estar no CORS da API** — o Compose
  já resolve isso (`CORS_ORIGINS`).

## Stack

| Camada            | Tecnologia                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| Runtime           | Node.js 24 (ESM)                                                                    |
| Linguagem         | TypeScript 6.0 (`strict`)                                                           |
| Framework         | NestJS 12                                                                           |
| ORM               | Prisma 7 (client gerado em TypeScript, sem engine Rust)                             |
| Banco             | PostgreSQL 16 (Docker Compose)                                                      |
| Testes            | Vitest 5 (unit + e2e com Supertest)                                                 |
| Lint / Formatação | ESLint 10 (flat config, com type-checking) + Prettier 3                             |
| Logs              | nestjs-pino (JSON em produção, legível em desenvolvimento)                          |
| Documentação      | OpenAPI 3 / Swagger UI em `/docs`                                                   |
| Portal            | Next.js 16 (App Router, Server Components e Server Actions) + React 19 + Tailwind 4 |
| Autenticação      | JWT (HS256) + refresh rotativo, senhas com argon2id                                 |
| Docker            | Imagem multi-stage, usuário sem privilégios, health check                           |

---

## Pré-requisitos

- Node.js >= 20.19 (testado no 24.16)
- Docker + Docker Compose
- npm 11

---

## Como executar

### Opção A — tudo no Docker (recomendado)

```bash
cp .env.example .env      # ajuste se precisar
docker compose up -d --build
```

Sobe **banco + migrations + API + portal**:

| Serviço      | URL                          |
| ------------ | ---------------------------- |
| Portal       | http://localhost:3001        |
| API          | http://localhost:3000/api/v1 |
| Documentação | http://localhost:3000/docs   |
| Banco        | `localhost:5432`             |

### Opção B — desenvolvimento local

```bash
# 1) só o banco
docker compose up -d db

# 2) ambiente e dependências (o `postinstall` já gera o Prisma Client)
cp .env.example .env
npm install

# 3) migrations no banco de desenvolvimento
npm run prisma:migrate:dev

# 4) API e portal, em terminais separados
npm run dev:api           # http://localhost:3000
npm run dev:web           # http://localhost:3001
```

> O `.env` fica na **raiz** do monorepo: os dois apps o carregam (a API pelo `@nestjs/config`, o
> portal pelo `next.config.ts`).

### Verificação rápida

```bash
curl http://localhost:3000/api/v1/health        # liveness  (não depende do banco)
curl http://localhost:3000/api/v1/health/ready  # readiness (verifica o banco)
```

```jsonc
// GET /api/v1/health
{
  "status": "ok",
  "service": "naporta-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 12.34,
  "timestamp": "2026-10-22T04:46:51.246Z",
}
```

```jsonc
// GET /api/v1/health/ready
{
  "status": "ok",
  "info": { "database": { "latencyMs": 14, "responseTime": 14, "status": "up" } },
  "error": {},
  "details": { "database": { "latencyMs": 14, "responseTime": 14, "status": "up" } },
}
```

Com o banco parado, o `/health` continua respondendo `200` e o `/health/ready` responde `503` — é assim que o orquestrador sabe que a API não deve receber tráfego.

---

## Scripts

Todos os scripts rodam **na raiz** do monorepo (npm workspaces).

| Script                                              | Descrição                                            |
| --------------------------------------------------- | ---------------------------------------------------- |
| `npm run dev:api`                                   | API em modo watch (`nest start --watch`, porta 3000) |
| `npm run dev:web`                                   | Portal em modo dev (`next dev`, porta 3001)          |
| `npm run build`                                     | Compila contratos → API → portal                     |
| `npm run start:api` / `start:web`                   | Executa os builds de produção                        |
| `npm run lint`                                      | ESLint (API + contratos) e o lint próprio do portal  |
| `npm run lint:fix`                                  | ESLint com autofix                                   |
| `npm run format` / `format:check`                   | Prettier                                             |
| `npm run typecheck`                                 | Type-check de todos os workspaces                    |
| `npm test`                                          | Testes unitários da API                              |
| `npm run test:all`                                  | Unitários + e2e                                      |
| `npm run test:cov` / `test:e2e:cov`                 | Cobertura (com piso configurado)                     |
| `npm run seed`                                      | Popula o banco com dados fictícios (idempotente)     |
| `npm run seed:api`                                  | Popula o banco **passando pela API**                 |
| `npm run db:reset`                                  | Recria o schema do banco e roda a seed               |
| `npm run prisma:generate`                           | Gera o Prisma Client                                 |
| `npm run prisma:migrate:dev`                        | Cria/aplica migration em desenvolvimento             |
| `npm run prisma:migrate`                            | Aplica migrations (produção)                         |
| `npm run prisma:studio`                             | Prisma Studio                                        |
| `npm run docker:up` / `docker:down` / `docker:logs` | Atalhos para o Compose                               |

---

## Testes

A suíte é dividida em duas partes, com finalidades diferentes:

| Suíte                | Comando            | Banco                | O que cobre                                                                                                                                                  |
| -------------------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unitária**         | `npm test`         | não precisa          | Funções puras: transições de status, CPF/CNPJ, precisão decimal, mapeamento de erros do Prisma, parsing de duração, configuração do throttler, hash de senha |
| **E2E / integração** | `npm run test:e2e` | precisa do `db-test` | A aplicação inteira via HTTP: autenticação, refresh rotativo, CRUD de pedidos, filtros, paginação, propriedade, soft delete, seed, rate limit e concorrência |

```bash
# Unitários (rápidos, sem banco)
npm test

# E2E (precisam do banco de testes)
docker compose --profile test up -d db-test
npm run test:e2e

# As duas suítes + cobertura
npm run test:all
npm run test:cov        # cobertura da suíte unitária
npm run test:e2e:cov    # cobertura da suíte e2e (a que importa)
```

O banco de testes (`naporta_test`) é isolado do banco de desenvolvimento e roda na porta `5433`
por padrão. As migrations são aplicadas automaticamente pelo _setup global_ do Vitest, antes da
suíte — não é preciso rodar nada manualmente.

### Cobertura

| Métrica    | Suíte e2e | Piso configurado |
| ---------- | --------- | ---------------- |
| Statements | **78%**   | 75%              |
| Branches   | **53%**   | 50%              |
| Functions  | **85%**   | 80%              |
| Lines      | **79%**   | 75%              |

O relatório em HTML fica em `coverage-e2e/index.html` (`npm run test:e2e:cov`). Os pisos de
cobertura fazem o `npm run test:e2e:cov` **falhar** se a qualidade cair — a suíte é a rede de
segurança do código, não um formality check.

### O que a suíte garante (e não só "passa")

| Cenário                  | Como é verificado                                                            |
| ------------------------ | ---------------------------------------------------------------------------- |
| Soft delete de verdade   | A linha continua na tabela (com `deleted_at` preenchido) e some das leituras |
| Numerador sem colisão    | 10 criações **simultâneas** de pedido → 10 números distintos                 |
| Precisão de dinheiro     | `3 × 0.10 + 0.20 = 0.50` (e não `0.5000000000000001`)                        |
| Rotação de refresh token | O token usado é revogado; reusá-lo revoga todas as sessões do usuário        |
| Enumeração de contas     | E-mail inexistente e senha errada devolvem a **mesma** mensagem              |
| Propriedade do pedido    | Pedido de outra pessoa → `404` (não `403`) em leitura, edição e exclusão     |
| Autorização por papel    | Usuário comum em rota de admin → `403`; admin → `200`                        |
| Rate limit               | Acima do limite → `429` com `Retry-After` e corpo no contrato da API         |
| Contrato de erro         | Toda resposta de erro tem o mesmo formato (4xx e 5xx)                        |
| Seed                     | Banco nasce vazio; a seed é idempotente e gera números válidos               |
| Datas                    | A suíte usa datas relativas a "hoje" — ela não expira com o tempo            |

### Ferramentas

| Ferramenta              | Papel                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| **Vitest**              | Runner das duas suítes                                                 |
| **Supertest**           | Requisições HTTP contra a aplicação Nest em memória                    |
| **unplugin-swc**        | Compilação dos `.ts` com metadata de decorator (o esbuild não emite)   |
| **@vitest/coverage-v8** | Cobertura via V8 (sem instrumentação)                                  |
| **`@nestjs/testing`**   | Sobe a aplicação real — os e2e testam a mesma configuração de produção |

---

## Variáveis de ambiente

Todas as variáveis são validadas com Joi **antes** do container de DI subir: se algo estiver errado, a aplicação morre na inicialização com uma mensagem explícita.

| Variável                 | Padrão                  | Descrição                                                                 |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------- |
| `NODE_ENV`               | `development`           | `development` \| `test` \| `production`                                   |
| `PORT`                   | `3000`                  | Porta da API                                                              |
| `API_PREFIX`             | `api`                   | Prefixo global das rotas                                                  |
| `API_VERSION`            | `1`                     | Versão da API (URI versioning)                                            |
| `DB_HOST_PORT`           | `5432`                  | Porta **no host** do banco de desenvolvimento                             |
| `DB_TEST_HOST_PORT`      | `5433`                  | Porta **no host** do banco de testes                                      |
| `DATABASE_URL`           | URL local               | String de conexão do PostgreSQL                                           |
| `DATABASE_URL_TEST`      | —                       | String de conexão do banco de testes e2e                                  |
| `JWT_SECRET`             | segredo de dev          | Segredo do access token (mín. 32 chars)                                   |
| `JWT_EXPIRES_IN`         | `15m`                   | Validade do access token                                                  |
| `JWT_REFRESH_SECRET`     | segredo de dev          | Segredo do refresh token (mín. 32 chars)                                  |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                    | Validade do refresh token                                                 |
| `CORS_ORIGINS`           | `http://localhost:3000` | Origens permitidas (separadas por vírgula)                                |
| `TRUST_PROXY`            | `0`                     | Proxies confiáveis à frente da API (0 = não confiar em `X-Forwarded-For`) |
| `THROTTLE_TTL`           | `60000`                 | Janela do rate limit (ms)                                                 |
| `THROTTLE_LIMIT`         | `100`                   | Requisições por janela                                                    |
| `AUTH_THROTTLE_TTL`      | `60000`                 | Janela do rate limit de credencial (ms)                                   |
| `AUTH_THROTTLE_LIMIT`    | `5`                     | Tentativas de login por janela                                            |
| `LOG_LEVEL`              | `info`                  | Nível do log                                                              |

Em `production`, `DATABASE_URL`, `JWT_SECRET` e `JWT_REFRESH_SECRET` são **obrigatórios**, os dois segredos precisam ser diferentes entre si e os valores de desenvolvimento são recusados.

---

## Arquitetura

Organização em **módulos** do Nest, cada um com seu domínio, e camadas transversais em `common/`:

```mermaid
flowchart LR
    subgraph Cliente
        Portal["Portal web / cliente"]
    end

    subgraph API["API (NestJS)"]
        direction TB
        MW["Middleware<br/>helmet · CORS · trust proxy"]
        Guards["Guards globais<br/>Throttler · JWT · Roles"]
        Pipes["ValidationPipe<br/>whitelist · 422"]
        Modules["Módulos<br/>auth · orders · users · health"]
        Repo["PrismaService<br/>+ extensão de soft delete"]
        Filter["Filtro de exceções<br/>contrato único de erro"]
        Modules --> Repo
    end

    subgraph Dados
        DB[("PostgreSQL 16")]
    end

    Portal --> MW --> Guards --> Pipes --> Modules
    Modules -.-> Filter
    Modules --> Repo --> DB
```

O caminho de uma requisição é sempre o mesmo:

1. **Middleware** — `helmet` (headers de segurança), CORS por whitelist, `trust proxy`;
2. **Guards globais** — rate limit → autenticação (Bearer) → autorização por papel;
3. **Pipes** — validação dos DTOs (`whitelist` + `forbidNonWhitelisted` → `422`);
4. **Controller** — apenas HTTP (parsing e delegação);
5. **Service** — regras de negócio, autorização por ownership e transações;
6. **Prisma** — acesso a dados, com a extensão de soft delete aplicada;
7. **Filtro global** — qualquer erro vira o mesmo formato de resposta.

Decisões de organização:

| Tema                                       | Escolha                                         | Por quê                                                                                                        |
| ------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Módulos**                                | `src/modules/{auth,orders,users,health,prisma}` | Cada domínio tem seu controller e service; o de pedidos não depende do de autenticação além do tipo do usuário |
| **Composição em vez de herança no Prisma** | `PrismaService.client`                          | A extensão do Prisma 7 devolve um objeto novo; herdar exigiria `as unknown as` e perderia a segurança de tipos |
| **Guards globais**                         | `APP_GUARD`                                     | Política _secure by default_: rota nova já nasce protegida                                                     |
| **DTOs**                                   | Um arquivo por payload, com validação           | O DTO é a fonte da verdade da validação **e** da documentação (o OpenAPI é gerado do mesmo código)             |
| **Erros**                                  | Filtro global + mapper do Prisma                | Nenhuma rota devolve um formato diferente de erro                                                              |
| **Respostas**                              | Mapper `toXResponse()`                          | A API nunca expõe o modelo do banco: `Decimal` vira `number`, `DATE` vira `YYYY-MM-DD`                         |

---

## API

Todos os endpoints exigem `Authorization: Bearer <accessToken>`, **exceto** os marcados como públicos.
A documentação completa, com exemplos e botão "Authorize", está em **http://localhost:3000/docs**.

| Método   | Rota                    | Público | Descrição                                   |
| -------- | ----------------------- | ------- | ------------------------------------------- |
| `POST`   | `/api/v1/auth/register` | sim     | Cria a conta e devolve a sessão inicial     |
| `POST`   | `/api/v1/auth/login`    | sim     | Autentica e devolve access + refresh token  |
| `POST`   | `/api/v1/auth/refresh`  | sim     | Renova a sessão (rotaciona o refresh token) |
| `POST`   | `/api/v1/auth/logout`   | não     | Revoga o refresh token informado            |
| `GET`    | `/api/v1/auth/me`       | não     | Dados do usuário autenticado                |
| `POST`   | `/api/v1/orders`        | não     | Cria um pedido                              |
| `GET`    | `/api/v1/orders`        | não     | Lista pedidos (filtros + paginação)         |
| `GET`    | `/api/v1/orders/:id`    | não     | Detalha um pedido                           |
| `PATCH`  | `/api/v1/orders/:id`    | não     | Atualiza um pedido                          |
| `DELETE` | `/api/v1/orders/:id`    | não     | Exclui um pedido (exclusão lógica)          |
| `GET`    | `/api/v1/users`         | não     | Lista usuários — **somente `ADMIN`**        |
| `GET`    | `/api/v1/health`        | sim     | Liveness                                    |
| `GET`    | `/api/v1/health/ready`  | sim     | Readiness (verifica o banco)                |

### Documentação OpenAPI

O Swagger UI fica em **`/docs`** e o documento bruto em **`/docs-json`**.

- Os **schemas** vêm do plugin do `@nestjs/swagger` (configurado no `nest-cli.json`), que lê os
  tipos e os comentários do código — a documentação acompanha a validação real da API, sem
  divergir;
- As **descrições** dos endpoints e dos campos saem dos JSDoc;
- O botão **"Authorize"** usa o token obtido em `POST /api/v1/auth/login`;
- `persistAuthorization` guarda o token entre as requisições feitas na própria UI.

> O plugin roda no compilador do Nest CLI (`nest build` / `nest start`). No contexto do Vitest
> (compilação por SWC) ele não é aplicado — por isso o teste de OpenAPI verifica a _presença_
> dos schemas, e não as suas propriedades.

---

## Autenticação e segurança

Todos os endpoints exigem `Authorization: Bearer <accessToken>`, **exceto** os marcados como
públicos (`/auth/register`, `/auth/login`, `/auth/refresh` e os health checks). A política é
_secure by default_: uma rota nova já nasce protegida.

| Método | Rota                    | Público | Descrição                                   |
| ------ | ----------------------- | ------- | ------------------------------------------- |
| `POST` | `/api/v1/auth/register` | sim     | Cria a conta e devolve a sessão inicial     |
| `POST` | `/api/v1/auth/login`    | sim     | Autentica e devolve access + refresh token  |
| `POST` | `/api/v1/auth/refresh`  | sim     | Renova a sessão (rotaciona o refresh token) |
| `POST` | `/api/v1/auth/logout`   | não     | Revoga o refresh token informado            |
| `GET`  | `/api/v1/auth/me`       | não     | Dados do usuário autenticado                |

```bash
# Cadastro
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maria","email":"maria@exemplo.com","password":"Senha1234"}'
```

```jsonc
{
  "user": {
    "id": "0f5c…",
    "name": "Maria",
    "email": "maria@exemplo.com",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-10-22T05:07:54.814Z",
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "s3cr3t-…",
  "tokenType": "Bearer",
  "expiresIn": 900,
}
```

### Medidas de segurança

| Medida                          | Detalhe                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Senha**                       | Hash **argon2id** (19 MiB, 2 iterações, 1 thread — OWASP). O hash nunca é devolvido pela API.                                                                                  |
| **Política de senha**           | Mínimo 8 caracteres, com pelo menos uma letra e um número.                                                                                                                     |
| **Escalonamento de privilégio** | O papel (`role`) não existe no DTO de cadastro — enviá-lo resulta em `422`. Todo cadastro nasce como `USER`.                                                                   |
| **Enumeração de contas**        | Login responde a mesma mensagem (`Credenciais inválidas.`) para e-mail inexistente e senha errada, e sempre verifica um hash descartável para não vazar por tempo de resposta. |
| **Access token**                | JWT HS256 de 15 min, com `sub`, `email`, `role` e `type: 'access'` (impede reaproveitar um token como outro). `issuer`/`audience` validados.                                   |
| **Refresh token**               | Valor opaco de 48 bytes; **apenas o hash SHA-256 é persistido**. Rotativo a cada renovação.                                                                                    |
| **Detecção de reuso**           | Reapresentar um refresh token já rotacionado revoga **todas** as sessões do usuário (indício de roubo).                                                                        |
| **Revogação imediata**          | A cada requisição o guard recarrega o usuário do banco: conta desativada ou excluída perde o acesso na hora, sem esperar o token expirar.                                      |
| **Rate limit**                  | 5 tentativas/min nas rotas de credencial (configurável) e 100/min global. Resposta `429` com `Retry-After`.                                                                    |
| **Entrada**                     | `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted` — campo desconhecido é rejeitado com `422`.                                                                   |
| **Segredos**                    | Segredos via `ConfigService` (nunca `process.env` espalhado); em produção, obrigatórios, distintos entre si e diferentes dos valores de desenvolvimento.                       |
| **Transporte**                  | `helmet` com CSP/HSTS, CORS por whitelist e `trust proxy` para o rate limit funcionar atrás de proxy.                                                                          |

---

## Dados de demonstração (seed)

> **A API nunca popula o banco sozinha.** O banco nasce **vazio** e os dados entram de duas
> formas, sempre por comando explícito:
>
> | Comando            | Como popula                                          | Quando usar                                                                              |
> | ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
> | `npm run seed`     | direto no Postgres (script `prisma/seed.ts`)         | demonstração com histórico: 3 usuários e 60 pedidos, com entregas no passado e no futuro |
> | `npm run seed:api` | **só via API** (HTTP, `scripts/populate-via-api.ts`) | inicialização usando exclusivamente a API pública — valida a API de ponta a ponta        |

```bash
# 1) popular direto no banco (idempotente: rodar de novo não duplica nada)
npm run seed

# 2) ou popular passando pela API (a API precisa estar no ar)
npm run dev          # em outro terminal
npm run seed:api

# 3) recomeçar do zero (recria o schema e popula)
npm run db:reset
```

A seed cria **3 usuários** e **60 pedidos** fictícios (nomes, CPFs/CNPJs, endereços e produtos
inventados), com status coerentes com a data prevista e números `NP-AAAA-NNNNN` sequenciais:

| Papel   | E-mail                   | Senha           |
| ------- | ------------------------ | --------------- |
| `ADMIN` | `admin@naporta.local`    | `Admin@1234`    |
| `USER`  | `operador@naporta.local` | `Operador@1234` |
| `USER`  | `ana@naporta.local`      | `Cliente@1234`  |

Características da seed:

- **Idempotente** — se já houver usuários, ela não altera nada e avisa no console;
- **Reprodutível** — gerador pseudoaleatório com semente fixa: a mesma seed gera sempre os
  mesmos dados;
- **Coerente** — o status acompanha a data prevista (pedido antigo é `DELIVERED` ou `CANCELLED`,
  pedido futuro é `PENDING`); os totais são calculados em `Decimal`, nunca em float;
- **Com senhas reais** — hash argon2id, então dá para fazer login com as credenciais acima.

O script `seed:api` cria apenas usuários `USER` e pedidos com entrega futura, porque a API não
permite escolher o papel no cadastro e recusa data prevista no passado — para o administrador e
o histórico, use `npm run seed`.

---

## Pedidos

| Método   | Rota                 | Descrição                           |
| -------- | -------------------- | ----------------------------------- |
| `POST`   | `/api/v1/orders`     | Cria um pedido                      |
| `GET`    | `/api/v1/orders`     | Lista pedidos (filtros + paginação) |
| `GET`    | `/api/v1/orders/:id` | Detalha um pedido                   |
| `PATCH`  | `/api/v1/orders/:id` | Atualiza um pedido                  |
| `DELETE` | `/api/v1/orders/:id` | Exclui um pedido (exclusão lógica)  |

```bash
# Autentica e cria um pedido
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"maria@exemplo.com","password":"Senha1234"}' | jq -r .accessToken)

curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "expectedDeliveryDate": "2026-12-25",
    "customerName": "Maria Silva",
    "customerDocument": "11144477735",
    "address": {
      "street": "Rua das Flores", "number": "123", "complement": "Apto 42",
      "neighborhood": "Centro", "city": "São Paulo", "state": "SP", "zipCode": "01001000"
    },
    "items": [
      { "description": "Caixa de papelão", "quantity": 2, "unitPrice": 49.90 }
    ]
  }'
```

```jsonc
{
  "id": "4ed98c19-e7f6-4a42-ad27-e37a6670989a",
  "number": "NP-2026-00001",
  "status": "PENDING",
  "expectedDeliveryDate": "2026-12-25",
  "customer": { "name": "Maria Silva", "document": "11144477735" },
  "address": { "street": "Rua das Flores", "number": "123", "state": "SP", "...": "..." },
  "items": [
    {
      "id": "5c9bc17f-…",
      "description": "Caixa de papelão",
      "quantity": 2,
      "unitPrice": 49.9,
      "total": 99.8,
    },
  ],
  "total": 99.8,
  "createdBy": { "id": "ce589add-…", "name": "Maria" },
  "createdAt": "2026-10-22T05:17:44.905Z",
  "updatedAt": "2026-10-22T05:17:44.905Z",
}
```

### Filtros e paginação

`GET /api/v1/orders` aceita:

| Parâmetro   | Exemplo         | Descrição                                                                          |
| ----------- | --------------- | ---------------------------------------------------------------------------------- |
| `number`    | `NP-2026-00001` | Número do pedido                                                                   |
| `status`    | `PENDING`       | Status (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) |
| `startDate` | `2026-01-01`    | Início do período (data prevista de entrega)                                       |
| `endDate`   | `2026-06-30`    | Fim do período                                                                     |
| `page`      | `1`             | Página (padrão 1)                                                                  |
| `limit`     | `20`            | Itens por página (padrão 20, máximo 100)                                           |
| `sortBy`    | `createdAt`     | `createdAt`, `expectedDeliveryDate`, `total`, `number`, `status`                   |
| `order`     | `desc`          | `asc` ou `desc`                                                                    |

A resposta traz os dados e a metainformação da paginação:

```jsonc
{
  "data": [/* ... */],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 },
}
```

### Regras de negócio

| Regra             | Comportamento                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total**         | Sempre calculado no servidor a partir dos itens — o cliente **não** envia total (campo desconhecido é rejeitado com `422`).                                                         |
| **Preço**         | `Decimal(12,2)` no banco; aceito como número ou string, com no máximo 2 casas decimais (mais que isso é rejeitado, não arredondado).                                                |
| **Documento**     | CPF/CNPJ validados pelos dígitos verificadores; gravado apenas com dígitos.                                                                                                         |
| **Data prevista** | Formato `YYYY-MM-DD`, válida e não pode ser no passado.                                                                                                                             |
| **Status**        | Fluxo `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`; `CANCELLED` é alcançável de qualquer etapa não terminal. Pular etapas ou voltar de um status final devolve **409**. |
| **Número**        | `NP-AAAA-NNNNN`, sequencial por ano, gerado dentro da transação da criação.                                                                                                         |
| **Exclusão**      | Lógica: a linha continua no banco, com `deleted_at` preenchido, e some das leituras.                                                                                                |
| **Propriedade**   | Usuário comum só vê e altera os próprios pedidos; o `ADMIN` vê todos. Pedido de outra pessoa responde **404** (e não 403) — a API não confirma a existência do registro.            |

---

## Formato de erro

Todas as respostas de erro seguem o mesmo contrato:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Pedido não encontrado",
  "path": "/api/v1/orders/abc",
  "timestamp": "2026-10-22T04:46:51.246Z",
  "requestId": "42"
}
```

Erros conhecidos do Prisma são traduzidos automaticamente (`P2002` → 409, `P2025` → 404, `P2003` → 400, erros de conexão → 503).

---

## Modelo de dados

```mermaid
erDiagram
    users ||--o{ orders : "é dono de"
    users ||--o{ refresh_tokens : "possui"
    orders ||--o| addresses : "entrega em"
    orders ||--|{ order_items : "contém"

    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        enum role "USER | ADMIN"
        boolean is_active
        timestamptz deleted_at "soft delete"
    }

    orders {
        uuid id PK
        varchar number UK "NP-2026-00001"
        enum status "PENDING..CANCELLED"
        date expected_delivery_date
        varchar customer_name
        varchar customer_document "CPF/CNPJ"
        decimal total "12,2"
        uuid created_by_id FK
        timestamptz deleted_at "soft delete"
    }

    addresses {
        uuid id PK
        uuid order_id FK,UK
        varchar street
        varchar number
        varchar neighborhood
        varchar city
        char state
        varchar zip_code
    }

    order_items {
        uuid id PK
        uuid order_id FK
        varchar description
        int quantity
        decimal unit_price "12,2"
        decimal total "12,2"
    }

    refresh_tokens {
        uuid id PK
        varchar token_hash UK
        uuid user_id FK
        timestamptz expires_at
        timestamptz revoked_at
    }
```

| Modelo           | Papel                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `users`          | Usuários da API (hash de senha, papel `USER`/`ADMIN`, soft delete)                                  |
| `orders`         | Pedidos — número de negócio único **global** (`NP-2026-00001`), status, cliente, total, soft delete |
| `addresses`      | Endereço de entrega do pedido (1:1)                                                                 |
| `order_items`    | Itens do pedido (1:N), preço em `Decimal(12,2)`                                                     |
| `refresh_tokens` | Refresh tokens rotativos e revogáveis (hash do token, nunca o token)                                |
| `order_counters` | Contador anual para o número sequencial do pedido                                                   |

**Exclusão lógica:** os modelos `Order` e `User` têm `deleted_at`. Uma extensão do Prisma
(`src/modules/prisma/prisma.extensions.ts`) aplica a regra de forma transparente:

- leituras (`findMany`, `findUnique`, `count`…) ignoram registros excluídos;
- `update` só alcança registros ativos;
- `delete`/`deleteMany` marcam `deleted_at` em vez de apagar a linha.

**Número do pedido:** sequencial anual (`NP-AAAA-NNNNN`) atribuído com um _upsert atômico_
(`INSERT ... ON CONFLICT ... RETURNING`), o que garante que duas requisições simultâneas nunca
recebam o mesmo número.

---

## Estrutura do projeto (da API)

```
apps/api/src/
├── main.ts                      # bootstrap: helmet, CORS, versionamento, pipes
├── app.module.ts                # módulo raiz
├── app.setup.ts                 # pipeline compartilhado entre dev e e2e
├── common/
│   ├── errors/                  # mapeamento de erros do Prisma → HTTP
│   ├── filters/                 # filtro global de exceções
│   └── utils/
├── config/                      # env tipado, validação (Joi) e namespaces
├── common/
│   ├── decorators/              # @Public(), @Roles(), @CurrentUser()
│   └── throttling/              # rate limit global e de credenciais
└── modules/
    ├── auth/                    # register/login/refresh/logout/me, guards, senhas
    ├── health/                  # liveness + readiness
    ├── orders/                  # numeração sequencial do pedido
    └── prisma/                  # PrismaService + extensão de soft delete
apps/api/prisma/
├── schema.prisma                # modelo de dados
├── migrations/                  # migrations versionadas
├── seed.ts                      # seed (dados fictícios)
└── seed-data.ts                 # os dados fictícios em si
apps/api/test/                   # testes e2e e de integração
```

---

## Decisões e justificativas

As escolhas que mais definem a solução — e o motivo de cada uma.

### Stack e toolchain

| Tema                               | Decisão                                                          | Por quê                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ESM**                            | Projeto em ESM (`"type": "module"`)                              | O ecossistema NestJS 12 (`@nestjs/config` v12, `@nestjs/terminus` v12) é ESM-first; manter CommonJS exigiria versões antigas dos pacotes, incompatíveis com o Nest 12. |
| **TypeScript 6.0**                 | `module: nodenext`                                               | Única versão que satisfaz os peers de `@nestjs/schematics` (≥ 6.0) e do `typescript-eslint` (< 6.1).                                                                   |
| **Prisma 7**                       | Client gerado como TypeScript em `src/generated/prisma`          | Client "Rust-free": sem engine binário, cold start mais rápido e os tipos no repositório. `prisma.config.ts` centraliza URL, migrations e seed.                        |
| **Imports `.ts` no client gerado** | `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` | O client gerado usa `.ts` nos imports internos; o `tsc` reescreve para `.js` no build (padrão ESM/Node) e o `tsx` (seed) resolve direto.                               |
| **Vitest + SWC**                   | `unplugin-swc` no lugar do esbuild                               | O Nest depende de `emitDecoratorMetadata`, que o esbuild **não** implementa — sem o SWC, a injeção por tipo quebra em runtime.                                         |
| **Sem Passport**                   | `JwtAuthGuard` próprio sobre `@nestjs/jwt`                       | Menos dependência, controle total do fluxo de erro e da política _secure by default_.                                                                                  |
| **Type-check no lint**             | ESLint 10 flat config com `projectService`                       | Regras que só fazem sentido com os tipos (`no-floating-promises`, `no-unsafe-assignment`) passam a ser aplicadas de verdade.                                           |

### Domínio e dados

| Tema                    | Decisão                                                        | Por quê                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Soft delete**         | Extensão do Prisma (`src/modules/prisma/prisma.extensions.ts`) | Registro excluído nunca vaza por uma leitura "esquecida" de filtro, e `delete` **nunca** apaga a linha fisicamente.                               |
| **Número do pedido**    | Upsert atômico no Postgres (`ON CONFLICT ... RETURNING`)       | Sem lock explícito: a atomicidade vem do banco. Testado com 25 chamadas simultâneas.                                                              |
| **Unicidade do número** | Global — o número **não** é reutilizado                        | O número é um identificador de negócio (como nota fiscal): reutilizá-lo criaria ambiguidade no histórico. A exclusão lógica **reserva** o número. |
| **Dinheiro**            | `Decimal(12,2)` no banco; `number` só na resposta              | Precisão exata na soma (`3 × 0.10 + 0.20 = 0.50`, nunca `0.5000000000000001`).                                                                    |
| **Preço no input**      | Aceito como número ou string, no máximo 2 casas                | Valor com mais casas é **rejeitado**, nunca arredondado em silêncio.                                                                              |
| **Total**               | Sempre calculado no servidor                                   | O cliente não envia total — o campo é rejeitado com `422`.                                                                                        |
| **IDs**                 | UUID v4                                                        | Evita IDs sequenciais e, com isso, enumeração de registros.                                                                                       |
| **Endereço e itens**    | Tabelas 1:1 e 1:N (não campos JSON)                            | Relacional de verdade, com integridade referencial e cascade do banco. Prisma composite types só existem no MongoDB.                              |

### API e segurança

| Tema                                 | Decisão                                                     | Por quê                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Erros**                            | Filtro global + contrato único                              | `P2002` → 409, `P2025` → 404, `P2003` → 400, erro de conexão → 503. Nenhuma rota devolve um formato diferente.                        |
| **Validação**                        | `422 Unprocessable Entity`                                  | Distingue "requisição malformada" (400) de "regra violada" (422). `whitelist` + `forbidNonWhitelisted` rejeitam campo desconhecido.   |
| **Propriedade**                      | Pedido de outra pessoa responde **404** (e não 403)         | A API não confirma a existência de registros que o solicitante não pode ver.                                                          |
| **Senhas**                           | argon2id (19 MiB, 2 iterações, 1 thread — OWASP)            | Resistente a GPU/ASIC; o serviço é isolado para permitir troca de algoritmo.                                                          |
| **Refresh token**                    | Valor opaco de 48 bytes; só o **hash SHA-256** é persistido | Vazamento do banco não permite reaproveitar nenhuma sessão.                                                                           |
| **Rotação + detecção de reuso**      | Token usado é revogado; reusá-lo revoga todas as sessões    | Indício de roubo: a resposta é invalidar tudo, não só o token.                                                                        |
| **Revogação imediata**               | O guard recarrega o usuário do banco a cada requisição      | Conta desativada ou excluída perde o acesso na hora, sem esperar o token expirar.                                                     |
| **Enumeração de contas**             | Mesma mensagem e verificação de hash descartável            | Resposta idêntica e tempo equivalente para e-mail inexistente e senha errada.                                                         |
| **Escalonamento de privilégio**      | `role` não existe no DTO de cadastro                        | Todo cadastro nasce `USER`; enviar `role` resulta em `422`.                                                                           |
| **Rate limit**                       | 5/min em credenciais, 100/min global, configurável          | Proteção contra força bruta, com `Retry-After` e `429` no mesmo contrato de erro.                                                     |
| **`trust proxy`**                    | `0` por padrão                                              | A API não confia em `X-Forwarded-For` — um cliente poderia forjar o header e escapar do rate limit. Use `1` apenas com proxy reverso. |
| **Rate limit por limitador nomeado** | `default` + `auth`, com `skipIf`                            | O limite de credencial só vale onde interessa, e vem do ambiente (ajustável por deploy).                                              |

### Operação

| Tema                        | Decisão                                           | Por quê                                                                                                                                           |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configuração única**      | `src/app.setup.ts`                                | `main.ts` e o setup dos testes e2e usam o **mesmo** pipeline — elimina a divergência clássica "funciona no dev, falha no teste".                  |
| **Validação de ambiente**   | Joi **antes** do DI subir                         | Falha rápido e com mensagem clara, em vez de erro em produção. Em produção, segredos obrigatórios, distintos e diferentes dos de desenvolvimento. |
| **Seed explícita**          | `npm run seed` / `npm run seed:api`               | A API **nunca** popula o banco sozinha: o banco nasce vazio e o que entra é sempre explícito.                                                     |
| **Migrations como serviço** | Serviço `migrate` separado no Compose             | O CLI do Prisma não está na imagem final; a API só sobe depois que as migrations são aplicadas.                                                   |
| **Imagem**                  | Multi-stage, usuário `node`, `tini`, health check | 179 MB, sem privilégios, encerramento gracioso e sinal correto.                                                                                   |
| **Logs**                    | `LOG_FORMAT` (`pretty`/`json`)                    | Legível no desenvolvimento, estruturado no container. O `authorization` é sempre censurado.                                                       |
| **Cobertura com piso**      | Piso configurado (75/80/75)                       | A suíte **falha** se a qualidade cair — é rede de segurança, não formulário.                                                                      |

### Duas armadilhas técnicas encontradas (e como foram resolvidas)

1. **`import type` quebra a injeção do Nest.** O `design:paramtypes` emitido precisa do **valor** da
   classe injetada em runtime. Com `import type`, o Nest vê `undefined` e falha com
   _"can't resolve dependencies"_. O mesmo vale para o plugin do Swagger: ele só processa
   **classes**, não interfaces.
2. **O Nest CLI lê os plugins de `compilerOptions.plugins`**, e não do topo do `nest-cli.json`.
   Com a configuração no lugar errado, o plugin simplesmente não roda — e a documentação sai
   com os schemas vazios, sem erro nenhum.

---

## Docker

```bash
# Stack completa (banco + migrations + API)
docker compose up -d --build

# Só o banco de desenvolvimento
docker compose up -d db

# Banco de testes e2e
docker compose --profile test up -d db-test

docker compose down        # remove os containers (o volume persiste)
docker compose down -v     # remove também os volumes
```

| Serviço   | Papel                                                                 | Imagem               |
| --------- | --------------------------------------------------------------------- | -------------------- |
| `db`      | PostgreSQL 16 (dev)                                                   | `postgres:16-alpine` |
| `db-test` | PostgreSQL 16 (testes, profile `test`)                                | `postgres:16-alpine` |
| `migrate` | Aplica as migrations e **encerra** (`service_completed_successfully`) | estágio `build`      |
| `api`     | A API                                                                 | estágio `runtime`    |

### A imagem

`Dockerfile` multi-stage, com quatro estágios:

```
deps  → npm ci (cacheável)
build → prisma generate + nest build        ← usado pelo serviço `migrate`
prod-deps → npm ci --omit=dev
runtime → imagem final: só o necessário
```

| Propriedade      | Detalhe                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Usuário**      | `node` (uid 1000) — sem privilégios (`USER node`)                                                    |
| **PID 1**        | `tini`: encaminha o `SIGTERM` e recolhe processos zumbis                                             |
| **Health check** | `HEALTHCHECK` no Dockerfile e no compose, usando o `fetch` nativo do Node (sem `curl` na imagem)     |
| **Tamanho**      | **179 MB** (imagem final) — o CLI do Prisma, o Prisma Studio e os dev tools são removidos do runtime |
| **Segredos**     | O `.env` **nunca** entra na imagem (`.dockerignore`); as variáveis chegam por `environment:`         |
| **Logs**         | JSON no container (`LOG_FORMAT=json`), legível no desenvolvimento (`LOG_FORMAT=pretty`)              |
| **Base**         | `node:24-bookworm-slim` (glibc) — o binário pré-compilado do argon2 é usado sem compilar nada        |

### Migrations como serviço separado

O CLI do Prisma não está na imagem final. As migrations rodam no serviço `migrate` (que usa o
estágio `build`), e a API só sobe depois que ele termina com sucesso:

```yaml
api:
  depends_on:
    db: { condition: service_healthy }
    migrate: { condition: service_completed_successfully }
```

### O banco nasce limpo

> O serviço `migrate` executa **apenas** `prisma migrate deploy`. Nenhum seed roda
> automaticamente — o banco é criado com o schema e **sem nenhum dado**.
> A população é sempre por comando explícito (`npm run seed` / `npm run seed:api`).

Para rodar a seed contra o banco do Docker (rodando na porta 5432 do host):

```bash
DATABASE_URL="postgresql://naporta:naporta_dev_password@localhost:5432/naporta" npm run seed
```

---

## Limitações conhecidas e próximos passos

O que ficou de fora e o que eu faria a seguir, em ordem de valor:

| Prioridade | Item                                        | Por quê                                                                                                                                    |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1          | **Cache do rate limit distribuído** (Redis) | O limitador atual é em memória: com várias instâncias da API, o limite vale por instância.                                                 |
| 2          | **Refresh tokens por dispositivo**          | Hoje a rotação é por sessão; dá para listar e revogar os dispositivos conectados por usuário.                                              |
| 3          | **Fila para as notificações de status**     | Hoje a mudança de status é síncrona; com integração de e-mail/SMS, ela viraria um job.                                                     |
| 4          | **Histórico de itens**                      | Ao trocar a lista de itens, os antigos são removidos fisicamente (o pedido é soft delete). Com histórico, eles também teriam `deleted_at`. |
| 5          | **Observabilidade**                         | Tracing (OpenTelemetry) e métricas de negócio (pedidos por status, tempo médio de entrega).                                                |
| 6          | **Testes de carga**                         | O teste de concorrência cobre 10 pedidos; falta uma suíte com k6 ou autocannon.                                                            |

**Fora do escopo por decisão:** serverless (o enunciado lista como bônus, mas a stack com
long-running container é mais simples de operar e de testar), integração com transportadoras e
busca por CEP em tempo real.

---
