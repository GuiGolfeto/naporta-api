import { ORDER_STATUSES, type OrderStatus } from '@naporta/contracts';

/** Rótulos e estilos de cada status, para a interface. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Em separação',
  SHIPPED: 'Em trânsito',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

/** Cores (Tailwind) de cada status. */
export const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200',
  CONFIRMED: 'bg-sky-100 text-sky-800 ring-sky-200',
  PROCESSING: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  SHIPPED: 'bg-violet-100 text-violet-800 ring-violet-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-800 ring-rose-200',
};

/** Todos os status, na ordem do fluxo. */
export const ALL_STATUSES = ORDER_STATUSES;

/** Formata um valor monetário em Real. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Formata uma data `YYYY-MM-DD` como `DD/MM/YYYY`. */
export function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

/** Formata um timestamp ISO como data e hora em pt-BR. */
export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** Formata um documento (CPF/CNPJ) com máscara. */
export function formatDocument(value: string): string {
  if (value.length === 11) {
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (value.length === 14) {
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return value;
}

/** Rótulo do status. */
export function statusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status];
}
