import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '../../../common/decorators/current-user.decorator.js';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../../../generated/prisma/client.js';

/**
 * Guard global de autorização por papel.
 *
 * Só atua em rotas anotadas com `@Roles(...)`; as demais ficam livres
 * (a autenticação já foi garantida pelo `JwtAuthGuard`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    return true;
  }
}
