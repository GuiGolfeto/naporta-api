# Roadmap — naPorta

Documento de consolidação de **tudo que foi construído** no desafio: linha do tempo, entregas por
módulo, decisões técnicas, números do projeto e o que ficou de fora.

> **Desafio original:** Web API para gestão de pedidos, com autenticação JWT, banco relacional,
> ORM, rotas REST, README, seed, testes automatizados e Docker.
> **Entregue:** o escopo completo **mais** um portal web real consumindo a API, um pacote de
> contrato compartilhado e documentação OpenAPI gerada do código.

**Documentos relacionados**

| Documento                                          | Conteúdo                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [`../README.md`](../README.md)                     | Porta de entrada do projeto: como executar, referência da API e decisões |
| [`ESCOPO.md`](./ESCOPO.md)                         | Escopo planejado, revisões e o que ficou fora                            |
| [`documento-tecnico.pdf`](./documento-tecnico.pdf) | Documento técnico completo (23 páginas, com diagramas)                   |

---

## 1. Visão geral

```
naporta-desafio/                        134 arquivos versionados
├── apps/
│   ├── api/                            Web API — NestJS 12 + Prisma 7 + PostgreSQL 16
│   └── web/                            Portal — Next.js 16 + React 19 + Tailwind 4
├── packages/
│   └── contracts/                      Contrato de dados compartilhado entre os dois apps
└── docker-compose.yml                  db + migrate + api + web
```

| Números               |                                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| Linhas de código      | **8.219** (API 3.883 · testes 1.790 · portal 1.709 · contratos 263)               |
| Testes                | **153** (64 unitários + 89 e2e)                                                   |
| Cobertura (suíte e2e) | **78%** statements · **85%** functions · **79%** lines — com **piso configurado** |
| Endpoints             | **10**                                                                            |
| Telas do portal       | **4**                                                                             |
| Tabelas / índices     | **6** / **19**                                                                    |
| Migrations            | **1** (versionada)                                                                |
| Commits               | **11** (todos locais — nada enviado ao GitHub)                                    |
| Imagens Docker        | API **175 MB** · portal **97 MB** (usuário sem privilégios, health check)         |

---

## 2. Linha do tempo

| #   | Módulo                       | Entrega                                                                                                      | Commit    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| 0   | **Fundação**                 | Estrutura do NestJS, ESLint/Prettier, env validado com Joi, Docker Compose, health checks, harness de testes | `d399aeb` |
| 1   | **Camada de dados**          | 6 modelos, enums, migration versionada, extensão de soft delete do Prisma, numeração sequencial atômica      | `c520a7c` |
| 2   | **Autenticação & segurança** | register/login/refresh/logout/me, JWT + refresh rotativo, argon2id, guards globais, rate limit               | `0016c14` |
| 3   | **Pedidos (core)**           | CRUD completo, filtros, paginação, transições de status, ownership, serialização de `Decimal`                | `2c3e1f6` |
| 4   | **Seed**                     | Dados fictícios por comando explícito, idempotente e reproduzível; alternativa via API                       | `58f6f43` |
| 5   | **Testes & cobertura**       | Consolidação da suíte, cobertura com piso, testes de concorrência e precisão                                 | `850630c` |
| 6   | **Docker**                   | Imagem multi-stage da API, serviço de migrations, stack completa                                             | `0b0a9b1` |
| 7   | **Documentação**             | OpenAPI/Swagger gerado do código + README reescrito                                                          | `f920840` |
| 8   | **CI (bônus)**               | Integração contínua no GitHub Actions: qualidade, testes com Postgres de serviço e build das imagens         | `74038ac` |
| 9   | **Monorepo + portal**        | Reorganização em workspaces, `packages/contracts`, portal Next.js completo                                   | `f71ee69` |
| 10  | **Revisão final**            | Consistência de scripts/variáveis/links/estrutura e validação do portal de ponta a ponta                     | `d492a1d` |

---

## 3. O que cada módulo entregou

### Módulo 0 — Fundação

- Projeto NestJS 12 em **ESM** + TypeScript 6 `strict` (`nodenext`, `noUncheckedIndexedAccess`)
- **Ambiente validado com Joi antes do DI subir** — falha rápido, com mensagem clara
- ESLint 10 (flat config, com type-checking) + Prettier como fonte única de formatação
- Docker Compose (Postgres 16, volume nomeado, healthcheck) e harness de testes (Vitest + SWC)

