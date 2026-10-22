import 'reflect-metadata';
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../src/modules/prisma/prisma.service.js';
import type { ExtendedPrismaClient } from '../src/modules/prisma/prisma.service.js';

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

if (!TEST_DATABASE_URL) {
  throw new Error('DATABASE_URL_TEST não configurada.');
}

describe('Extensão de soft delete (integração)', () => {
  let prisma: ExtendedPrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient({
      adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpeza física: o `deleteMany` do client estendido faz soft delete,
    // então o reset usa TRUNCATE para não acumular registros excluídos.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE order_items, addresses, orders, refresh_tokens, users CASCADE',
    );
  });

  function createUser() {
    return prisma.user.create({
      data: {
        name: 'Cliente Teste',
        email: `cliente-${crypto.randomUUID()}@teste.com`,
        passwordHash: 'hash-de-teste',
      },
    });
  }

  function createOrder(userId: string) {
    return prisma.order.create({
      data: {
        number: `NP-TESTE-${crypto.randomUUID().slice(0, 8)}`,
        expectedDeliveryDate: new Date('2026-12-25'),
        customerName: 'Cliente Teste',
        customerDocument: '12345678909',
        total: 100,
        createdById: userId,
      },
    });
  }

  it('cria o pedido com a data de exclusão nula', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    expect(order.deletedAt).toBeNull();
  });

  it('esconde o registro excluído das leituras', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    await prisma.order.delete({ where: { id: order.id } });

    const list = await prisma.order.findMany();
    const found = await prisma.order.findUnique({ where: { id: order.id } });
    const count = await prisma.order.count();

    expect(list).toHaveLength(0);
    expect(found).toBeNull();
    expect(count).toBe(0);
  });

  it('mantém a linha no banco (exclusão lógica de verdade)', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    await prisma.order.delete({ where: { id: order.id } });

    const rows = await prisma.$queryRaw<Array<{ id: string; deleted_at: Date | null }>>`
      SELECT id, deleted_at FROM orders WHERE id = ${order.id}::uuid
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).toBeInstanceOf(Date);
  });

  it('preserva o filtro where informado pelo chamador', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);
    const other = await createOrder(user.id);

    await prisma.order.delete({ where: { id: order.id } });

    const list = await prisma.order.findMany({ where: { id: other.id } });

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(other.id);
  });

  it('impede que um registro excluído seja alterado', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    await prisma.order.delete({ where: { id: order.id } });

    await expect(
      prisma.order.update({ where: { id: order.id }, data: { customerName: 'Novo Nome' } }),
    ).rejects.toThrow();
  });

  it('faz exclusão lógica em massa', async () => {
    const user = await createUser();
    await createOrder(user.id);
    await createOrder(user.id);

    const result = await prisma.order.deleteMany({});

    expect(result.count).toBe(2);
    expect(await prisma.order.count()).toBe(0);
  });

  it('aplica a mesma regra ao modelo User', async () => {
    const user = await createUser();

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.user.count()).toBe(0);

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE id = ${user.id}::uuid
    `;
    expect(rows).toHaveLength(1);
  });
});
