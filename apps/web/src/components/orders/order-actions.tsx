'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { changeOrderStatusAction, deleteOrderAction } from '@/app/actions/orders';
import { statusLabel } from '@/lib/format';
import { ORDER_STATUS_TRANSITIONS } from '@naporta/contracts';
import type { OrderStatus } from '@naporta/contracts';

/** Ações de status e exclusão de um pedido. */
export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const transitions = ORDER_STATUS_TRANSITIONS[status] ?? [];

  const changeStatus = (next: OrderStatus) => {
    setError(null);

    startTransition(async () => {
      try {
        await changeOrderStatusAction(orderId, next);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível mudar o status.');
      }
    });
  };

  const remove = () => {
    setError(null);

    startTransition(async () => {
      try {
        await deleteOrderAction(orderId);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o pedido.');
        setConfirming(false);
      }
    });
  };

  return (
    <div className="space-y-3">
      {transitions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={pending}
              onClick={() => changeStatus(next)}
              className={`rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-60 ${
                next === 'CANCELLED'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Marcar como {statusLabel(next)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Este pedido está em um status final — não há mais transições disponíveis.
        </p>
      )}

      <div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
            >
              Confirmar exclusão
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            Excluir pedido
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
