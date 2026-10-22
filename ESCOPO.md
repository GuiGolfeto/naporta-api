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
6. **Número do pedido** _(revisado no Módulo 1)_: `number` com **unicidade global**, e não
   índice parcial sobre os registros ativos. O número é um identificador de negócio (equivale
   a um número de nota fiscal): reutilizá-lo após a exclusão lógica criaria ambiguidade no
   histórico e na auditoria. Com a unicidade global, a exclusão lógica **reserva** o número.

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

### Módulo 1 — Camada de dados ✅ CONCLUÍDO

- `schema.prisma`: `User`, `RefreshToken`, `Order`, `Address`, `OrderItem`, `OrderCounter`;
  enums `Role` (`USER`, `ADMIN`) e `OrderStatus` (`PENDING`, `CONFIRMED`, `PROCESSING`,
  `SHIPPED`, `DELIVERED`, `CANCELLED`)
- Migration versionada: `prisma/migrations/20261022045736_init/migration.sql`
- Tabelas e colunas em `snake_case` (`@@map`/`@map`); IDs UUID v4; `onDelete: Cascade` nos filhos
- `Order.address` como tabela 1:1 e `Order.items` como 1:N — Prisma composite types só existem
  para MongoDB
- `Order.number` único **global** (`NP-AAAA-NNNNN`): o número nunca é reutilizado, nem após
  soft delete _(decisão revista durante a implementação — ver "Decisões confirmadas")_
- `deletedAt` em `Order` e `User` + extensão do Prisma (`prisma.extensions.ts`) que aplica o
  soft delete de forma transparente (leituras filtram, `update` só alcança ativos, `delete`
  marca `deleted_at`)
- `OrderNumberService`: sequencial anual gerado por upsert atômico
  (`INSERT ... ON CONFLICT ... RETURNING`) — sem race condition
- Testes: 7 de integração do soft delete, 5 de integração da numeração (incluindo 25 chamadas
  simultâneas), 3 unitários do formatador

**Aceite**: `prisma migrate dev` aplica sem erro · schema criado no Postgres · soft delete
comporta-se como exclusão lógica de verdade · numeração sequencial e sem duplicatas · lint,
build e suites verdes.

### Módulo 2 — Autenticação & segurança ✅ CONCLUÍDO

- Rotas: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/logout`, `GET /auth/me`
- Senha com hash **argon2id** (19 MiB, 2 iterações, 1 thread — OWASP), em serviço isolado para
  permitir troca de algoritmo
- JWT access (15 min, HS256, `issuer`/`audience`/`type: 'access'`) + refresh **opaco** de 48 bytes
  com apenas o **hash SHA-256** persistido
- Refresh **rotativo** com **detecção de reuso**: reapresentar um token já rotacionado revoga
  todas as sessões do usuário
- `JwtAuthGuard` + `@Public()` e `RolesGuard` + `@Roles()` registrados como guards globais
  (_secure by default_); sem Passport — apenas `@nestjs/jwt`
- Guard recarrega o usuário do banco a cada requisição: conta desativada/excluída perde o acesso
  imediatamente
- `ValidationPipe` global com `whitelist` + `forbidNonWhitelisted` e status **422** para erros de
  validação
- `helmet` com CSP, CORS por whitelist, `TRUST_PROXY` seguro por padrão (0) e rate limit
  configurável: 5/min nas rotas de credencial e 100/min global
- Política de senha (mín. 8, letra + número); `passwordHash` nunca serializado; o papel não
  existe no DTO de cadastro (impede escalonamento de privilégio)
- Login com resposta genérica e verificação de hash descartável (anti enumeração de contas)

**Aceite**: register → login → `/auth/me` funciona com Bearer token; sem token, 401; token
inválido, 401; refresh rotaciona e reuso revoga as sessões; logout revoga; conta desativada
perde o acesso; rate limit responde 429.

### Módulo 3 — Pedidos (core) ✅ CONCLUÍDO

- `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id`, `DELETE /orders/:id`
- Filtros combináveis: `number`, `status`, `startDate`, `endDate` (sobre
  `expectedDeliveryDate`), `page`, `limit`, `sortBy`, `order`
- Paginação: `{ data, meta: { total, page, limit, totalPages } }`
- Erros padronizados: `{ statusCode, error, message, details?, path, timestamp, requestId? }`
- Soft delete pela extensão do Prisma (Módulo 1) — `delete` marca `deleted_at`
- Regras de negócio: total sempre calculado no servidor (o cliente não envia), transição de status
  validada (inválida → 409), documento CPF/CNPJ com dígitos verificadores, preço em `Decimal(12,2)`
  com no máximo 2 casas, data prevista `YYYY-MM-DD` e não no passado
- Propriedade: usuário comum só acessa os próprios pedidos; `ADMIN` acessa todos. Pedido de outra
  pessoa responde **404** (e não 403) — a API não confirma a existência do registro
- `Decimal` serializado como `number` na resposta; data como `YYYY-MM-DD`
- Exclusão: `204 No Content`

**Aceite**: CRUD completo; filtros por número/status/período funcionam; paginação e ordenação
funcionam; transição inválida → 409; pedido excluído responde 404 e some das listagens (mas
continua na tabela); usuário alheio → 404; total calculado no servidor.

### Módulo 4 — Seed ✅ CONCLUÍDO

- `prisma/seed.ts` — popula o banco **somente por comando explícito** (`npm run seed` /
  `prisma db seed`); a aplicação **nunca** popula o banco sozinha (o banco nasce vazio)
- `prisma/seed-data.ts` — dados fictícios: 3 usuários, 16 clientes, 10 endereços e 12 produtos
  (nomes, CPFs/CNPJs com dígitos verificadores válidos e endereços inventados)
- 60 pedidos com status coerente com a data prevista (passado → `DELIVERED`/`CANCELLED`,
  futuro → `PENDING`/`CONFIRMED`), 1 a 5 itens cada, totais calculados em `Decimal`
- Números `NP-AAAA-NNNNN` gerados pelo **mesmo** código da API (`nextOrderNumber`), sequenciais
  por ano
- Senhas com hash argon2id — as credenciais da seed funcionam no login
- **Idempotente**: se já houver usuários, nada é alterado (avisa no console)
- **Reprodutível**: gerador pseudoaleatório com semente fixa
- `scripts/populate-via-api.ts` (`npm run seed:api`) — alternativa que popula **só pela API**
  (HTTP), exercitando a API de ponta a ponta
- `npm run db:reset` — recria o schema e roda a seed

**Aceite**: `npm run seed` popula 3 usuários e 60 pedidos; rodar de novo não duplica nada; os
pedidos aparecem na API com os filtros funcionando; login com as credenciais da seed funciona;
a API sobe com o banco vazio sem popular nada.

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
