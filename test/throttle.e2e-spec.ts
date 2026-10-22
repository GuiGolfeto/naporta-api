import 'reflect-metadata';
import 'dotenv/config';

import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';

/** Rota de teste, protegida pelo limitador. */
@Controller('teste')
class TestController {
  @Get()
  find(): string {
    return 'ok';
  }
}

describe('Rate limit (integração)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  async function createApp(limit: number) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({ pinoHttp: { enabled: false } }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit }],
        }),
      ],
      controllers: [TestController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        // O mesmo filtro global da aplicação: o 429 segue o contrato de erro.
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();

    const instance = moduleRef.createNestApplication();
    await instance.init();

    return instance;
  }

  beforeAll(async () => {
    app = await createApp(2);
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite requisições dentro do limite e bloqueia as excedentes com 429', async () => {
    const primeira = await request(app.getHttpServer()).get('/teste');
    const segunda = await request(app.getHttpServer()).get('/teste');
    const terceira = await request(app.getHttpServer()).get('/teste');

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(terceira.status).toBe(429);
  });

  it('devolve o header Retry-After no bloqueio', async () => {
    const response = await request(app.getHttpServer()).get('/teste');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('devolve o corpo de erro no mesmo formato da API', async () => {
    const response = await request(app.getHttpServer()).get('/teste');

    expect(response.body).toMatchObject({
      statusCode: 429,
      error: expect.any(String),
      message: expect.anything(),
      path: '/teste',
    });
  });
});
