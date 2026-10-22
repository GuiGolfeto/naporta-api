import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLED_KEY = 'authThrottled';

/**
 * Marca a rota para o limitador rígido de credenciais.
 *
 * Rotas de login/cadastro recebem um limite bem menor que o global
 * (5 tentativas por minuto, por padrão) — é a defesa contra força bruta.
 */
export const AuthThrottled = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_THROTTLED_KEY, true);
