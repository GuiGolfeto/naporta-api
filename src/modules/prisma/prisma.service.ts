import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { softDeleteExtension } from './prisma.extensions.js';

/**
 * Cria o client Prisma com a extensão de soft delete aplicada.
 *
 * O tipo do client estendido é inferido daqui, para que o resto da aplicação
 * tenha acesso tipado a `order`, `user`, etc.
 */
export function createPrismaClient(options: Prisma.PrismaClientOptions) {
  return new PrismaClient(options).$extends(softDeleteExtension);
}

/** Client Prisma estendido (com soft delete). */
export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Cliente Prisma da aplicação, com extensão de soft delete.
 *
 * Uso: `this.prisma.client.order.findMany(...)`.
 *
 * A extensão garante que:
 *  - leituras nunca retornem registros excluídos (`deletedAt` preenchido);
 *  - `delete`/`deleteMany` facam exclusão lógica em vez de apagar a linha;
 *  - `update` só alcance registros ativos.
 *
 * O client é composto (e não herdado) porque o Prisma devolve um novo objeto
 * ao aplicar extensões; herdá-lo exigiria `as unknown as` e perderia a
 * segurança de tipos.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly client: ExtendedPrismaClient;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('database.url');

    this.client = createPrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
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
    await this.client.$disconnect();
  }
}