### Módulo 1 — Camada de dados

- `users`, `orders`, `addresses`, `order_items`, `refresh_tokens`, `order_counters`
- Enums `Role` e `OrderStatus`; tabelas/colunas em `snake_case`; **IDs UUID v4**
- **Extensão do Prisma** que torna o soft delete transparente: leituras ignoram excluídos,
  `update` só alcança ativos e `delete` nunca apaga a linha
- `OrderNumberService`: sequencial anual por **upsert atômico** (`ON CONFLICT ... RETURNING`)

### Módulo 2 — Autenticação & segurança

- JWT HS256 (15 min) + **refresh opaco rotativo** (só o hash SHA-256 é persistido)
- **Detecção de reuso**: reapresentar um refresh token revoga todas as sessões do usuário
- Senhas com **argon2id** (parâmetros OWASP) em serviço isolado
- `JwtAuthGuard` + `@Public()` e `RolesGuard` + `@Roles()` como **guards globais**
  (política _secure by default_)
- Rate limit configurável (5/min em credenciais, 100/min global), `helmet`, CORS por whitelist,
  `TRUST_PROXY=0` por padrão
- Login com resposta genérica e verificação de hash descartável (anti enumeração de contas)

### Módulo 3 — Pedidos (core)

- `POST/GET/GET:id/PATCH:id/DELETE:id` em `/api/v1/orders`
- Filtros por **número, status e período** + paginação e ordenação com lista branca
- Regras: total **sempre** calculado no servidor, transição de status validada (inválida → 409),
  CPF/CNPJ por dígitos verificadores, preço em `Decimal(12,2)` com no máximo 2 casas
- **Propriedade**: usuário comum só vê os próprios pedidos; pedido alheio → **404** (não 403)
- Exclusão lógica com resposta `204`

### Módulo 4 — Seed

- `prisma/seed.ts` populando **só por comando explícito** — a API nunca popula sozinha
- 3 usuários + 60 pedidos fictícios, com status coerente com a data prevista
- **Idempotente** (não duplica) e **reproduzível** (semente fixa)
- `npm run seed:api` popula **passando pela API** (valida a API de ponta a ponta)

### Módulo 5 — Testes & cobertura

- 64 unitários + 89 e2e, com **piso de cobertura** (a suíte falha se a qualidade cair)
- Cenários que provam comportamento: soft delete real, 10 pedidos simultâneos sem colisão de
  número, `3 × 0.10 + 0.20 = 0.50`, reuso de refresh token, rate limit `429`, contrato de erro
- Datas relativas a "hoje" — a suíte não expira com o tempo

### Módulo 6 — Docker

- `Dockerfile` multi-stage em 4 estágios, usuário `node` (uid 1000), `tini` como PID 1,
  health check com o `fetch` nativo (sem `curl` na imagem)
- **Migrations como serviço separado** — o CLI do Prisma não está na imagem final
- O serviço de migrations roda **apenas** `migrate deploy`: o banco nasce limpo

### Módulo 7 — Documentação

- **OpenAPI/Swagger gerado do código** (plugin do `@nestjs/swagger`): os DTOs são a fonte da
  verdade da validação **e** da documentação
- README reescrito como porta de entrada do projeto, com "como avaliar em 5 minutos", diagramas
  de arquitetura e ER, decisões justificadas por tema e limitações conhecidas

### Módulo 9 — Monorepo + portal

- **npm workspaces** (sem Turborepo/Nx): `apps/api`, `apps/web`, `packages/contracts`
- A API movida com `git mv` (histórico preservado); Dockerfiles, compose e scripts ajustados
- `packages/contracts`: as classes de resposta da API **implementam** os tipos do contrato — se a
  API mudar o formato, **o portal não compila**. As regras de transição de status também moram lá
- Portal com 4 telas: login, dashboard (filtros e paginação), novo pedido e detalhe
- Sessão em **cookies `httpOnly`**; o refresh token nunca sai do cookie e o access token vive
  **em memória** no cliente (nunca em `localStorage`)
- Renovação transparente: um `401` dispara a Server Action de renovação e a requisição é repetida

### Módulo 10 — Revisão final

