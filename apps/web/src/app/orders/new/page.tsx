import { redirect } from 'next/navigation';

import { OrderForm } from '@/components/orders/order-form';
import { readSession } from '@/lib/session';

export const metadata = {
  title: 'Novo pedido — naPorta',
};

/** Formulário de criação de pedido. */
export default async function NewOrderPage() {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Novo pedido</h1>
        <p className="mt-1 text-sm text-slate-500">
          O número e o total são definidos pela API — o portal só envia os dados do pedido.
        </p>
      </div>

      <OrderForm />
    </div>
  );
}
