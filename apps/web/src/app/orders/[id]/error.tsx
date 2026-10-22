'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { ApiRequestError } from '@/lib/api-client';

/**
 * Fronteira de erro da página de detalhe.
 *
 * Sem ela, qualquer falha da API (id malformado, banco instável, sessão
 * expirada) viraria um 500 sem contexto. Aqui a mensagem é explicada e
 * sempre há um caminho de volta.
 */
export default function OrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const detalhe =
    error instanceof ApiRequestError
      ? `A API respondeu ${error.status}: ${error.message}`
      : 'Não foi possível carregar o pedido.';

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Não foi possível abrir o pedido</h1>
      <p className="mt-2 text-sm text-slate-600">{detalhe}</p>
      <p className="mt-1 text-xs text-slate-400">Confira o endereço ou volte para a listagem.</p>

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Voltar para os pedidos
        </Link>
      </div>
    </div>
  );
}
