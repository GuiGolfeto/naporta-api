import Link from 'next/link';
import { redirect } from 'next/navigation';

import { OrdersPanel } from '@/components/orders/orders-panel';
import type { OrderFilters } from '@/components/orders/orders-panel';
import { apiRequest } from '@/lib/api-client';
import { readSession } from '@/lib/session';
import type { Order, OrderStatus, Paginated } from '@naporta/contracts';

export const metadata = {
  title: 'Pedidos — naPorta',
};

/** Parâmetros de busca da página (o Next entrega como Promise). */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lê um parâmetro de busca como string. */
function readParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];

  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Dashboard: listagem de pedidos com filtros e paginação. */
export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;

  const filters: OrderFilters = {
    ...(readParam(params, 'number') ? { number: readParam(params, 'number') } : {}),
    ...(readParam(params, 'status') ? { status: readParam(params, 'status') as OrderStatus } : {}),
    ...(readParam(params, 'startDate') ? { startDate: readParam(params, 'startDate') } : {}),
    ...(readParam(params, 'endDate') ? { endDate: readParam(params, 'endDate') } : {}),
    ...(readParam(params, 'page') ? { page: Number(readParam(params, 'page')) } : {}),
    ...(readParam(params, 'limit') ? { limit: Number(readParam(params, 'limit')) } : {}),
  };

  const query = new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)]),
  ).toString();

  const result = await apiRequest<Paginated<Order>>(`/orders${query ? `?${query}` : ''}`, {
    token: session.accessToken,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pedidos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe as entregas, filtre por período e atualize o status de cada pedido.
          </p>
        </div>

        <Link
          href="/orders/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          Novo pedido
        </Link>
      </div>

      {/* A `key` remonta o painel quando o servidor devolve outra lista —
          evita sincronizar estado por efeito (e o re-render em cascata). */}
      <OrdersPanel key={JSON.stringify(filters)} initial={result} initialFilters={filters} />
    </div>
  );
}
