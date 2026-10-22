import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Cliente Prisma com ciclo de vida gerenciado pelo Nest.
 *
 * No Prisma 7 a conexão é feita via *driver adapter* (`@prisma/adapter-pg`),
 * que usa o pool do `pg` por baixo dos panos.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('database.url');

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Conexão com o banco de dados estabelecida.');
    } catch (error) {
      // A API sobe mesmo sem banco: o health check de readiness (/health/ready)
      // é quem reporta a indisponibilidade e o orquestrador decide o que fazer.
      this.logger.error(
        `Falha ao conectar ao banco de dados: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
