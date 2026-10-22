import { type OrderStatus } from '../../../generated/prisma/client.js';
import type { Address, Order, OrderItem, User } from '../../../generated/prisma/client.js';

/** Pedido com as relações necessárias para a resposta da API. */
export type OrderWithRelations = Order & {
  items: OrderItem[];
  address: Address | null;
  createdBy: Pick<User, 'id' | 'name'>;
};

/** Item do pedido na resposta da API. */
export interface OrderItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Endereço de entrega na resposta da API. */
export interface OrderAddressResponse {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** Pedido na resposta da API. */
export interface OrderResponse {
  id: string;
  number: string;
  status: OrderStatus;
  expectedDeliveryDate: string;
  customer: {
    name: string;
    document: string;
  };
  address: OrderAddressResponse | null;
  items: OrderItemResponse[];
  total: number;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Converte o modelo do Prisma na resposta da API.
 *
 * É o único ponto onde `Decimal` vira `number` e onde a data (que no banco é
 * `DATE`) vira `YYYY-MM-DD` — a API nunca expõe o modelo cru.
 */
export function toOrderResponse(order: OrderWithRelations): OrderResponse {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    expectedDeliveryDate: formatDateOnly(order.expectedDeliveryDate),
    customer: {
      name: order.customerName,
      document: order.customerDocument,
    },
    address: order.address
      ? {
          street: order.address.street,
          number: order.address.number,
          complement: order.address.complement,
          neighborhood: order.address.neighborhood,
          city: order.address.city,
          state: order.address.state,
          zipCode: order.address.zipCode,
          country: order.address.country,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    total: Number(order.total),
    createdBy: {
      id: order.createdBy.id,
      name: order.createdBy.name,
    },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/** Formata uma data como `YYYY-MM-DD` (a coluna é `DATE`, sem hora). */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