- Consistência de scripts, variáveis, links e estrutura — verificada por script, não por olho
- Portal validado de ponta a ponta (login → cookies → dashboard), em dev e no Docker

---

## 4. Escopo do desafio × o que foi entregue

| Requisito do enunciado                             | Status | Onde                                                     |
| -------------------------------------------------- | ------ | -------------------------------------------------------- |
| API em Node.js com NestJS                          | ✅     | `apps/api`                                               |
| Autenticação JWT com Bearer                        | ✅     | `apps/api/src/modules/auth`                              |
| Banco relacional                                   | ✅     | PostgreSQL 16 (Docker)                                   |
| ORM                                                | ✅     | Prisma 7                                                 |
| Rotas REST                                         | ✅     | 10 endpoints versionados em `/api/v1`                    |
| README com execução e scripts                      | ✅     | `README.md` (raiz) (+ `apps/web/README.md`)              |
| Seed com pedidos fictícios                         | ✅     | `prisma/seed.ts` (por comando)                           |
| Criar / listar / filtrar / editar / excluir pedido | ✅     | filtro por número, status e período                      |
| Estrutura de dados do pedido                       | ✅     | cliente, endereço, itens, data prevista, data de criação |
| Exclusão lógica                                    | ✅     | extensão do Prisma                                       |
| **Clean Code**                                     | ✅     | módulos, guards, filtros, mappers, tipagem estrita       |
| **Testes automatizados**                           | ✅     | 153 testes + cobertura com piso                          |
| **Docker**                                         | ✅     | 4 serviços, imagens não-root com health check            |
| **Linter**                                         | ✅     | ESLint 10 com type-checking + Prettier                   |
| Serverless                                         | ⏭️     | fora de escopo por decisão (documentada)                 |
| **Bônus: portal web**                              | ✅     | `apps/web` (Next.js 16)                                  |
| **Bônus: OpenAPI**                                 | ✅     | `/docs` e `/docs-json`                                   |
| **Bônus: contrato compartilhado**                  | ✅     | `packages/contracts`                                     |

---

## 5. Decisões técnicas que definem o projeto

| Tema                     | Decisão                                         | Por quê                                                                             |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Módulos ESM**          | Projeto em ESM                                  | O ecossistema NestJS 12 é ESM-first; forçar CommonJS exigiria pacotes incompatíveis |
| **TypeScript 6.0**       | `nodenext`                                      | Única versão que satisfaz os peers de `@nestjs/schematics` e do `typescript-eslint` |
| **Prisma 7**             | Client gerado como TypeScript (sem engine Rust) | Cold start mais rápido, tipos no repositório                                        |
| **Vitest + SWC**         | `unplugin-swc`                                  | O Nest depende de `emitDecoratorMetadata`, que o esbuild não implementa             |
| **Composição no Prisma** | `PrismaService.client`                          | A extensão do Prisma 7 devolve um objeto novo; herdar exigiria `as unknown as`      |
| **Soft delete**          | Extensão do Prisma                              | Registro excluído nunca vaza por uma leitura "esquecida" de filtro                  |
| **Número do pedido**     | Upsert atômico no Postgres                      | Atomicidade vem do banco — sem lock explícito                                       |
| **Dinheiro**             | `Decimal(12,2)` no banco                        | `3 × 0.10 + 0.20 = 0.50`, nunca `0.5000000000000001`                                |
| **Total**                | Sempre calculado no servidor                    | O cliente não informa o valor                                                       |
| **Unicidade do número**  | Global (nunca reutilizado)                      | O número é identificador de negócio (como nota fiscal)                              |
| **Senhas**               | argon2id (OWASP)                                | Resistente a GPU/ASIC; serviço isolado para troca                                   |
| **Refresh token**        | Valor opaco + hash SHA-256 persistido           | Vazamento do banco não permite reaproveitar sessão                                  |
| **Reuso**                | Detecção que revoga todas as sessões            | Indício de roubo: invalida tudo, não só o token                                     |
| **Erros**                | Filtro global + contrato único                  | `P2002`→409, `P2025`→404, `P2003`→400, conexão→503                                  |
| **Validação**            | `422 Unprocessable Entity`                      | Distingue "malformada" (400) de "regra violada" (422)                               |
| **Propriedade**          | Pedido alheio → 404                             | A API não confirma a existência do que o solicitante não pode ver                   |
| **`TRUST_PROXY`**        | `0` por padrão                                  | `X-Forwarded-For` forjável escaparia do rate limit                                  |
| **Sessão no portal**     | Cookies `httpOnly`; token do cliente em memória | XSS não lê o token; `localStorage` persiste entre abas                              |
| **Contrato**             | `packages/contracts` com `implements`           | Mudança de formato quebra a compilação do portal                                    |
| **Configuração única**   | `app.setup.ts` compartilhado                    | Dev e e2e usam o mesmo pipeline                                                     |
| **Seed explícita**       | Banco nasce vazio                               | O que entra é sempre uma decisão consciente                                         |
| **Migrations**           | Serviço separado no Compose                     | CLI do Prisma fora da imagem final                                                  |
| **Cobertura**            | Piso configurado                                | A suíte é rede de segurança, não formulário                                         |
| **Integração contínua**  | GitHub Actions, 3 jobs paralelos                | O mesmo pipeline que roda localmente — com Postgres de serviço para os e2e          |

