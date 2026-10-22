import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './setup-e2e.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('responde 200 com o payload de liveness', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'naporta-api',
      });
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptimeSeconds');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/v1/rota-inexistente', () => {
    it('responde 404 no formato padronizado de erro', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nao-existe');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
      });
      expect(response.body).toHaveProperty('path', '/api/v1/nao-existe');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
