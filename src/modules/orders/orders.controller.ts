import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import type { OrderResponse } from './entities/order.response.js';
import { OrdersService } from './orders.service.js';
import type { PaginatedOrders } from './orders.service.js';

/** Usuário autenticado, do ponto de vista do módulo de pedidos. */
interface AuthenticatedOwner {
  id: string;
  role: Role;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Cria um pedido. */
  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<OrderResponse> {
    return this.ordersService.create(dto, user);
  }

  /** Lista pedidos com filtros, paginação e ordenação. */
  @Get()
  findAll(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<PaginatedOrders> {
    return this.ordersService.findAll(query, user);
  }

  /** Detalha um pedido. */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<OrderResponse> {
    return this.ordersService.findOne(id, user);
  }

  /** Atualiza um pedido. */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<OrderResponse> {
    return this.ordersService.update(id, dto, user);
  }

  /** Exclui um pedido (exclusão lógica). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<void> {
    await this.ordersService.remove(id, user);
  }
}