---

## 6. Problemas reais encontrados (e como foram resolvidos)

| Problema                                                         | Resolução                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm prune --omit=dev` não remove as dev deps no npm 11          | `npm ci --omit=dev` num estágio próprio do Dockerfile                                         |
| `npm ci` no estágio `deps` rodava `prisma generate` sem o schema | `--ignore-scripts` (o generate fica no estágio `build`)                                       |
| Plugins do Nest CLI lidos do lugar errado                        | Ficam em `compilerOptions.plugins` — no lugar errado o plugin **não roda e não dá erro**      |
| `import type` quebra a injeção de dependência do Nest            | O `design:paramtypes` precisa do **valor** da classe em runtime                               |
| O plugin do Swagger só processa **classes**                      | Tipos de resposta convertidos em classes                                                      |
| Extensões do Prisma 7 e herança                                  | Composição (`PrismaService.client`) preservando a tipagem                                     |
| A suíte e2e chegou a limpar o banco de desenvolvimento           | `.env` carregado a partir dos ancestors + **recusa** rodar contra banco que não seja de teste |
| Filtro global validando o `@CurrentUser`                         | `validateCustomDecorators: false` — o valor vem do servidor, não do cliente                   |
| Protocolo interno de Server Action com `FormData`                | Ações passaram a receber argumentos — mais simples e verificável                              |

---

## 7. Limitações conhecidas

| Item                        | Situação                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| **Rate limit distribuído**  | Em memória: com várias instâncias, o limite vale por instância   |
| **Refresh por dispositivo** | A rotação é por sessão; falta listar/revogar dispositivos        |
| **Histórico de itens**      | Ao trocar a lista de itens, os antigos são removidos fisicamente |
| **Notificações**            | A mudança de status é síncrona; com e-mail/SMS viraria um job    |
| **Observabilidade**         | Sem tracing (OpenTelemetry) nem métricas de negócio              |
| **Testes de carga**         | Há teste de concorrência, falta k6/autocannon                    |
| **Deploy automático**       | O CI valida e publica artefatos; o deploy em produção é manual   |
| **Testes e2e do portal**    | Sem Playwright; o portal é exercitado manualmente e via API      |

---

## 8. Próximos passos sugeridos

1. **Testes e2e do portal com Playwright** — cobrindo login, criação e mudança de status
2. **Rate limit com Redis** — para rodar múltiplas instâncias da API
3. **Refresh tokens por dispositivo** — listar e revogar as sessões ativas
4. **Histórico de itens** — `deleted_at` também nos itens, preservando a auditoria
5. **Fila de notificações** — mudança de status publica um evento
6. **Observabilidade** — tracing distribuído e métricas de negócio
7. **Deploy automático** — a partir do CI, com promoção de imagem entre ambientes

---

## 9. Como rodar

```bash
# Stack completa (banco + migrations + API + portal)
cp .env.example .env
docker compose up -d --build

# Portal      → http://localhost:3001
# API         → http://localhost:3000/api/v1
# Swagger UI  → http://localhost:3000/docs

# Dados fictícios
npm run seed

# Testes
npm run test:all
```

**Credenciais da seed:** `admin@naporta.local` / `Admin@1234` (ADMIN) ·
`operador@naporta.local` / `Operador@1234` (USER)

---
