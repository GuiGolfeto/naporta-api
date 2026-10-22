import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../../modules/auth/entities/auth-user.entity.js';

/** Requisição com o usuário autenticado anexado pelo `JwtAuthGuard`. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Injeta o usuário autenticado na rota.
 *
 * ```ts
 * @Get('me')
 * me(@CurrentUser() user: AuthUser) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      return undefined;
    }

    return property ? request.user[property] : request.user;
  },
);
