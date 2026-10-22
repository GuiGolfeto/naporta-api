import 'reflect-metadata';
import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PasswordService } from '../src/modules/auth/password/password.service.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { createTestApp, resetThrottler } from './setup-e2e.js';

const PASSWORD = 'Senha1234';
const CPF_VALIDO = '11144477735';

const PEDIDO = {
  expectedDeliveryDate: '2099-12-25',
  customerName: 'Maria Silva',
  customerDocument: CPF_VALIDO,
  address: {
    street: 'Rua das Flores',
    number: '123',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001000',
  },
  items: [{ description: 'Caixa', quantity: 1, unitPrice: '10.00' }],
};

describe('Qualidade (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.client.$executeRawUnsafe(
      'TRUNCATE TABLE order_items, addresses, orders, refresh_tokens, users, order_counters CASCADE',
    );
    resetThrottler(app);
  });

  /** Cria um usuário e devolve o token de acesso. */
  async function autenticar(email = `user-${crypto.randomUUID()}@teste.com`): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Usuário Teste', email, password: PASSWORD });

    return response.body.accessToken as string;
  }

  describe('concorrência', () => {
    it('nunca gera o mesmo número de pedido em criações simultâneas', async () => {
      token = await autenticar();

      const respostas = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app.getHttpServer())
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`)
            .send(PEDIDO),
        ),
      );

      for (const resposta of respostas) {
        expect(resposta.status).toBe(201);
      }

      const numeros = respostas.map((resposta) => resposta.body.number as string);

      expect(new Set(numeros).size).toBe(10);
    });

    it('mantém o contador consistente com os pedidos gravados', async () => {
      token = await autenticar();

      await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${token}`)
            .send(PEDIDO),
        ),
      );

      const pedidos = await prisma.client.order.count();

      expect(pedidos).toBe(5);
    });
  });

  describe('precisão monetária', () => {
    it('calcula o total sem erro de ponto flutante', async () => {
      token = await autenticar();

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...PEDIDO,
          items: [
            { description: 'Item A', quantity: 3, unitPrice: '0.10' },
            { description: 'Item B', quantity: 1, unitPrice: '0.20' },
          ],
        });

      expect(response.status).toBe(201);
      // 3 × 0.10 + 0.20 = 0.50 (e não 0.5000000000000001)
      expect(response.body.total).toBe(0.5);
      expect(response.body.items[0].total).toBe(0.3);
    });

    it('soma corretamente muitos itens', async () => {
      token = await autenticar();

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...PEDIDO,
          items: [
            { description: 'Item Alpha', quantity: 2, unitPrice: '19.99' },
            { description: 'Item Beta', quantity: 3, unitPrice: '5.50' },
            { description: 'Item Gamma', quantity: 1, unitPrice: '0.01' },
          ],
        });

      expect(response.body.total).toBe(56.49);
    });
  });

  describe('contrato de erro', () => {
    it('mantém o mesmo formato em todos os tipos de erro', async () => {
      token = await autenticar();

      const casos = [
        {
          descricao: 'sem token',
          request: () => request(app.getHttpServer()).get('/api/v1/orders'),
        },
        {
          descricao: 'rota inexistente',
          request: () => request(app.getHttpServer()).get('/api/v1/nao-existe'),
        },
        {
          descricao: 'validação',
          request: () =>
            request(app.getHttpServer())
              .post('/api/v1/orders')
              .set('Authorization', `Bearer ${token}`)
              .send({}),
        },
        {
          descricao: 'recurso inexistente',
          request: () =>
            request(app.getHttpServer())
              .get(`/api/v1/orders/${crypto.randomUUID()}`)
              .set('Authorization', `Bearer ${token}`),
        },
      ];

      for (const caso of casos) {
        const response = await caso.request();

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toMatchObject({
          statusCode: expect.any(Number),
          error: expect.any(String),
          message: expect.anything(),
          path: expect.any(String),
          timestamp: expect.any(String),
        });
        expect(response.body.statusCode).toBe(response.status);
      }
    });
  });

  describe('paginação e ordenação', () => {
    it('devolve página vazia além do último elemento', async () => {
      token = await autenticar();

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?page=99&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta).toMatchObject({ total: 0, page: 99, totalPages: 0 });
    });

    it('ordena por total, de forma decrescente', async () => {
      token = await autenticar();

      for (const preco of ['10.00', '90.00', '50.00']) {
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...PEDIDO, items: [{ description: 'Item', quantity: 1, unitPrice: preco }] });
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?sortBy=total&order=desc')
        .set('Authorization', `Bearer ${token}`);

      const totals = (response.body.data as Array<{ total: number }>).map((pedido) => pedido.total);

      expect(totals).toEqual([90, 50, 10]);
    });

    it('rejeita limite acima do máximo', async () => {
      token = await autenticar();

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?limit=1000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(422);
    });
  });

  describe('controle de acesso (RolesGuard)', () => {
    it('bloqueia usuário comum na rota administrativa com 403', async () => {
      token = await autenticar();

      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('permissão');
    });

    it('libera o administrador', async () => {
      const passwordService = app.get(PasswordService);
      const email = `admin-${crypto.randomUUID()}@teste.com`;

      await prisma.client.user.create({
        data: {
          name: 'Administrador',
          email,
          passwordHash: await passwordService.hashPassword(PASSWORD),
          role: 'ADMIN',
        },
      });

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${login.body.accessToken as string}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });
  });
});
