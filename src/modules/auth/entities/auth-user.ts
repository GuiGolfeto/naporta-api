import { type Role } from '../../../generated/prisma/client.js';

/**
 * Usuário exposto pela API.
 *
 * Nunca inclui `passwordHash` — a conversão é sempre por este tipo, o que
 * impede vazamento acidental do hash.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

/** Resultado de uma autenticação bem-sucedida. */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Validade do access token, em segundos. */
  expiresIn: number;
}

/** Contexto da requisição, usado para auditoria dos tokens. */
export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}
