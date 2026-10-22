import 'reflect-metadata';
import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { createTestApp, resetThrottler } from './setup-e2e.js';

const TRUNCATE_SQL =
  'TRUNCATE TABLE order_items, addresses, orders, refresh_tokens, users, order_counters CASCADE';

describe('Seed (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.client.$executeRawUnsafe(TRUNCATE_SQL);
    resetThrottler(app);
  });

  /** Executa o script de seed contra o banco de testes. */
  function executarSeed(): string {
    return execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
      env: { ...process.env },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  it('a API sobe com o banco vazio — ela não popula nada sozinha', async () => {
    expect(await prisma.client.user.count()).toBe(0);
    expect(await prisma.client.order.count()).toBe(0);
  });

  it('popula usuários e pedidos fictícios', async () => {
    executarSeed();

    const users = await prisma.client.user.count();
    const orders = await prisma.client.order.count();
    const items = await prisma.client.orderItem.count();
    const addresses = await prisma.client.address.count();

    expect(users).toBe(3);
    expect(orders).toBe(60);
    expect(items).toBeGreaterThan(60);
    expect(addresses).toBe(60);
  });

  it('cria um administrador e usuários comuns com senhas utilizáveis', async () => {
    executarSeed();

    const admin = await prisma.client.user.findUnique({ where: { email: 'admin@naporta.local' } });

    expect(admin?.role).toBe('ADMIN');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@naporta.local', password: 'Admin@1234' });

    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeTypeOf('string');
  });

  it('gera números sequenciais no padrão NP-AAAA-NNNNN', async () => {
    executarSeed();

    const numbers = await prisma.client.order.findMany({ select: { number: true } });

    for (const { number } of numbers) {
      expect(number).toMatch(/^NP-\d{4}-\d{5}$/);
    }

    expect(new Set(numbers.map(({ number }) => number)).size).toBe(numbers.length);
  });

  it('não duplica dados quando executada de novo (idempotente)', async () => {
    executarSeed();
    const ordersAfterFirstRun = await prisma.client.order.count();

    const output = executarSeed();

    expect(await prisma.client.order.count()).toBe(ordersAfterFirstRun);
    expect(output).toContain('já populado');
  });

  it('gera pedidos com status coerente com a data prevista', async () => {
    executarSeed();

    const orders = await prisma.client.order.findMany({
      select: { status: true, expectedDeliveryDate: true },
    });

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    for (const order of orders) {
      if (order.expectedDeliveryDate.getTime() < hoje.getTime()) {
        // Pedido com data passada já foi entregue ou cancelado.
        expect(['DELIVERED', 'CANCELLED']).toContain(order.status);
      }
    }
  });
});
