# Portal naPorta (`apps/web`)

Portal web da **naPorta** — o front que consome a Web API (`@naporta/api`).

## Stack

- **Next.js 16** (App Router, Server Components e Server Actions) + **React 19**
- **Tailwind CSS 4**
- **TypeScript 6** (strict)
- Contrato de dados compartilhado com a API: `@naporta/contracts`
- **Playwright** para a suíte e2e (no navegador, contra a API real)

## Como rodar

```bash
# na raiz do monorepo
npm run dev:web        # http://localhost:3001
```

A API precisa estar no ar (`npm run dev:api` ou `docker compose up -d`).

### Variáveis de ambiente

| Variável              | Onde é usada                                      | Padrão                         |
| --------------------- | ------------------------------------------------- | ------------------------------ |
| `API_URL`             | **servidor** (Server Components e Server Actions) | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_API_URL` | **browser** (filtros instantâneos)                | `http://localhost:3000/api/v1` |

No Docker, o Compose define `API_URL=http://api:3000/api/v1` (o serviço da rede) e
`NEXT_PUBLIC_API_URL` com a URL pública da API.

> O `.env` fica na **raiz do monorepo** — o `next.config.ts` o carrega.

## Telas

| Rota           | Tela                                             |
| -------------- | ------------------------------------------------ |
| `/login`       | Login (e-mail e senha)                           |
| `/`            | Dashboard: lista de pedidos, filtros e paginação |
| `/orders/new`  | Novo pedido                                      |
| `/orders/[id]` | Detalhe: itens, endereço, status e exclusão      |

## Testes e2e (Playwright)

A suíte do portal roda **no navegador e contra a API real** — sem mocks. Ela cobre o login, o
dashboard, a criação de pedido, a mudança de status e a exclusão.

```bash
# na raiz do monorepo
docker compose up -d --build        # API + portal no ar
npx playwright install chromium     # só na primeira vez (baixa o navegador)

npm run test:e2e:web                # roda a suíte
npm run test:e2e:web -- --ui        # modo interativo
npm run test:e2e:web -- --report    # abre o relatório HTML
```

| Arquivo                | Papel                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `playwright.config.ts` | Configuração (baseURL, reporter, `storageState`, 1 worker)  |
| `e2e/global-setup.ts`  | Cria o usuário, faz **um** login e salva o estado da sessão |
| `e2e/portal.spec.ts`   | Os 4 cenários do portal                                     |

Dois detalhes que valem explicar:

- o `globalSetup` existe porque as rotas de credencial da API têm **rate limit de 5/min**: com um
  único login e o estado da sessão salvo, a suíte consome 3 chamadas de credencial no total;
- cada pedido criado usa um **nome de cliente único**, para que as asserções não dependam da ordem
  dos testes.

Variáveis reconhecidas: `PORTAL_URL` (padrão `http://localhost:3001`) e `API_URL` (usada pelo
`globalSetup` para criar o usuário).

## Decisões

| Tema                       | Escolha                                                             | Por quê                                                                                              |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Sessão**                 | Cookies `httpOnly` + `sameSite=lax` + `secure`                      | O token **nunca** é acessível ao JavaScript do browser — um XSS não consegue roubá-lo.               |
| **Access token no client** | Em memória (via `SessionProvider`), nunca em `localStorage`         | `localStorage` persiste entre abas e é legível por qualquer script injetado.                         |
| **Refresh token**          | Só no cookie `httpOnly`; a rotação acontece no servidor             | O portal nunca vê o refresh token em JS — só a API o valida.                                         |
| **Renovação**              | O cliente recebe `401` → Server Action renova → repete a requisição | Transparente para a tela, sem polling nem timer.                                                     |
| **Dados**                  | Server Components para a primeira carga; browser para os filtros    | A primeira pintura vem do servidor (rápida e com SEO); os filtros respondem sem recarregar a página. |
| **Mutações**               | Server Actions                                                      | Validam no servidor e invalidam o cache com `revalidatePath`.                                        |
| **Contrato**               | `@naporta/contracts`                                                | Se a API mudar o formato das respostas, o portal **não compila**.                                    |
| **Regras de status**       | `ORDER_STATUS_TRANSITIONS` no contrato                              | A API valida e o portal oferece as ações — os dois concordam com o fluxo.                            |
| **Total do pedido**        | Calculado pela API                                                  | O formulário não manda total — a API ignora/rejeita o campo.                                         |

## Docker

```bash
# na raiz do monorepo
docker compose up -d --build web
```

Imagem multi-stage com a saída `standalone` do Next, usuário `node` sem privilégios, `tini` como
PID 1 e health check em `/login`.
