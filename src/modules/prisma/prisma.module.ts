import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Módulo global do Prisma: o `PrismaService` fica disponível para injeção
 * em qualquer módulo da aplicação sem necessidade de reimportação.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
