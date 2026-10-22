import { SetMetadata } from '@nestjs/common';

import { type Role } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe a rota aos papéis informados.
 *
 * Usado junto com o `RolesGuard` (registrado como guard global).
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
