import { Module } from '@nestjs/common';

import { OrderNumberService } from './order-number.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Módulo de pedidos.
 *
 * O CRUD, os filtros e as regras de negócio do pedido vivem aqui.
 */
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberService],
  exports: [OrdersService, OrderNumberService],
})
export class OrdersModule {}
