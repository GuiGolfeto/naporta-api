import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca a rota como pública (dispensa autenticação).
 *
 * A política é "secure by default": todas as rotas exigem Bearer token e
 * apenas as marcadas explicitamente com `@Public()` ficam abertas.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
