# Escopo — API naPorta (Desafio Backend)

> Documento de planejamento. Este arquivo não faz parte da entrega final (pode ser removido
> ou incorporado ao `README.md` na Módulo 7).

## Identidade do projeto

| Item            | Decisão                                                      |
| --------------- | ------------------------------------------------------------ |
| Nome do projeto | `naporta-api`                                                |
| Diretório       | `/Users/golfeto/Desktop/naPorta-desafio`                     |
| Package manager | npm 11 (Node 24)                                             |
| Repositório     | `git init` local — **sem push remoto** até comando explícito |
| Porta           | `3000` (API) / `5432` (Postgres)                             |

## Premissas técnicas

| Item          | Decisão                                                   |
| ------------- | --------------------------------------------------------- |
| Runtime       | Node.js 24 + TypeScript `strict`                          |
| Framework     | NestJS 11                                                 |
| ORM           | Prisma 6                                                  |
| Banco         | PostgreSQL 16 (Docker Compose + volume nomeado)           |
| Testes        | Vitest (unit + e2e/Supertest) com `@swc/core`             |
| Lint/Format   | ESLint 9 (flat config) + Prettier                         |
| Docs          | Swagger/OpenAPI em `/docs`                                |
| Versionamento | `/api/v1/...`                                             |
| Idiomas       | Código/API em inglês; README e mensagens de erro em PT-BR |

## Decisões confirmadas

1. **Autorização**: pedido possui dono (`createdBy` → `User`). Usuário comum só lê/edita os
   próprios pedidos; `ADMIN` lê e gerencia todos.
2. **Status**: 6 status com transições válidas — `PENDING`, `CONFIRMED`, `PROCESSING`,
   `SHIPPED`, `DELIVERED`, `CANCELLED`. Transição inválida → `409 Conflict`.
3. **Dinheiro**: `Decimal(12,2)` no Postgres (Prisma `Decimal`), serializado como `number`
   com 2 casas na resposta da API.
4. **Serverless**: fora do escopo.
5. **Execução**: checkpoint (pausa) ao final de cada módulo, aguardando aprovação.

---

## Módulos

### Módulo 0 — Fundação

- Estrutura NestJS: `src/modules/*`, `src/common/*`, `src/config/*`, `prisma/`
- ESLint + Prettier (`lint`, `lint:fix`, `format`)
- Config de env tipada e **validada no boot** (falha se faltar variável) + `.env.example`
- `docker-compose.yml` com `postgres:16-alpine`, volume nomeado, healthcheck
- `GET /api/v1/health` (liveness) e `GET /api/v1/health/ready` (ping no DB)
- Scripts: `dev`, `build`, `start`, `lint`, `format`, `test`, `test:e2e`, `test:cov`, `seed`

**Aceite**: `npm run dev` sobe a API; `/api/v1/health` retorna 200; Postgres acessível via Docker.

### Módulo 1 — Camada de dados

- `schema.prisma`: `User`, `RefreshToken`, `Order`, `Address`, `OrderItem`;
  enums `Role` (`USER`, `ADMIN`) e `OrderStatus`
- Migrations versionadas em `prisma/migrations`
- `Address` (1:1) e `OrderItem` (1:N) como tabelas relacionadas — Prisma composite types
  só existem para MongoDB
- `Order` ↔ `User` via `createdById` (índice)
- `Order.number` único com padrão `NP-YYYY-#####` (sequencial por ano, via sequence do Postgres)
- `Order.deletedAt` (nullable) para soft delete; índice parcial para unicidade do `number`
  desconsiderando deletados

**Aceite**: `prisma migrate dev` gera migration; `prisma studio` abre com o schema modelado.

### Módulo 2 — Autenticação & segurança

