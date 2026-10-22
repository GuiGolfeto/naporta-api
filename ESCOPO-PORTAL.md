# Escopo — API naPorta + Portal Web (monorepo)

> Atualizado em 22/10/2026, após a conclusão dos Módulos 0–7.
> **Mudanças em relação ao escopo original:**
>
> 1. **Módulo 8 (CI) foi adiado** — a pedido do candidato, sem prejuízo no bônus
>    (a esteira é simples de adicionar depois; o repositório já tem os scripts
>    `lint`, `typecheck`, `test` e `build` prontos para ela).
> 2. **Novo Módulo 8: monorepo + portal web** (Next.js), substituindo o CI.
> 3. **Novo Módulo 9: documentação do monorepo e revisão final.**

---

## Objetivo

Reorganizar o projeto como **monorepo** e construir um **portal web** (Next.js) que consome a
API já pronta — demonstrando que a API é realmente utilizável por um front-end real.

---

## Estrutura do monorepo

```
naporta-desafio/                    # raiz do monorepo
├── package.json                     # npm workspaces + scripts orquestradores
├── package-lock.json
├── docker-compose.yml               # db + api + web
├── .env.example                     # variáveis compartilhadas
├── README.md                        # documenta o monorepo (raiz)
├── ESCOPO.md
│
├── apps/
│   ├── api/                         # ← a API NestJS (movida de src/ para cá)
│   │   ├── src/  prisma/  test/
│   │   ├── Dockerfile  .dockerignore
│   │   ├── package.json  tsconfig*.json  nest-cli.json
│   │   └── ...
│   └── web/                         # ← NOVO: portal Next.js 16 (App Router)
│       ├── src/app/                 # rotas, Server Components e Server Actions
│       ├── src/components/          # componentes de UI
│       ├── src/lib/                 # client da API + helpers
│       ├── Dockerfile  .dockerignore
│       └── package.json
│
└── packages/
    └── contracts/                   # NOVO: tipos do contrato API (usados pelo web)
        └── src/index.ts
```

### Decisões de toolchain

| Tema                       | Escolha                         | Por quê                                                                                                                         |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Package manager**        | **npm workspaces**              | O projeto já usa npm 11; trocar agora seria risco puro. Workspaces resolvem o compartilhamento de `node_modules` e o hoisting ✓ |
| **Orquestrador de tasks**  | **Sem Turborepo/Nx**            | Com 2 apps, o ganho não paga a complexidade. Os scripts da raiz (`dev:api`, `dev:web`, `test:all`, `lint:all`) resolvem ✓       |
| **Contrato compartilhado** | `packages/contracts`            | O portal tipa as respostas da API a partir de um único lugar — evita que o front e o back discordem do formato                  |
| **Fonte da verdade**       | A **API**                       | O `packages/contracts` espelha o contrato publicado pela API; a validação continua sendo a dos DTOs da API                      |
| **TypeScript**             | 6.0.3 nos dois apps             | Uma única versão no monorepo (e é a que o `typescript-eslint` aceita)                                                           |
| **Versions do Next**       | Next 16 + React 19 + Tailwind 4 | Stack atual, com App Router e Server Actions                                                                                    |

---

## O portal (Next.js 16, App Router)

### Telas

| Rota           | Tela                                                                                                   | Acesso                      |
| -------------- | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `/login`       | Login (e-mail e senha)                                                                                 | público                     |
| `/`            | **Dashboard**: resumo (total, por status, entrega prevista) + lista de pedidos com filtros e paginação | autenticado                 |
| `/orders/new`  | Novo pedido (cliente, documento, endereço, itens com preço)                                            | autenticado                 |
| `/orders/[id]` | Detalhe do pedido: itens, endereço, histórico de status, **mudar status**, **excluir**                 | autenticado (dono ou admin) |

### Autenticação no portal

> Decisão central: **o token nunca vai para o browser.**

- O login é um **Server Action** que chama `POST /api/v1/auth/login` na API;
- a resposta (access + refresh token) é gravada em **cookies `httpOnly` + `sameSite=lax` + `secure`**;
- os **Server Components** chamam a API no servidor, lendo o cookie e montando o header
  `Authorization: Bearer`;
- as **mutações** (criar, editar status, excluir) também são Server Actions;
- o refresh rotativo acontece no servidor, de forma transparente;
- rotas sem sessão são redirecionadas para `/login`.

Consequência: **nenhum CORS é necessário** (o browser nunca fala direto com a API) e o token
não pode ser roubado por XSS.

### Camadas do app web

```
apps/web/src/
├── app/
│   ├── layout.tsx              # shell, fonte, globals
│   ├── page.tsx                # dashboard
│   ├── login/page.tsx
│   ├── orders/new/page.tsx
│   ├── orders/[id]/page.tsx
│   └── actions/                # Server Actions (login, logout, pedidos)
├── components/                 # UI (tabela, filtros, form, cards, status)
├── lib/
│   ├── api-client.ts           # client HTTP da API (server-side)
│   ├── session.ts              # leitura/escrita dos cookies
│   └── format.ts               # formatação (moeda, data, status)
└── styles/globals.css
```

---

## Docker

| Serviço   | Mudança                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| `api`     | Contexto de build passa a ser `apps/api`                                             |
| `web`     | **NOVO** — imagem Next.js com `output: 'standalone'` (usuário não-root, multi-stage) |
| `db`      | inalterado                                                                           |
| `migrate` | inalterado (aplica as migrations e encerra)                                          |

`docker compose up -d --build` sobe **API + portal + banco** de uma vez.

---

## Módulos restantes

### Módulo 8 — Monorepo + portal web

1. **Monorepo**: raiz com workspaces; mover a API para `apps/api` (git mv, sem reescrever
   histórico); ajustar `package.json`, `tsconfig`, `nest-cli.json`, `Dockerfile`,
   `docker-compose.yml`, `.env.example` e os scripts — **verificando a cada passo**
   (lint, typecheck, build, testes unitários, e2e e stack Docker).
2. **`packages/contracts`**: tipos do contrato da API (pedido, sessão, filtros, status).
3. **`apps/web`**: Next.js 16 + Tailwind 4, com as quatro telas, o client da API, o
   tratamento de sessão por cookie httpOnly e as Server Actions.
4. **Docker do web** + serviço no compose.

**Aceite**: `docker compose up --build` sobe API e portal; o login no portal autentica contra
a API real; a lista de pedidos funciona com filtros; criar pedido, mudar status e excluir
funcionam pelo portal; a API continua íntegera (todas as suítes verdes).

### Módulo 9 — Documentação e revisão final

- `README.md` da raiz documentando o monorepo (dois apps, como rodar, o que é cada um)
- `README.md` do `apps/web` com as decisões do front
- Revisão final de consistência (nomes, scripts, variáveis, links)
- Verificação completa: lint, typecheck, build, testes, cobertura e stack Docker

**Aceite**: um avaliador lê a raiz e entende o monorepo; `npm run dev` por app funciona; o
Docker sobe os dois serviços.

---

## Fora do escopo (decidido)

- CI/CD — adiado a pedido
- Testes end-to-end do portal (Playwright) — o front é exercitado manualmente e via API
- Storybook, i18n, tema escuro, PWA
- Migração de dados entre ambientes
