'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { refreshSessionAction } from '@/app/actions/auth';
import { browserApiRequest } from '@/lib/api-browser';

/** Valor exposto pelo contexto de sessão. */
interface SessionContextValue {
  /** Access token em memória (nunca persistido no browser). */
  accessToken: string | null;
  /**
   * Faz uma chamada à API já com o Bearer.
   *
   * Se a API responder `401` (access token expirado), a sessão é renovada
   * uma única vez e a requisição é refeita ✓.
   */
  request: <T>(path: string, options?: { json?: unknown; method?: string }) => Promise<T>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Contexto de sessão do portal.
 *
 * O access token vive **apenas em memória** — ele é entregue pelo servidor
 * (que o leu do cookie `httpOnly`) e nunca vai para o `localStorage`. Se a
 * aba for recarregada, o servidor o entrega de novo.
 */
export function SessionProvider({
  accessToken,
  children,
}: {
  accessToken: string | null;
  children: ReactNode;
}) {
  const [token, setToken] = useState<string | null>(accessToken);

  const request = useCallback(
    async <T,>(path: string, options?: { json?: unknown; method?: string }): Promise<T> => {
      try {
        return await browserApiRequest<T>(path, { ...options, token: token ?? undefined });
      } catch (error) {
        const status = (error as { status?: number }).status;

        if (status !== 401) {
          throw error;
        }

        // Access token expirado: renova a sessão (Server Action, que usa o
        // refresh token do cookie httpOnly) e tenta de novo.
        const renewed = await refreshSessionAction();

        if (!renewed) {
          throw error;
        }

        setToken(renewed);

        return browserApiRequest<T>(path, { ...options, token: renewed });
      }
    },
    [token],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ accessToken: token, request }),
    [token, request],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Acesso ao contexto de sessão (apenas em componentes cliente). */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession precisa estar dentro de um <SessionProvider>.');
  }

  return context;
}
