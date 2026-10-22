import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

import { parsePrice } from '../../common/utils/price.js';
import { onlyDigits } from '../../common/validators/brazilian-document.validator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { UpdateOrderDto } from './dto/update-order.dto.js';
import { canTransitionTo } from './order-status.js';
import { OrderNumberService } from './order-number.service.js';
import type {
  OrderResponse,
  OrderWithRelations,
  PaginatedOrders,
} from './entities/order.response.js';
import { toOrderResponse } from './entities/order.response.js';
import type { OrderQueryDto, OrderSortField } from './dto/order-query.dto.js';

/** Paginação padrão quando o cliente não informa. */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Inclui as relações usadas na resposta. */
const ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' } },
  address: true,
  createdBy: { select: { id: true, name: true } },
} as const;

/** Usuário autenticado (dono do pedido). */
export interface OrderOwner {
  id: string;
  role: string;
}

/**
 * Regras de negócio de pedidos.
 *
 * - O total **nunca** vem do cliente: é sempre recalculado a partir dos itens;
 * - o número do pedido é gerado dentro da mesma transação da criação;
 * - a transição de status é validada contra o fluxo permitido;
 * - um usuário comum só enxerga e altera os próprios pedidos; o admin, todos.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNumberService: OrderNumberService,
  ) {}

  /** Cria um pedido. */
  async create(dto: CreateOrderDto, owner: OrderOwner): Promise<OrderResponse> {
    if (dto.expectedDeliveryDate < startOfToday()) {
      throw new BadRequestException('A data prevista de entrega não pode ser no passado.');
    }

    const total = calculateTotal(dto.items);

    const created = await this.prisma.client.$transaction(async (tx) => {
      const number = await this.orderNumberService.next(undefined, tx);

      return tx.order.create({
        data: {
          number,
          expectedDeliveryDate: new Date(dto.expectedDeliveryDate),
          customerName: dto.customerName.trim(),
          customerDocument: onlyDigits(dto.customerDocument),
          total,
          createdById: owner.id,
          address: {
            create: {
              street: dto.address.street.trim(),
              number: dto.address.number.trim(),
              ...(dto.address.complement ? { complement: dto.address.complement.trim() } : {}),
              neighborhood: dto.address.neighborhood.trim(),
              city: dto.address.city.trim(),
              state: dto.address.state.toUpperCase(),
              zipCode: onlyDigits(dto.address.zipCode),
              ...(dto.address.country ? { country: dto.address.country.toUpperCase() } : {}),
            },
          },
          items: {
            create: dto.items.map((item) => {
              const unitPrice = parsePrice(item.unitPrice);

              return {
                description: item.description.trim(),
                quantity: item.quantity,
                unitPrice,
                total: unitPrice.mul(item.quantity).toDecimalPlaces(2),
              };
            }),
          },
        },
        include: ORDER_INCLUDE,
      });
    });

    return toOrderResponse(created);
  }

  /** Lista pedidos com filtros, paginação e ordenação. */
  async findAll(query: OrderQueryDto, owner: OrderOwner): Promise<PaginatedOrders> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where = this.buildWhere(query, owner);

    const [orders, total] = await this.prisma.client.$transaction([
      this.prisma.client.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: this.buildOrderBy(query.sortBy, query.order),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.order.count({ where }),
    ]);

    return {
      data: orders.map(toOrderResponse),
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /** Detalha um pedido. */
  async findOne(id: string, owner: OrderOwner): Promise<OrderResponse> {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    this.assertCanAccess(order, owner);

    return toOrderResponse(order);
  }

  /** Atualiza um pedido. */
  async update(id: string, dto: UpdateOrderDto, owner: OrderOwner): Promise<OrderResponse> {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    this.assertCanAccess(order, owner);

    if (dto.status && !canTransitionTo(order.status, dto.status)) {
      throw new ConflictException(
        `Não é possível alterar o status de ${order.status} para ${dto.status}.`,
      );
    }

    if (dto.expectedDeliveryDate && dto.expectedDeliveryDate < startOfToday()) {
      throw new BadRequestException('A data prevista de entrega não pode ser no passado.');
    }

    const items = dto.items?.map((item) => {
      const unitPrice = parsePrice(item.unitPrice);

      return {
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice,
        total: unitPrice.mul(item.quantity).toDecimalPlaces(2),
      };
    });

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (items) {
        // A troca de itens substitui a lista anterior (e recalcula o total).
        await tx.orderItem.deleteMany({ where: { orderId: id } });
      }

      return tx.order.update({
        where: { id },
        data: {
          ...(dto.expectedDeliveryDate
            ? { expectedDeliveryDate: new Date(dto.expectedDeliveryDate) }
            : {}),
          ...(dto.customerName ? { customerName: dto.customerName.trim() } : {}),
          ...(dto.customerDocument ? { customerDocument: onlyDigits(dto.customerDocument) } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(items ? { items: { create: items }, total: calculateTotalFrom(items) } : {}),
          ...(dto.address
            ? {
                address: {
                  upsert: {
                    create: {
                      street: dto.address.street.trim(),
                      number: dto.address.number.trim(),
                      ...(dto.address.complement
                        ? { complement: dto.address.complement.trim() }
                        : {}),
                      neighborhood: dto.address.neighborhood.trim(),
                      city: dto.address.city.trim(),
                      state: dto.address.state.toUpperCase(),
                      zipCode: onlyDigits(dto.address.zipCode),
                      ...(dto.address.country
                        ? { country: dto.address.country.toUpperCase() }
                        : {}),
                    },
                    update: {
                      street: dto.address.street.trim(),
                      number: dto.address.number.trim(),
                      ...(dto.address.complement
                        ? { complement: dto.address.complement.trim() }
                        : {}),
                      neighborhood: dto.address.neighborhood.trim(),
                      city: dto.address.city.trim(),
                      state: dto.address.state.toUpperCase(),
                      zipCode: onlyDigits(dto.address.zipCode),
                      ...(dto.address.country
                        ? { country: dto.address.country.toUpperCase() }
                        : {}),
                    },
                  },
                },
              }
            : {}),
        },
        include: ORDER_INCLUDE,
      });
    });

    return toOrderResponse(updated);
  }

  /**
   * Exclui o pedido (lógica).
   *
   * A extensão do Prisma transforma o `delete` em `UPDATE deleted_at` — a
   * linha permanece no banco e some das leituras.
   */
  async remove(id: string, owner: OrderOwner): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    this.assertCanAccess(order, owner);

    await this.prisma.client.order.delete({ where: { id } });
  }

  /** Monta o `where` da listagem a partir dos filtros e do dono do pedido. */
  private buildWhere(query: OrderQueryDto, owner: OrderOwner): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.number) {
      where.number = query.number.trim();
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.expectedDeliveryDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    // Usuário comum: apenas os próprios pedidos. Admin: todos.
    if (owner.role !== 'ADMIN') {
      where.createdById = owner.id;
    }

    return where;
  }

  /** Monta a ordenação, com lista branca de campos. */
  private buildOrderBy(
    sortBy: OrderSortField = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ): Prisma.OrderOrderByWithRelationInput {
    return { [sortBy]: order };
  }

  /**
   * Garante que o pedido existe e que o usuário pode acessá-lo.
   *
   * Sem dono (ou com dono diferente) a resposta é **404**, e não 403: a API
   * não confirma a existência de pedidos de outras pessoas.
   */
  private assertCanAccess(
    order: OrderWithRelations | { id: string } | null,
    owner: OrderOwner,
  ): asserts order is OrderWithRelations {
    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    const createdById = (order as OrderWithRelations).createdById;

    if (owner.role !== 'ADMIN' && createdById !== owner.id) {
      throw new NotFoundException('Pedido não encontrado.');
    }
  }
}

/** Soma os itens para obter o total do pedido. */
export function calculateTotal(
  items: Array<{ quantity: number; unitPrice: string }>,
): Prisma.Decimal {
  return calculateTotalFrom(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: parsePrice(item.unitPrice),
    })),
  );
}

/** Soma itens já convertidos em Decimal. */
export function calculateTotalFrom(
  items: Array<{ quantity: number; unitPrice: Prisma.Decimal }>,
): Prisma.Decimal {
  return items
    .reduce((total, item) => total.plus(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
}

/** Início do dia corrente (UTC), usado para validar a data prevista. */
function startOfToday(): string {
  return new Date().toISOString().slice(0, 10);
}
