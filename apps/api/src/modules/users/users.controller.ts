import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { PaginatedUsers } from './entities/user.response.js';
import { UsersService } from './users.service.js';

/**
 * Rotas administrativas de usuário.
 *
 * A classe inteira exige o papel `ADMIN` — o `RolesGuard` (guard global)
 * devolve 403 para qualquer outro papel.
 */
@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lista os usuários cadastrados. */
  @Get()
  @ApiOperation({
    summary: 'Lista usuários',
    description: 'Restrito ao administrador. A resposta nunca inclui o hash da senha.',
  })
  @ApiResponse({ status: 200, description: 'Página de usuários.', type: PaginatedUsers })
  @ApiResponse({ status: 401, description: 'Autenticação obrigatória.' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissão de administrador.' })
  findAll(@Query() query: UserQueryDto): Promise<PaginatedUsers> {
    return this.usersService.findAll(query);
  }
}
