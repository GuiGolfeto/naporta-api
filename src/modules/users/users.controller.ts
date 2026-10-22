import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import type { PaginatedUsers } from './users.service.js';
import { UsersService } from './users.service.js';

/**
 * Rotas administrativas de usuário.
 *
 * A classe inteira exige o papel `ADMIN` — o `RolesGuard` (guard global)
 * devolve 403 para qualquer outro papel.
 */
@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lista os usuários cadastrados. */
  @Get()
  findAll(@Query() query: UserQueryDto): Promise<PaginatedUsers> {
    return this.usersService.findAll(query);
  }
}
