import { type Role } from '../../../generated/prisma/client.js';
import type { User } from '../../../generated/prisma/client.js';

/** Usuário na resposta da API (nunca inclui `passwordHash`). */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

/**
 * Campos do usuário expostos na API.
 *
 * `passwordHash` (e os campos internos) ficam de fora por construção.
 */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'isActive' | 'createdAt'>;

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
