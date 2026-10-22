'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { ALL_STATUSES } from '@/lib/format';
import { useSession } from '@/components/session-provider';
import type { Order, OrderStatus, Paginated } from '@naporta/contracts';

import { OrderTable } from './order-table';

/** Filtros aplicados à listagem. */
export interface OrderFilters {
  number?: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/** Monta a query string da API a partir dos filtros. */
export function buildQuery(filters: OrderFilters): string {
  const params = new URLSearchParams();

  if (filters.number) params.set('number', filters.number);
  if (filters.status) params.set('status', filters.status);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = params.toString();

  return query ? `?${query}` : '';
}

/**
 * Painel de pedidos: filtros, tabela e paginação.
 *
 * A primeira carga vem do servidor (Server Component); as trocas de filtro e
 * de página são feitas **no browser**, chamando a API diretamente — a resposta
 * é instantânea e a URL é atualizada para a listagem ficar compartilhável.
 */
export function OrdersPanel({
  initial,
  initialFilters,
}: {
  initial: Paginated<Order>;
  initialFilters: OrderFilters;
}) {
  const router = useRouter();
  const { request } = useSession();
  const [pending, startTransition] = useTransition();

  const [result, setResult] = useState(initial);
  const [filters, setFilters] = useState(initialFilters);

  const load = useCallback(
    async (next: OrderFilters) => {
      try {
        const data = await request<Paginated<Order>>(`/orders${buildQuery(next)}`);

        setResult(data);
        setFilters(next);
        startTransition(() => {
          router.replace(
            next.page && next.page > 1 ? `/?${new URLSearchParams(toParams(next))}` : '/',
            {
              scroll: false,
            },
          );
        });
      } catch {
        // Em caso de falha (token expirado, API fora), a lista atual permanece.
      }
    },
    [request, router],
  );

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);

          void load({
            number: String(data.get('number') ?? '').trim() || undefined,
            status: (String(data.get('status') ?? '') as OrderStatus) || undefined,
            startDate: String(data.get('startDate') ?? '') || undefined,
            endDate: String(data.get('endDate') ?? '') || undefined,
            page: 1,
            limit: Number(data.get('limit') ?? '20'),
          });
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Número do pedido</span>
          <input
            name="number"
            defaultValue={filters.number ?? ''}
            placeholder="NP-2026-00001"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Entrega de</span>
          <input
            name="startDate"
            type="date"
            defaultValue={filters.startDate ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Entrega até</span>
          <input
            name="endDate"
            type="date"
            defaultValue={filters.endDate ?? ''}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
          />
        </label>

        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="text-xs font-medium text-slate-600">Por página</span>
            <select
              name="limit"
              defaultValue={String(filters.limit ?? 20)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
          >
            Filtrar
          </button>
        </div>
      </form>

      <OrderTable orders={result.data} />

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          {result.meta.total === 0
            ? 'Nenhum resultado'
            : `${result.meta.total} pedido(s) · página ${result.meta.page} de ${result.meta.totalPages || 1}`}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={result.meta.page <= 1 || pending}
            onClick={() => void load({ ...filters, page: Math.max(1, result.meta.page - 1) })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={result.meta.page >= result.meta.totalPages || pending}
            onClick={() => void load({ ...filters, page: result.meta.page + 1 })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

/** Converte os filtros em um objeto suitable para a URL. */
function toParams(filters: OrderFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.number) params.number = filters.number;
  if (filters.status) params.status = filters.status;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.limit) params.limit = String(filters.limit);

  return params;
}
