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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../generated/prisma/client.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrderResponse, PaginatedOrders } from './entities/order.response.js';
import { OrdersService } from './orders.service.js';

/** Usuário autenticado, do ponto de vista do módulo de pedidos. */
interface AuthenticatedOwner {
  id: string;
  role: Role;
}

@ApiTags('Pedidos')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Cria um pedido. */
  @Post()
  @ApiOperation({
    summary: 'Cria um pedido',
    description:
      'O número (`NP-AAAA-NNNNN`) é gerado pelo servidor, dentro da mesma transação da ' +
      'criação, e o total é sempre calculado a partir dos itens — o cliente não informa o valor.',
  })
  @ApiResponse({ status: 201, description: 'Pedido criado.', type: OrderResponse })
  @ApiResponse({ status: 401, description: 'Autenticação obrigatória.' })
  @ApiResponse({ status: 422, description: 'Dados inválidos (documento, itens, preço ou data).' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<OrderResponse> {
    return this.ordersService.create(dto, user);
  }

  /** Lista pedidos com filtros, paginação e ordenação. */
  @Get()
  @ApiOperation({
    summary: 'Lista pedidos',
    description:
      'Filtra por `number`, `status` e período (`startDate`/`endDate`, sobre a data prevista ' +
      'de entrega). Usuários comuns veem apenas os próprios pedidos; o administrador vê todos.',
  })
  @ApiResponse({ status: 200, description: 'Página de pedidos.', type: PaginatedOrders })
  @ApiResponse({ status: 401, description: 'Autenticação obrigatória.' })
  @ApiResponse({ status: 422, description: 'Filtro ou paginação inválidos.' })
  findAll(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<PaginatedOrders> {
    return this.ordersService.findAll(query, user);
  }

  /** Detalha um pedido. */
  @Get(':id')
  @ApiOperation({ summary: 'Detalha um pedido' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado.', type: OrderResponse })
  @ApiResponse({ status: 400, description: 'Identificador inválido.' })
  @ApiResponse({ status: 404, description: 'Pedido inexistente ou de outro usuário.' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<OrderResponse> {
    return this.ordersService.findOne(id, user);
  }

  /** Atualiza um pedido. */
  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza um pedido',
    description:
      'Todos os campos são opcionais. Trocar a lista de itens recalcula o total; a troca de ' +
      'status é validada contra o fluxo permitido e devolve `409` quando inválida.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Pedido atualizado.', type: OrderResponse })
  @ApiResponse({ status: 400, description: 'Data prevista inválida ou no passado.' })
  @ApiResponse({ status: 404, description: 'Pedido inexistente ou de outro usuário.' })
  @ApiResponse({ status: 409, description: 'Transição de status não permitida.' })
  @ApiResponse({ status: 422, description: 'Dados inválidos.' })
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
  @ApiOperation({
    summary: 'Exclui um pedido',
    description:
      'Exclusão lógica: a linha permanece no banco com `deleted_at` preenchido e some das leituras.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Pedido excluído.' })
  @ApiResponse({ status: 404, description: 'Pedido inexistente ou de outro usuário.' })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedOwner,
  ): Promise<void> {
    await this.ordersService.remove(id, user);
  }
}
