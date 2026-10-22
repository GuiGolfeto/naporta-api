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

/** Data `YYYY-MM-DD` a N dias de hoje (deixa a suíte independente do tempo). */
function daquiADias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

const PEDIDO_VALIDO = {
  expectedDeliveryDate: daquiADias(60),
  customerName: 'Maria Silva',
  customerDocument: CPF_VALIDO,
  address: {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 42',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001000',
  },
  items: [
    { description: 'Caixa de papelão', quantity: 2, unitPrice: 49.9 },
    { description: 'Adesivo', quantity: 1, unitPrice: '5.50' },
  ],
};

interface Sessao {
  token: string;
  userId: string;
  email: string;
}

describe('Orders (e2e)', () => {
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
    await prisma.client.$executeRawUnsafe(
      'TRUNCATE TABLE order_items, addresses, orders, refresh_tokens, users, order_counters CASCADE',
    );
    resetThrottler(app);
  });

  /** Cria um usuário comum e devolve a sessão. */
  async function criarUsuario(): Promise<Sessao> {
    const email = `cliente-${crypto.randomUUID()}@teste.com`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Cliente Teste', email, password: PASSWORD });

    expect(response.status).toBe(201);

    return {
      token: response.body.accessToken as string,
      userId: response.body.user.id as string,
      email,
    };
  }

  /**
   * Cria um administrador.
   *
   * O registro público não permite escolher o papel (por segurança), então o
   * admin é criado direto no banco — com hash de senha de verdade, para
   * conseguir autenticar.
   */
  async function criarAdmin(): Promise<Sessao> {
    const email = `admin-${crypto.randomUUID()}@teste.com`;
    const passwordService = app.get(PasswordService);

    const user = await prisma.client.user.create({
      data: {
        name: 'Administrador',
        email,
        passwordHash: await passwordService.hashPassword(PASSWORD),
        role: 'ADMIN',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });

    expect(response.status).toBe(201);

    return {
      token: response.body.accessToken as string,
      userId: user.id,
      email,
    };
  }

  /** Cria um pedido autenticado. */
  function criarPedido(sessao: Sessao, payload: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sessao.token}`)
      .send({ ...PEDIDO_VALIDO, ...payload });
  }

  describe('POST /api/v1/orders', () => {
    it('cria o pedido com número sequencial, status e total calculados no servidor', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        number: expect.stringMatching(/^NP-\d{4}-\d{5}$/),
        status: 'PENDING',
        expectedDeliveryDate: daquiADias(60),
        customer: { name: 'Maria Silva', document: CPF_VALIDO },
        total: 105.3,
      });
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0]).toMatchObject({
        description: 'Caixa de papelão',
        quantity: 2,
        unitPrice: 49.9,
        total: 99.8,
      });
      expect(response.body.address).toMatchObject({
        street: 'Rua das Flores',
        zipCode: '01001000',
        state: 'SP',
      });
      expect(response.body.createdBy.id).toBe(sessao.userId);
    });

    it('gera números sequenciais distintos', async () => {
      const sessao = await criarUsuario();

      const primeiro = await criarPedido(sessao);
      const segundo = await criarPedido(sessao);

      expect(primeiro.body.number).not.toBe(segundo.body.number);
      expect(segundo.body.number > primeiro.body.number).toBe(true);
    });

    it('ignora um total enviado pelo cliente (o total é do servidor)', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, { total: 1 });

      // O campo `total` não existe no DTO: a requisição é rejeitada.
      expect(response.status).toBe(422);
    });

    it('exige autenticação', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send(PEDIDO_VALIDO);

      expect(response.status).toBe(401);
    });

    it('rejeita CPF inválido', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, { customerDocument: '11144477734' });

      expect(response.status).toBe(422);
      expect(JSON.stringify(response.body.message)).toContain('CPF ou CNPJ válido');
    });

    it('rejeita pedido sem itens', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, { items: [] });

      expect(response.status).toBe(422);
    });

    it('rejeita preço negativo', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, {
        items: [{ description: 'Item', quantity: 1, unitPrice: '-10.00' }],
      });

      expect(response.status).toBe(422);
    });

    it('rejeita preço com mais de 2 casas decimais', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, {
        items: [{ description: 'Item', quantity: 1, unitPrice: 10.555 }],
      });

      expect(response.status).toBe(422);
    });

    it('rejeita data prevista no passado', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, { expectedDeliveryDate: '2020-01-01' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('não pode ser no passado');
    });

    it('rejeita data prevista inválida', async () => {
      const sessao = await criarUsuario();

      const response = await criarPedido(sessao, { expectedDeliveryDate: '25/12/2026' });

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/v1/orders', () => {
    it('lista apenas os pedidos do usuário autenticado', async () => {
      const sessaoA = await criarUsuario();
      const sessaoB = await criarUsuario();

      await criarPedido(sessaoA);
      await criarPedido(sessaoB);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${sessaoA.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].createdBy.id).toBe(sessaoA.userId);
      expect(response.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('pagina os resultados', async () => {
      const sessao = await criarUsuario();

      await criarPedido(sessao);
      await criarPedido(sessao);
      await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=2')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    });

    it('filtra por número do pedido', async () => {
      const sessao = await criarUsuario();

      const criado = await criarPedido(sessao);
      await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders?number=${criado.body.number}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].number).toBe(criado.body.number);
    });

    it('filtra por status', async () => {
      const sessao = await criarUsuario();

      const criado = await criarPedido(sessao);
      await criarPedido(sessao);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?status=CONFIRMED')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('CONFIRMED');
    });

    it('filtra por período (data prevista de entrega)', async () => {
      const sessao = await criarUsuario();

      await criarPedido(sessao, { expectedDeliveryDate: daquiADias(10) });
      await criarPedido(sessao, { expectedDeliveryDate: daquiADias(40) });
      await criarPedido(sessao, { expectedDeliveryDate: daquiADias(90) });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders?startDate=${daquiADias(0)}&endDate=${daquiADias(60)}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('mostra todos os pedidos para o administrador', async () => {
      const sessaoA = await criarUsuario();
      const sessaoB = await criarUsuario();
      const admin = await criarAdmin();

      await criarPedido(sessaoA);
      await criarPedido(sessaoB);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('rejeita período com data mal formatada', async () => {
      const sessao = await criarUsuario();

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?startDate=01/01/2026')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(422);
    });

    it('rejeita campo de ordenação desconhecido', async () => {
      const sessao = await criarUsuario();

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders?sortBy=dropTable')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('detalha o pedido', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(criado.body.id);
    });

    it('devolve 404 para pedido inexistente', async () => {
      const sessao = await criarUsuario();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(404);
    });

    it('devolve 404 (e não 403) para pedido de outro usuário', async () => {
      const sessaoA = await criarUsuario();
      const sessaoB = await criarUsuario();

      const criado = await criarPedido(sessaoA);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessaoB.token}`);

      expect(response.status).toBe(404);
    });

    it('rejeita id que não é UUID', async () => {
      const sessao = await criarUsuario();

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/nao-e-um-uuid')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/orders/:id', () => {
    it('atualiza os campos enviados', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ customerName: 'João Souza' });

      expect(response.status).toBe(200);
      expect(response.body.customer.name).toBe('João Souza');
      // O que não foi enviado permanece intacto.
      expect(response.body.customer.document).toBe(CPF_VALIDO);
    });

    it('recalcula o total quando os itens mudam', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ items: [{ description: 'Item novo', quantity: 3, unitPrice: '10.00' }] });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(30);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].total).toBe(30);
    });

    it('permite as transições de status válidas', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/orders/${criado.body.id}`)
          .set('Authorization', `Bearer ${sessao.token}`)
          .send({ status });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(status);
      }
    });

    it('rejeita transição de status inválida com 409', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ status: 'DELIVERED' });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Não é possível alterar o status');
    });

    it('não deixa voltar de um status final', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .send({ status: 'PENDING' });

      expect(response.status).toBe(409);
    });

    it('impede que outro usuário altere o pedido', async () => {
      const sessaoA = await criarUsuario();
      const sessaoB = await criarUsuario();
      const criado = await criarPedido(sessaoA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessaoB.token}`)
        .send({ customerName: 'Intruso' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/orders/:id', () => {
    it('exclui o pedido (exclusão lógica) e devolve 204', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.status).toBe(204);

      const consulta = await request(app.getHttpServer())
        .get(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(consulta.status).toBe(404);
    });

    it('mantém o registro no banco (soft delete de verdade)', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      await request(app.getHttpServer())
        .delete(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .expect(204);

      const rows = await prisma.client.$queryRaw<Array<{ id: string; deleted_at: Date | null }>>`
        SELECT id, deleted_at FROM orders WHERE id = ${criado.body.id}::uuid
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0]?.deleted_at).toBeInstanceOf(Date);
    });

    it('remove o pedido das listagens', async () => {
      const sessao = await criarUsuario();
      const criado = await criarPedido(sessao);

      await request(app.getHttpServer())
        .delete(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessao.token}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${sessao.token}`);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('impede que outro usuário exclua o pedido', async () => {
      const sessaoA = await criarUsuario();
      const sessaoB = await criarUsuario();
      const criado = await criarPedido(sessaoA);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/orders/${criado.body.id}`)
        .set('Authorization', `Bearer ${sessaoB.token}`);

      expect(response.status).toBe(404);
    });
  });
});
