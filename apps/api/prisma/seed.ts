/**
 * Seed — popula o banco com dados fictícios para demonstração.
 *
 * Executar com `npm run seed` (ou `npx prisma db seed`).
 *
 * Princípios:
 *  - a API **nunca** popula o banco sozinha: quem popula é este script (ou a
 *    própria API, via requisições HTTP);
 *  - é idempotente: se o banco já tiver dados, nada é duplicado;
 *  - é reprodutível: o gerador pseudoaleatório tem semente fixa, então a
 *    mesma seed produz sempre os mesmos dados.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
import type { HashOptions } from 'argon2';

import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { loadDotEnv } from '../src/config/load-dotenv.js';
import { nextOrderNumber } from '../src/modules/orders/order-number.js';
import {
  SEED_ADDRESSES,
  SEED_CUSTOMERS,
  SEED_PRODUCTS,
  SEED_RANDOM_SEED,
  SEED_USERS,
} from './seed-data.js';

/**
 * Parâmetros do Argon2id — os mesmos do `PasswordService` da aplicação
 * (19 MiB, 2 iterações, 1 thread), para que as senhas da seed sejam
 * validadas pelo mesmo código.
 *
 * A tipagem do pacote declara `type` como o *nome* do algoritmo, mas a
 * implementação nativa espera a constante numérica.
 */
const ARGON2_OPTIONS = {
  type: argon2id as unknown as HashOptions['type'],
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} satisfies HashOptions;

/** Quantos pedidos fictícios são criados. */
const ORDERS_COUNT = 60;

/** Gerador pseudoaleatório com semente fixa (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);

  return items[index] as T;
}

function randomInt(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Status coerente com a data prevista: pedidos antigos já foram entregues,
 * pedidos futuros ainda estão em aberto.
 */
function statusForDate(
  expectedDeliveryDate: Date,
  today: Date,
  random: () => number,
): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
  const daysFromToday = Math.round(
    (expectedDeliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysFromToday < 0) {
    return random() < 0.12 ? 'CANCELLED' : 'DELIVERED';
  }

  if (daysFromToday === 0) {
    return pick(['PROCESSING', 'SHIPPED'] as const, random);
  }

  if (daysFromToday <= 2) {
    return pick(['CONFIRMED', 'PROCESSING'] as const, random);
  }

  return 'PENDING';
}

async function main(): Promise<void> {
  // O .env fica na raiz do monorepo (o app vive em apps/api).
  loadDotEnv();

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não configurada. Copie o .env.example para .env antes de rodar a seed.',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      console.log(
        `⏭️  Banco já populado (${existingUsers} usuário(s)). Nada foi alterado — a seed é idempotente.`,
      );
      console.log('   Para recomeçar do zero: npm run db:reset');
      return;
    }

    console.log('🌱 Populando o banco com dados fictícios...');

    // ---------------------------------------------------------------- usuários
    const users = [];

    for (const seedUser of SEED_USERS) {
      const user = await prisma.user.create({
        data: {
          name: seedUser.name,
          email: seedUser.email,
          passwordHash: await hash(seedUser.password, ARGON2_OPTIONS),
          role: seedUser.role,
        },
      });

      users.push(user);
      console.log(`   👤 ${seedUser.role.padEnd(5)} ${seedUser.email}`);
    }

    const owner = users[0];

    if (!owner) {
      throw new Error('Nenhum usuário foi criado.');
    }

    // ----------------------------------------------------------------- pedidos
    const random = createRandom(SEED_RANDOM_SEED);
    const today = new Date();
    const createdOrders = [];

    for (let index = 0; index < ORDERS_COUNT; index += 1) {
      const customer = pick(SEED_CUSTOMERS, random);
      const address = pick(SEED_ADDRESSES, random);

      // Pedidos distribuídos entre ~6 meses no passado e ~3 meses no futuro.
      const daysOffset = randomInt(-180, 90, random);
      const expectedDeliveryDate = addDays(today, daysOffset);

      const itemCount = randomInt(1, 5, random);
      const items = [];

      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const product = pick(SEED_PRODUCTS, random);
        const quantity = randomInt(1, 4, random);
        const unitPrice = new Prisma.Decimal(product.unitPrice);

        items.push({
          description: product.description,
          quantity,
          unitPrice,
          total: unitPrice.mul(quantity).toDecimalPlaces(2),
        });
      }

      const total = items
        .reduce((sum, item) => sum.plus(item.total), new Prisma.Decimal(0))
        .toDecimalPlaces(2);

      const number = await nextOrderNumber(prisma, expectedDeliveryDate.getFullYear());

      const order = await prisma.order.create({
        data: {
          number,
          status: statusForDate(expectedDeliveryDate, today, random),
          expectedDeliveryDate,
          customerName: customer.name,
          customerDocument: customer.document,
          total,
          createdById: owner.id,
          address: { create: address },
          items: { create: items },
        },
      });

      createdOrders.push(order);
    }

    console.log(`   📦 ${createdOrders.length} pedidos criados`);
    console.log(`   🔢 Numeração: ${createdOrders[0]?.number} … ${createdOrders.at(-1)?.number}`);
    console.log('\n✅ Seed concluída.');
    console.log('\n   Credenciais de acesso:');
    for (const seedUser of SEED_USERS) {
      console.log(`   • ${seedUser.role.padEnd(5)} ${seedUser.email} / ${seedUser.password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌ Falha ao executar a seed:', error);
    process.exit(1);
  });
