import type {
  Paginated,
  PaginationMeta as PaginationMetaContract,
  User as UserContract,
} from '@naporta/contracts';

import { type Role } from '../../../generated/prisma/client.js';
import type { User } from '../../../generated/prisma/client.js';

/**
 * Campos do usuário expostos na API.
 *
 * `passwordHash` (e os campos internos) ficam de fora por construção.
 */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'isActive' | 'createdAt'>;

/**
 * Usuário na resposta da API.
 *
 * Classe (e não interface) para que o plugin do `@nestjs/swagger` gere o
 * schema OpenAPI.
 */
export class UserResponse implements UserContract {
  id!: string;
  name!: string;
  email!: string;
  role!: Role;
  isActive!: boolean;
  createdAt!: string;
}

/** Metainformação de paginação. */
export class PaginationMeta implements PaginationMetaContract {
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

/** Página de usuários. */
export class PaginatedUsers implements Paginated<UserResponse> {
  data!: UserResponse[];
  meta!: PaginationMeta;
}

/** Converte o modelo do Prisma na resposta da API. */
export function toUserResponse(user: PublicUser): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
