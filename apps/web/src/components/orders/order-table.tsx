import Link from 'next/link';

import { formatCurrency, formatDate, formatDocument } from '@/lib/format';
import type { Order } from '@naporta/contracts';

import { StatusBadge } from './status-badge';

/** Tabela com os pedidos. */
export function OrderTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">Nenhum pedido encontrado</p>
        <p className="mt-1 text-sm text-slate-500">
          Ajuste os filtros ou{' '}
          <Link className="text-emerald-700 underline" href="/orders/new">
            crie um pedido
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="orders">
        <thead>
          <tr>
            <th>Número</th>
            <th>Cliente</th>
            <th>Entrega prevista</th>
            <th>Itens</th>
            <th className="text-right">Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link
                  href={`/orders/${order.id}`}
                  className="font-mono text-sm font-medium text-emerald-700 hover:underline"
                >
                  {order.number}
                </Link>
              </td>
              <td>
                <p className="font-medium text-slate-800">{order.customer.name}</p>
                <p className="text-xs text-slate-500">{formatDocument(order.customer.document)}</p>
              </td>
              <td className="text-slate-600">{formatDate(order.expectedDeliveryDate)}</td>
              <td className="text-slate-600">
                {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
              </td>
              <td className="text-right font-medium text-slate-800">
                {formatCurrency(order.total)}
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