- Rotas: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/logout`, `GET /auth/me`
- Senha com hash **argon2id** (fallback bcrypt); JWT access curto + refresh rotativo e revogável
- `JwtAuthGuard` + decorator `@Public()`; `RolesGuard` + decorator `@Roles()`
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- `helmet`, CORS restrito por env, `Throttler` (mais agressivo em `/auth/login`)
- Política de senha; `passwordHash` nunca serializado; `register` não permite escolher role

**Aceite**: fluxo register → login → `/auth/me` funciona com Bearer token; sem token, 401;
usuário comum acessando pedido alheio, 403.

### Módulo 3 — Pedidos (core)

- `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id`, `DELETE /orders/:id`
- Filtros combináveis: `number`, `status`, `startDate`, `endDate` (sobre
  `expectedDeliveryDate`), `page`, `limit`, `sortBy`, `order`
- Paginação: `{ data, meta: { total, page, limit, totalPages } }`
- Erros padronizados: `{ statusCode, error, message, details?, path, timestamp }`
- Soft delete via `deletedAt` + extensão Prisma (`$extends` query extension) que filtra
  `deletedAt: null` automaticamente
- Regras de negócio: transições de status válidas (409), documento CPF/CNPJ válido,
  `number` único, endereço obrigatório, itens com preço > 0, total derivado dos itens
- Autorização por ownership + role admin

**Aceite**: CRUD completo; filtros por número/status/período funcionam; pedido deletado
retorna 404 e some das listagens; transição inválida retorna 409.

### Módulo 4 — Seed

- `prisma/seed.ts` idempotente: 1 admin + 2 usuários + ~60 pedidos fictícios
- Variedade: status variados, datas passadas/futuras, 1–5 itens por pedido, endereços BR plausíveis
- Documentos CPF/CNPJ válidos para a validação passar

**Aceite**: `npm run seed` popula o banco; rodar 2x não duplica nem quebra.

### Módulo 5 — Testes automatizados

- **Unit**: services de auth e orders, validadores (CPF/CNPJ, transições), utilitários
  (paginação, sanitização de filtros)
- **E2E** (Supertest): fluxo de auth, CRUD de pedido, filtros, soft delete, erros
  (401/403/404/409/422), paginação
- Postgres de teste isolado (service `db-test` no compose, profile `test`)
- Relatório de cobertura

**Aceite**: `npm test` e `npm run test:e2e` passam; cobertura reportada.

### Módulo 6 — Docker

- `Dockerfile` multi-stage (deps → build → runtime), usuário **não-root**, `HEALTHCHECK`
- Entrypoint executa `prisma migrate deploy` antes de subir a API
- `docker-compose.yml`: `api` + `db` (+ `adminer` opcional) + `.dockerignore`

**Aceite**: `docker compose up --build` sobe stack completa e `/api/v1/health` responde.

### Módulo 7 — Documentação

- `README.md`: pré-requisitos, execução local e via Docker, scripts, seed, testes, cobertura
- Seção **"Decisões & Justificativas"** (stack, modelagem, segurança, soft delete, dinheiro)
- Diagrama de arquitetura (Mermaid) + diagrama ER (Mermaid)
- OpenAPI interativa em `/docs`

**Aceite**: README permite a um avaliador rodar o projeto do zero, seguindo só o documento.

### Módulo 8 — Bônus

- CI: `.github/workflows/ci.yml` (lint → test → build) — **criado localmente, sem push**
- Rate limiting já no Módulo 2; extras apenas se houver folga

**Aceite**: workflow executa os passos localmente com sucesso (`act`/push manual sob comando).

---

## Não escopo (explícito)

- Serverless / deploy em nuvem
- Frontend
- Integração com transportadoras / CEP real
- Multi-tenant
- Push para GitHub (somente sob comando explícito do candidato)

## Riscos técnicos e mitigações

1. Prisma composite types → só MongoDB; usamos tabelas relacionadas.
2. Dinheiro/Decimal → `Decimal(12,2)` no banco, serialização explícita para `number`.
3. Vitest + Nest → esbuild não emite `emitDecoratorMetadata`; usamos `@swc/core` + `unplugin-swc`.
4. Soft delete + unicidade do `number` → extensão Prisma + índice parcial.
5. Refresh token → tabela própria com rotação, revogação e detecção de reuso.
