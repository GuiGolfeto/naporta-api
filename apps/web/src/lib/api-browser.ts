import type { ApiError } from '@naporta/contracts';

import { PUBLIC_API_URL } from './api-client';

/**
 * Client da API para o **browser**.
 *
 * Usado pelos componentes cliente (filtros, formularios e ações que precisam
 * de feedback imediato). O token vem do contexto de sessão — em memória, nunca
 * em `localStorage`.
 */
export class BrowserApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
    message: string,
  ) {
    super(message);
    this.name = 'BrowserApiError';
  }
}

/** Executa uma requisição à API a partir do browser. */
export async function browserApiRequest<T>(
  path: string,
  options: { token?: string; json?: unknown; method?: string } = {},
): Promise<T> {
  const { token, json, method = 'GET' } = options;

  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = body as ApiError | null;

    throw new BrowserApiError(
      response.status,
      error,
      Array.isArray(error?.message)
        ? error.message.join('; ')
        : (error?.message ?? `Erro ${response.status} ao chamar a API.`),
    );
  }

  return body as T;
}
