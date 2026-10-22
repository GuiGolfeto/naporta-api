import { Prisma } from '../../generated/prisma/client.js';

/**
 * Extensão de soft delete.
 *
 * Efeitos (aplicados aos modelos `Order` e `User`):
 *  - leituras ignoram registros com `deletedAt` preenchido;
 *  - escritas (`update`) só alcançam registros ativos;
 *  - `delete`/`deleteMany` marcam `deletedAt` em vez de apagar a linha.
 *
 * A extensão é criada a partir de uma função para capturar o client-base no
 * closure — é ele que executa o `update` de soft delete, sem passar pela
 * própria extensão (evitando recursão).
 *
 * Os demais modelos (OrderItem, Address, RefreshToken, OrderCounter) são
 * removidos em cascata pelo próprio banco.
 */
export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'soft-delete',

    query: {
      order: {
        findMany({ args, query }) {
          return query(scopeToActive(args));
        },
        findFirst({ args, query }) {
          return query(scopeToActive(args));
        },
        findUnique({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        findFirstOrThrow({ args, query }) {
          return query(scopeToActive(args));
        },
        findUniqueOrThrow({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        count({ args, query }) {
          return query(scopeToActive(args));
        },
        update({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        updateMany({ args, query }) {
          return query(scopeToActive(args));
        },
        delete({ args }) {
          return client.order.update({
            where: scopeToActiveUnique(args).where,
            data: { deletedAt: new Date() },
          });
        },
        deleteMany({ args }) {
          return client.order.updateMany({
            where: scopeToActive(args).where,
            data: { deletedAt: new Date() },
          });
        },
      },

      user: {
        findMany({ args, query }) {
          return query(scopeToActive(args));
        },
        findFirst({ args, query }) {
          return query(scopeToActive(args));
        },
        findUnique({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        findFirstOrThrow({ args, query }) {
          return query(scopeToActive(args));
        },
        findUniqueOrThrow({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        count({ args, query }) {
          return query(scopeToActive(args));
        },
        update({ args, query }) {
          return query(scopeToActiveUnique(args));
        },
        updateMany({ args, query }) {
          return query(scopeToActive(args));
        },
        delete({ args }) {
          return client.user.update({
            where: scopeToActiveUnique(args).where,
            data: { deletedAt: new Date() },
          });
        },
        deleteMany({ args }) {
          return client.user.updateMany({
            where: scopeToActive(args).where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  }),
);

/**
 * Restringe a operação aos registros ativos (`deleted_at IS NULL`).
 *
 * Usado em operações que recebem um `where` composto (`findMany`, `count`,
 * `updateMany`): o filtro é combined via `AND`, preservando a semântica de
 * qualquer `OR` informado pelo chamador.
 */
function scopeToActive<T extends { where?: unknown }>(args: T): T {
  const where = (args as { where?: unknown }).where;

  return {
    ...args,
    where: {
      AND: [where ?? {}, { deletedAt: null }],
    },
  };
}

/**
 * Restringe a operação aos registros ativos em operações por chave única
 * (`findUnique`, `update`, `delete`).
 *
 * O `where` dessas operações aceita apenas campos únicos, então o filtro é
 * mesclado no próprio objeto — `AND` não é válido nesse contexto.
 */
function scopeToActiveUnique<T extends { where?: unknown }>(args: T): T {
  const where = (args as { where?: unknown }).where;

  return {
    ...args,
    where: {
      ...(typeof where === 'object' && where !== null ? where : {}),
      deletedAt: null,
    },
  };
}
