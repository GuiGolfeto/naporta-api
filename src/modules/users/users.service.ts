import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import type { UserQueryDto } from './dto/user-query.dto.js';
import type { PaginatedUsers } from './entities/user.response.js';
import { toUserResponse } from './entities/user.response.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Consulta de usuários.
 *
 * Uso restrito ao administrador (o `RolesGuard` bloqueia os demais) e a
 * resposta nunca inclui o `passwordHash` — o `select` garante isso.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserQueryDto): Promise<PaginatedUsers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.UserWhereInput = {};

    if (query.email) {
      where.email = { contains: query.email.trim().toLowerCase() };
    }

    if (query.role) {
      where.role = query.role;
    }

    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      data: users.map(toUserResponse),
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
