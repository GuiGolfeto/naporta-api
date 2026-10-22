import 'reflect-metadata';
import 'dotenv/config';

import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { configuration } from '../src/config/configuration.js';
import { validateEnv } from '../src/config/env.validation.js';
import { OrderNumberService } from '../src/modules/orders/order-number.service.js';
import { OrdersModule } from '../src/modules/orders/orders.module.js';
import { PrismaModule } from '../src/modules/prisma/prisma.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('OrderNumberService (integração)', () => {
  let service: OrderNumberService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: configuration,
          validate: validateEnv,
          envFilePath: ['.env'],
        }),
        PrismaModule,
        OrdersModule,
      ],
    }).compile();

    service = moduleRef.get(OrderNumberService);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.client.$executeRawUnsafe('TRUNCATE TABLE order_counters');
  });

  it('gera o primeiro número do ano no formato NP-AAAA-NNNNN', async () => {
    await expect(service.next(2026)).resolves.toBe('NP-2026-00001');
  });

  it('incrementa o sequencial a cada chamada', async () => {
    await expect(service.next(2026)).resolves.toBe('NP-2026-00001');
    await expect(service.next(2026)).resolves.toBe('NP-2026-00002');
    await expect(service.next(2026)).resolves.toBe('NP-2026-00003');
  });

  it('mantém contadores independentes por ano', async () => {
    await expect(service.next(2026)).resolves.toBe('NP-2026-00001');
    await expect(service.next(2027)).resolves.toBe('NP-2027-00001');
    await expect(service.next(2026)).resolves.toBe('NP-2026-00002');
  });

  it('nunca repete o número em chamadas simultâneas', async () => {
    const numbers = await Promise.all(Array.from({ length: 25 }, () => service.next(2026)));

    expect(new Set(numbers).size).toBe(25);
    expect(numbers).toContain('NP-2026-00001');
    expect(numbers).toContain('NP-2026-00025');
  });

  it('usa o ano corrente por padrão', async () => {
    const number = await service.next();

    expect(number).toMatch(new RegExp(`^NP-${new Date().getFullYear()}-\\d{5}$`));
  });
});
