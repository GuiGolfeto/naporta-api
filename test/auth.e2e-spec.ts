import 'reflect-metadata';
import 'dotenv/config';

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { createTestApp, resetThrottler } from './setup-e2e.js';

const PASSWORD = 'Senha1234';

describe('Auth (e2e)', () => {
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
      'TRUNCATE TABLE order_items, addresses, orders, refresh_tokens, users CASCADE',
    );

    // O rate limit de autenticação é por IP: sem reset, a suíte se autobloqueia.
    resetThrottler(app);
  });

  const register = (email = `usuario-${crypto.randomUUID()}@teste.com`) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Usuário Teste', email, password: PASSWORD });

  describe('POST /api/v1/auth/register', () => {
    it('cria o usuário e devolve a sessão inicial', async () => {
      const response = await register();

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        tokenType: 'Bearer',
        user: { name: 'Usuário Teste', role: 'USER', isActive: true },
      });
      expect(response.body.accessToken).toBeTypeOf('string');
      expect(response.body.refreshToken).toBeTypeOf('string');
    });

    it('nunca devolve o hash da senha', async () => {
      const response = await register();

      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejeita o envio de papel pelo cliente (impede escalonamento de privilégio)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Escalador',
          email: `admin-${crypto.randomUUID()}@teste.com`,
          password: PASSWORD,
          role: 'ADMIN',
        });

      // O campo `role` não existe no DTO: a requisição é rejeitada (422)
      // em vez de aceitar (e descartar) o valor.
      expect(response.status).toBe(422);
    });

    it('rejeita e-mail duplicado com 409', async () => {
      const email = `duplicado-${crypto.randomUUID()}@teste.com`;

      await register(email);
      const response = await register(email);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Já existe um usuário com este e-mail.');
    });

    it('rejeita senha fraca com 422', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Teste', email: `fraca-${crypto.randomUUID()}@teste.com`, password: 'abc' });

      expect(response.status).toBe(422);
    });

    it('rejeita campos desconhecidos com 422', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Teste',
          email: `extra-${crypto.randomUUID()}@teste.com`,
          password: PASSWORD,
          admin: true,
        });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('autentica com e-mail e senha corretos', async () => {
      const email = `login-${crypto.randomUUID()}@teste.com`;
      await register(email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      expect(response.status).toBe(201);
      expect(response.body.accessToken).toBeTypeOf('string');
      expect(response.body.user.email).toBe(email);
    });

    it('responde a mesma mensagem para e-mail inexistente e senha errada', async () => {
      const inexistente = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `nao-existe-${crypto.randomUUID()}@teste.com`, password: PASSWORD });

      const email = `senha-errada-${crypto.randomUUID()}@teste.com`;
      await register(email);
      const senhaErrada = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'SenhaErrada9' });

      expect(inexistente.status).toBe(401);
      expect(senhaErrada.status).toBe(401);
      expect(inexistente.body.message).toBe(senhaErrada.body.message);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('renova a sessão e rotaciona o refresh token', async () => {
      const email = `refresh-${crypto.randomUUID()}@teste.com`;
      const registerResponse = await register(email);
      const { refreshToken } = registerResponse.body as { refreshToken: string };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(201);
      expect(response.body.accessToken).toBeTypeOf('string');

      // A rotação entrega um refresh token diferente do original.
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('revoga o token anterior após a rotação', async () => {
      const email = `rotacao-${crypto.randomUUID()}@teste.com`;
      const registerResponse = await register(email);
      const { refreshToken } = registerResponse.body as { refreshToken: string };

      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken });

      // Reutilizar o token já rotacionado é reuso — e deve falhar.
      const reuse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(reuse.status).toBe(401);
      expect(reuse.body.message).toContain('já utilizado');
    });

    it('revoga todas as sessões do usuário quando um token é reutilizado', async () => {
      const email = `reuso-${crypto.randomUUID()}@teste.com`;
      const first = await register(email);
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      const firstToken = (first.body as { refreshToken: string }).refreshToken;
      const secondToken = (second.body as { refreshToken: string }).refreshToken;

      // Rotaciona o primeiro token e depois o reutiliza (indício de roubo).
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstToken });
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstToken });

      // O segundo token (ainda válido) também foi revogado.
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: secondToken });

      expect(response.status).toBe(401);
    });

    it('rejeita um refresh token desconhecido', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'token-que-nunca-existiu-com-tamanho-suficiente' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Refresh token inválido.');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revoga o refresh token informado', async () => {
      const email = `logout-${crypto.randomUUID()}@teste.com`;
      const registerResponse = await register(email);
      const { accessToken, refreshToken } = registerResponse.body as {
        accessToken: string;
        refreshToken: string;
      };

      const logout = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logout.status).toBe(204);

      const refresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refresh.status).toBe(401);
    });

    it('exige autenticação', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'qualquer-token-com-tamanho-suficiente' });

      expect(response.status).toBe(401);
    });
  });

  describe('conta desativada', () => {
    it('perde o acesso imediatamente, mesmo com token válido', async () => {
      const email = `inativo-${crypto.randomUUID()}@teste.com`;
      const registerResponse = await register(email);
      const { accessToken } = registerResponse.body as { accessToken: string };

      await prisma.client.user.updateMany({
        where: { email },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Usuário inativo ou inexistente.');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('devolve o usuário autenticado', async () => {
      const registerResponse = await register();
      const { accessToken } = registerResponse.body as { accessToken: string };

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: 'Usuário Teste', role: 'USER' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('exige token de acesso', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token de acesso ausente.');
    });

    it('rejeita token inválido', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token.invalido.aqui');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token de acesso inválido ou expirado.');
    });

    it('rejeita esquema de autorização diferente de Bearer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(response.status).toBe(401);
    });
  });
});
