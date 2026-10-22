import type { ApiError } from '@naporta/contracts';

/**
 * URL base da API, usada **no servidor** (Server Components e Server Actions).
 *
 * Em desenvolvimento aponta para a API local; no Docker, para o serviço
 * `api` da rede do Compose.
 */
export const API_URL = (process.env.API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');

/**
 * URL base da API, usada **no browser**.
 *
 * Precisa ser pública (o Next a embute no bundle) e conhecida pelo navegador —
 * por isso é uma variável `NEXT_PUBLIC_*`.
 */
export const PUBLIC_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
).replace(/\/$/, '');

/** Erro de API com o status HTTP e o corpo original. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Opções de uma requisição à API. */
export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Token de acesso (Bearer). */
  token?: string;
  /** Corpo da requisição (serializado como JSON). */
  json?: unknown;
}

/**
 * Executa uma requisição à API e devolve o corpo tipado.
 *
 * Lança `ApiRequestError` quando a API responde com erro — o chamador decide
 * o que fazer (mostrar a mensagem no formulário, redirecionar, etc.).
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, json, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    cache: 'no-store',
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = body as ApiError | null;

    throw new ApiRequestError(
      response.status,
      error,
      extractMessage(error) ?? `Erro ${response.status} ao chamar a API.`,
    );
  }

  return body as T;
}

/** Extrai a mensagem de erro do corpo da API. */
export function extractMessage(error: ApiError | null): string | null {
  if (!error) {
    return null;
  }

  if (Array.isArray(error.message)) {
    return error.message.join('; ');
  }

  return error.message ?? null;
}
