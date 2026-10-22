import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthThrottled } from './auth-throttled.decorator.js';
import { buildThrottlerOptions } from './throttler.config.js';

@Controller('credenciais')
class CredenciaisController {
  @Get()
  @AuthThrottled()
  login(): string {
    return 'ok';
  }
}

@Controller('publico')
class PublicoController {
  @Get()
  list(): string {
    return 'ok';
  }
}

function createConfigService(values: Record<string, number>): ConfigService {
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

function createContext(controller: object, handlerName: string): ExecutionContext {
  const prototype = controller as unknown as Record<string, unknown>;
  const handler = prototype[handlerName];

  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('buildThrottlerOptions', () => {
  const config = createConfigService({
    'http.throttleTtl': 60_000,
    'http.throttleLimit': 100,
    'http.authThrottleTtl': 30_000,
    'http.authThrottleLimit': 5,
  });

  it('cria o limitador global com os valores da configuração', () => {
    const options = buildThrottlerOptions(config, new Reflector());
    const [defaultThrottler] = options.throttlers;

    expect(defaultThrottler?.name).toBe('default');
    expect(defaultThrottler?.limit).toBe(100);
    expect(defaultThrottler?.ttl).toBe(60_000);
  });

  it('cria o limitador rígido de credenciais com os valores da configuração', () => {
    const options = buildThrottlerOptions(config, new Reflector());
    const authThrottler = options.throttlers.find((throttler) => throttler.name === 'auth');

    expect(authThrottler?.limit).toBe(5);
    expect(authThrottler?.ttl).toBe(30_000);
  });

  it('aplica o limitador de credenciais apenas nas rotas marcadas', () => {
    const reflector = new Reflector();
    const options = buildThrottlerOptions(config, reflector);
    const authThrottler = options.throttlers.find((throttler) => throttler.name === 'auth');

    const rotaDeCredencial = createContext(CredenciaisController.prototype, 'login');
    const rotaPublica = createContext(PublicoController.prototype, 'list');

    expect(authThrottler?.skipIf?.(rotaDeCredencial)).toBe(false);
    expect(authThrottler?.skipIf?.(rotaPublica)).toBe(true);
  });
});
