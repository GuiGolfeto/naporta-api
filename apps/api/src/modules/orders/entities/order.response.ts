import type {
  Order as OrderContract,
  OrderAddress,
  OrderCustomer,
  OrderItem as OrderItemContract,
  OrderOwner,
  OrderStatus,
  Paginated,
  PaginationMeta as PaginationMetaContract,
} from '@naporta/contracts';

import type { Address, Order, OrderItem, User } from '../../../generated/prisma/client.js';

/** Pedido com as relações necessárias para a resposta da API. */
export type OrderWithRelations = Order & {
  items: OrderItem[];
  address: Address | null;
  createdBy: Pick<User, 'id' | 'name'>;
};

/**
 * Item do pedido na resposta da API.
 *
 * É uma **classe** (e não uma interface) para que o plugin do
 * `@nestjs/swagger` gere o schema OpenAPI a partir dos tipos.
 */
export class OrderItemResponse implements OrderItemContract {
  id!: string;
  description!: string;
  quantity!: number;
  unitPrice!: number;
  total!: number;
}

/** Endereço de entrega na resposta da API. */
export class OrderAddressResponse implements OrderAddress {
  street!: string;
  number!: string;
  complement!: string | null;
  neighborhood!: string;
  city!: string;
  state!: string;
  zipCode!: string;
  country!: string;
}

/** Cliente do pedido na resposta da API. */
export class OrderCustomerResponse implements OrderCustomer {
  name!: string;
  document!: string;
}

/** Usuário que criou o pedido. */
export class OrderOwnerResponse implements OrderOwner {
  id!: string;
  name!: string;
}

/** Pedido na resposta da API. */
export class OrderResponse implements OrderContract {
  id!: string;
  number!: string;
  status!: OrderStatus;
  expectedDeliveryDate!: string;
  customer!: OrderCustomerResponse;
  address!: OrderAddressResponse | null;
  items!: OrderItemResponse[];
  total!: number;
  createdBy!: OrderOwnerResponse;
  createdAt!: string;
  updatedAt!: string;
}

/** Metainformação de paginação. */
export class PaginationMeta implements PaginationMetaContract {
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

/** Página de pedidos. */
export class PaginatedOrders implements Paginated<OrderResponse> {
  data!: OrderResponse[];
  meta!: PaginationMeta;
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
