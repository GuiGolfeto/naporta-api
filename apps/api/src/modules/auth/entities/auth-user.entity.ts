import type {
  AuthSession as AuthSessionContract,
  AuthUser as AuthUserContract,
} from '@naporta/contracts';

import { type Role } from '../../../generated/prisma/client.js';

/**
 * Usuário exposto pela API.
 *
 * Nunca inclui `passwordHash` — a conversão é sempre por este tipo, o que
 * impede vazamento acidental do hash.
 *
 * Classe (e não interface) para que o plugin do `@nestjs/swagger` gere o
 * schema OpenAPI.
 */
export class AuthUser implements AuthUserContract {
  id!: string;
  name!: string;
  email!: string;
  role!: Role;
  isActive!: boolean;
  createdAt!: string;
}

/** Resultado de uma autenticação bem-sucedida. */
export class AuthSession implements AuthSessionContract {
  user!: AuthUser;
  accessToken!: string;
  refreshToken!: string;
  tokenType!: 'Bearer';
  /** Validade do access token, em segundos. */
  expiresIn!: number;
}

/** Contexto da requisição, usado para auditoria dos tokens. */
export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}
