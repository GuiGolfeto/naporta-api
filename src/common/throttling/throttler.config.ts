import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';

/** Forma de objeto das opções do throttler (a que expõe `throttlers`). */
type ThrottlerOptionsObject = Exclude<ThrottlerModuleOptions, ThrottlerOptions[]>;

import { AUTH_THROTTLED_KEY } from './auth-throttled.decorator.js';

/**
 * Monta a configuração do rate limit.
 *
 * Dois limitadores:
 *  - `default`: limite global da API;
 *  - `auth`: limite rígido para as rotas de credencial (força bruta).
 *
 * O limitador `auth` só é aplicado nas rotas marcadas com `@AuthThrottled()`.
 * Os limites vêm do ambiente validado, então podem ser ajustados por
 * deploy sem alterar código.
 */
export function buildThrottlerOptions(
  configService: ConfigService,
  reflector: Reflector,
): ThrottlerOptionsObject {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: configService.getOrThrow<number>('http.throttleTtl'),
        limit: configService.getOrThrow<number>('http.throttleLimit'),
      },
      {
        name: 'auth',
        ttl: configService.getOrThrow<number>('http.authThrottleTtl'),
        limit: configService.getOrThrow<number>('http.authThrottleLimit'),
        skipIf: (context: ExecutionContext) => !isAuthThrottled(context, reflector),
      },
    ],
  };
}

/** A rota está marcada com `@AuthThrottled()`? */
function isAuthThrottled(context: ExecutionContext, reflector: Reflector): boolean {
  return (
    reflector.getAllAndOverride<boolean>(AUTH_THROTTLED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
