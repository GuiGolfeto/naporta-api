import { cookies } from 'next/headers';

import type { AuthSession, AuthUser } from '@naporta/contracts';

import { apiRequest } from './api-client';

/** Nomes dos cookies de sessão. */
export const ACCESS_TOKEN_COOKIE = 'naporta_access_token';
export const REFRESH_TOKEN_COOKIE = 'naporta_refresh_token';

/** Dados guardados na sessão do portal. */
export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Lê a sessão a partir dos cookies `httpOnly`.
 *
 * O token **nunca** é exposto ao JavaScript do browser: quem precisa dele no
 * cliente recebe apenas o access token, em memória (ver `SessionProvider`).
 */
export async function readSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken || !refreshToken) {
    return null;
  }

  try {
    const user = await apiRequest<AuthUser>('/auth/me', { token: accessToken });

    return { user, accessToken, refreshToken };
  } catch {
    return null;
  }
}

/** Serializa a sessão devolvida pela API. */
export function toSession(session: AuthSession): Session {
  return {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}
