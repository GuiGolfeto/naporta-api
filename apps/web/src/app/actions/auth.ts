'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { AuthSession } from '@naporta/contracts';

import { apiRequest, extractMessage } from '@/lib/api-client';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/session';

/** Estado devolvido por uma Server Action de formulário. */
export interface AuthActionState {
  error?: string;
}

/** Opções de cookie da sessão. */
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

/**
 * Autentica o usuário e abre a sessão.
 *
 * Os tokens ficam em cookies `httpOnly`: o JavaScript do browser nunca tem
 * acesso a eles, o que impede que sejam exfiltrados por um XSS.
 */
export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  let session: AuthSession;

  try {
    session = await apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
  } catch (error) {
    const body = (error as { body?: never }).body;

    return {
      error:
        extractMessage(body ?? null) ??
        'Não foi possível autenticar. Verifique o e-mail e a senha.',
    };
  }

  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...cookieOptions,
    maxAge: session.expiresIn,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect('/');
}

/** Encerra a sessão: revoga o refresh token e limpa os cookies. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        json: { refreshToken },
        token: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value,
      });
    } catch {
      // Mesmo que a revogação falhe, a sessão local é encerrada.
    }
  }

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  redirect('/login');
}

/**
 * Renova o access token a partir do refresh token (que está no cookie
 * `httpOnly`).
 *
 * É chamada pelo cliente quando uma requisição volta com `401` — o token de
 * acesso tem 15 minutos de validade, então a renovação é esperada.
 */
export async function refreshSessionAction(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  let session: AuthSession;

  try {
    session = await apiRequest<AuthSession>('/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
    });
  } catch {
    // Refresh token inválido ou expirado: a sessão acabou.
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);

    return null;
  }

  cookieStore.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...cookieOptions,
    maxAge: session.expiresIn,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  return session.accessToken;
}
