import { Module } from '@nestjs/common';

import { OrderNumberService } from './order-number.service.js';

/**
 * Módulo de pedidos.
 *
 * Neste módulo (Módulo 1 — Camada de dados) concentra-se apenas o serviço de
 * numeração. O CRUD, os filtros e as regras de negócio entram no Módulo 3.
 */
@Module({
  providers: [OrderNumberService],
  exports: [OrderNumberService],
})
export class OrdersModule {}
