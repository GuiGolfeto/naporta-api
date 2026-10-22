import { STATUS_STYLES, statusLabel } from '@/lib/format';
import type { OrderStatus } from '@naporta/contracts';

/** Etiqueta colorida com o status do pedido. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
