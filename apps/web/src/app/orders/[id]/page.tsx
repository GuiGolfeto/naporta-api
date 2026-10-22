import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { OrderActions } from '@/components/orders/order-actions';
import { StatusBadge } from '@/components/orders/status-badge';
import { apiRequest } from '@/lib/api-client';
import { formatCurrency, formatDate, formatDateTime, formatDocument } from '@/lib/format';
import { readSession } from '@/lib/session';
import type { Order } from '@naporta/contracts';

/** Parâmetros de rota (o Next entrega como Promise). */
type Params = Promise<{ id: string }>;

export const metadata = {
  title: 'Pedido — naPorta',
};

/** Detalhe do pedido. */
export default async function OrderDetailPage({ params }: { params: Params }) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  let order: Order;

  try {
    order = await apiRequest<Order>(`/orders/${id}`, { token: session.accessToken });
  } catch (error) {
    const status = (error as { status?: number }).status;

    // 404: o pedido não existe (ou foi excluído).
    // 400: o id nem siquiera é um UUID — também é "pedido inexistente".
    // Qualquer outro erro cai na fronteira de erro da rota (`error.tsx`),
    // que explica o que houve em vez de devolver um 500 sem contexto.
    if (status === 404 || status === 400) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar para os pedidos
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-900">
            {order.number}
          </h1>
          <StatusBadge status={order.status} />
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Criado em {formatDateTime(order.createdAt)} · atualizado em{' '}
          {formatDateTime(order.updatedAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
              Itens
            </h2>

            <table className="orders">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="text-right">Qtd.</th>
                  <th className="text-right">Unitário</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="text-slate-700">{item.description}</td>
                    <td className="text-right text-slate-600">{item.quantity}</td>
                    <td className="text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right font-medium text-slate-800">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-right font-semibold text-slate-700">
                    Total
                  </td>
                  <td className="text-right text-base font-semibold text-slate-900">
                    {formatCurrency(order.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Endereço de entrega</h2>

            {order.address ? (
              <address className="mt-3 text-sm not-italic text-slate-600">
                {order.address.street}, {order.address.number}
                {order.address.complement ? ` — ${order.address.complement}` : ''}
                <br />
                {order.address.neighborhood} · {order.address.city}/{order.address.state}
                <br />
                CEP {order.address.zipCode} · {order.address.country}
              </address>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Endereço não informado.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Cliente</h2>
            <p className="mt-3 text-sm font-medium text-slate-700">{order.customer.name}</p>
            <p className="text-sm text-slate-500">{formatDocument(order.customer.document)}</p>
            <p className="mt-3 text-sm text-slate-500">
              Entrega prevista em <strong>{formatDate(order.expectedDeliveryDate)}</strong>
            </p>
            <p className="text-sm text-slate-500">Criado por {order.createdBy.name}</p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Ações</h2>
            <div className="mt-4">
              <OrderActions orderId={order.id} status={order.status} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
