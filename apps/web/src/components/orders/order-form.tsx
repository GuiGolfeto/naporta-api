'use client';

import { useActionState, useState } from 'react';

import { createOrderAction } from '@/app/actions/orders';

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
  const [state, formAction, pending] = useActionState(createOrderAction, {});
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

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none';

  return (
    <form action={formAction} className="space-y-6">
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
                name="itemDescription"
                value={item.description}
                onChange={(event) => updateItem(item.id, { description: event.target.value })}
                placeholder="Descrição do item"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                name="itemQuantity"
                type="number"
                min={1}
                max={9999}
                value={item.quantity}
                onChange={(event) =>
                  updateItem(item.id, { quantity: Number(event.target.value) || 1 })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                name="itemUnitPrice"
                value={item.unitPrice}
                onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })}
                placeholder="0,00"
                inputMode="decimal"
                required
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

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {state.error}
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
