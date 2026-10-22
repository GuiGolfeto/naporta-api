/**
 * Popula o banco **através da API** (HTTP), sem escrever direto no Postgres.
 *
 * Serve a dois propósitos:
 *  - inicializa um ambiente de demonstração usando apenas a API pública;
 *  - exercita a API de ponta a ponta (validação, autenticação, criação).
 *
 * Requer a API no ar. Ajuste a URL com `API_BASE_URL`:
 *
 * ```bash
 * npm run dev          # em outro terminal
 * npm run seed:api
 * ```
 *
 * Observação: a API não permite escolher o papel do usuário e recusa data
 * prevista no passado — por isso este script cria apenas usuários `USER` e
 * pedidos com entrega futura. Para dados históricos (e o administrador),
 * use `npm run seed`.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const PASSWORD = 'Demo@1234';
const USERS_COUNT = 3;
const ORDERS_PER_USER = 5;

interface Session {
  token: string;
  email: string;
}

interface Product {
  description: string;
  unitPrice: string;
}

const PRODUCTS: Product[] = [
  { description: 'Caixa de papelão reforçado', unitPrice: '49.90' },
  { description: 'Envelope acolchoado A4', unitPrice: '8.50' },
  { description: 'Fita adesiva transparente', unitPrice: '12.00' },
  { description: 'Etiquetas térmicas (rolo 100)', unitPrice: '39.90' },
  { description: 'Brindes personalizados (unidade)', unitPrice: '7.35' },
];

const CUSTOMERS = [
  { name: 'Maria Silva', document: '10020030088' },
  { name: 'João Oliveira', document: '10721331726' },
  { name: 'Carla Beatriz Reis', document: '12825236861' },
];

const ADDRESS = {
  street: 'Rua das Flores',
  number: '123',
  complement: 'Apto 42',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01001000',
};

function dataFutura(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);

  return { status: response.status, body };
}

async function main(): Promise<void> {
  console.log(`🌐 Populando via API: ${API_BASE_URL}`);

  const health = await request<{ status: string }>('/health');

  if (health.status !== 200) {
    throw new Error(
      `A API não está no ar (${health.status}). Suba com "npm run dev" ou "docker compose up -d".`,
    );
  }

  const suffix = Date.now();
  let createdOrders = 0;

  for (let index = 1; index <= USERS_COUNT; index += 1) {
    const email = `demo${index}-${suffix}@naporta.local`;

    const registration = await request<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: `Usuário Demo ${index}`,
        email,
        password: PASSWORD,
      }),
    });

    if (registration.status !== 201) {
      throw new Error(`Falha no cadastro de ${email}: ${JSON.stringify(registration.body)}`);
    }

    const session: Session = { token: registration.body.accessToken, email };
    console.log(`   👤 ${session.email}`);

    for (let orderIndex = 0; orderIndex < ORDERS_PER_USER; orderIndex += 1) {
      const itemCount = 1 + (orderIndex % 3);

      const items = Array.from({ length: itemCount }, (_unused, itemIndex) => {
        const product = PRODUCTS[(orderIndex + itemIndex) % PRODUCTS.length] as Product;

        return {
          description: product.description,
          quantity: 1 + (itemIndex % 3),
          unitPrice: product.unitPrice,
        };
      });

      const creation = await request<{ number: string }>('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          expectedDeliveryDate: dataFutura(3 + orderIndex * 5),
          customerName: CUSTOMERS[(index + orderIndex) % CUSTOMERS.length]?.name ?? 'Cliente',
          customerDocument:
            CUSTOMERS[(index + orderIndex) % CUSTOMERS.length]?.document ?? '10020030088',
          address: ADDRESS,
          items,
        }),
      });

      if (creation.status !== 201) {
        throw new Error(`Falha na criação do pedido: ${JSON.stringify(creation.body)}`);
      }

      createdOrders += 1;
      console.log(`   📦 ${creation.body.number}`);
    }
  }

  console.log(`\n✅ ${createdOrders} pedidos criados via API.`);
  console.log('   Os usuários criados usam a senha:', PASSWORD);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌ Falha ao popular via API:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
