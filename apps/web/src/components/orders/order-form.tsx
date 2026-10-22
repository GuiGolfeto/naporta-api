'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { createOrderAction } from '@/app/actions/orders';
import type { CreateOrderInput } from '@naporta/contracts';

/** Item editável no formulário. */
interface DraftItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: string;
}

/** Data de hoje, no formato `YYYY-MM-DD`. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Formulário de criação de pedido. */
export function OrderForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([
    { id: 1, description: '', quantity: 1, unitPrice: '' },
  ]);

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: Math.max(0, ...current.map((item) => item.id)) + 1,
        description: '',
        quantity: 1,
        unitPrice: '',
      },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateItem = (id: number, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    const payload: CreateOrderInput = {
      expectedDeliveryDate: String(data.get('expectedDeliveryDate') ?? ''),
      customerName: String(data.get('customerName') ?? ''),
      customerDocument: String(data.get('customerDocument') ?? '').replace(/\D/g, ''),
      address: {
        street: String(data.get('street') ?? ''),
        number: String(data.get('number') ?? ''),
        neighborhood: String(data.get('neighborhood') ?? ''),
        city: String(data.get('city') ?? ''),
        state: String(data.get('state') ?? '').toUpperCase(),
        zipCode: String(data.get('zipCode') ?? '').replace(/\D/g, ''),
        ...(data.get('complement') ? { complement: String(data.get('complement')) } : {}),
      },
      items: items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice.trim(),
        })),
    };

    setPending(true);
    setError(null);

    const result = await createOrderAction(payload);

    if (result.error || !result.orderId) {
      setError(result.error ?? 'Não foi possível criar o pedido.');
      setPending(false);
      return;
    }

    router.push(`/orders/${result.orderId}`);
    router.refresh();
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Cliente e entrega</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Nome do cliente</span>
            <input name="customerName" required minLength={2} className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">CPF ou CNPJ</span>
            <input
              name="customerDocument"
              required
              inputMode="numeric"
              placeholder="Somente dígitos"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Entrega prevista</span>
            <input
              name="expectedDeliveryDate"
              type="date"
              required
              min={today()}
              defaultValue={today()}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Logradouro</span>
            <input name="street" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Número</span>
            <input name="number" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Complemento</span>
            <input name="complement" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Bairro</span>
            <input name="neighborhood" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Cidade</span>
            <input name="city" required className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">UF</span>
            <input name="state" required maxLength={2} placeholder="SP" className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">CEP</span>
            <input
              name="zipCode"
              required
              inputMode="numeric"
              placeholder="01001000"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Itens</h2>
          <button
            type="button"
            onClick={addItem}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Adicionar item
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem_auto]">
              <input
                value={item.description}
                onChange={(event) => updateItem(item.id, { description: event.target.value })}
                placeholder="Descrição do item"
                required
                aria-label="Descrição do item"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="number"
                min={1}
                max={9999}
                value={item.quantity}
                onChange={(event) =>
                  updateItem(item.id, { quantity: Number(event.target.value) || 1 })
                }
                aria-label="Quantidade"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                value={item.unitPrice}
                onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })}
                placeholder="0,00"
                inputMode="decimal"
                required
                aria-label="Preço unitário"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="rounded-md px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          O total do pedido é calculado pela API a partir dos itens — não é enviado pelo portal.
        </p>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Criando…' : 'Criar pedido'}
        </button>
      </div>
    </form>
  );
}
