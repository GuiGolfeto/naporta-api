import 'reflect-metadata';
import 'dotenv/config';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './setup-e2e.js';

interface OpenApiDocument {
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, { scheme?: string; type?: string }>;
  };
}

describe('Documentação OpenAPI (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serve a interface do Swagger', async () => {
    const response = await request(app.getHttpServer()).get('/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });

  it('publica o documento com os endpoints da API', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');

    expect(response.status).toBe(200);

    const document = response.body as OpenApiDocument;

    expect(document.info.title).toBe('naPorta API');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/register',
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/me',
        '/api/v1/orders',
        '/api/v1/orders/{id}',
        '/api/v1/users',
        '/api/v1/health',
        '/api/v1/health/ready',
      ]),
    );
  });

  it('declara o esquema de segurança Bearer', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    const document = response.body as OpenApiDocument;

    expect(document.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('documenta os schemas das respostas', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    const document = response.body as OpenApiDocument;

    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining(['OrderResponse', 'PaginatedOrders', 'AuthSession', 'AuthUser']),
    );
  });

  it('documenta os DTOs de entrada', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    const document = response.body as OpenApiDocument;

    // Os schemas dos DTOs são gerados pelo plugin do `@nestjs/swagger`, que
    // roda no compilador do Nest CLI (`nest build` / `nest start`). No
    // contexto do Vitest (compilação via SWC) o plugin não é aplicado — por
    // isso o teste verifica a *presença* dos schemas, e não as suas
    // propriedades (que só o build produz).
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining([
        'RegisterDto',
        'LoginDto',
        'RefreshTokenDto',
        'CreateOrderDto',
        'UpdateOrderDto',
      ]),
    );
  });
});
