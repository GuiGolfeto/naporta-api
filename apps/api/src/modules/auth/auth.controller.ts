import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthThrottled } from '../../common/throttling/auth-throttled.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthSession, AuthUser } from './entities/auth-user.entity.js';
import type { RequestContext } from './entities/auth-user.entity.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Cria uma conta e devolve a sessão inicial. */
  @Post('register')
  @Public()
  @AuthThrottled()
  @ApiOperation({
    summary: 'Cria uma conta',
    description:
      'Cadastra um novo usuário (papel `USER`) e devolve access token + refresh token. ' +
      'O papel **não** pode ser escolhido no cadastro — enviá-lo resulta em `422`.',
  })
  @ApiResponse({ status: 201, description: 'Conta criada e sessão emitida.', type: AuthSession })
  @ApiResponse({ status: 409, description: 'Já existe um usuário com este e-mail.' })
  @ApiResponse({ status: 422, description: 'Dados inválidos (e-mail, senha fraca, campo extra).' })
  @ApiResponse({ status: 429, description: 'Limite de tentativas excedido.' })
  register(@Body() dto: RegisterDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.register(dto, toRequestContext(request));
  }

  /** Autentica e emite access token + refresh token. */
  @Post('login')
  @Public()
  @AuthThrottled()
  @ApiOperation({
    summary: 'Autentica o usuário',
    description:
      'Valida e-mail e senha e emite a sessão. A resposta é a mesma para e-mail inexistente ' +
      'e senha incorreta, para não permitir enumeração de contas.',
  })
  @ApiResponse({ status: 201, description: 'Autenticação realizada.', type: AuthSession })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @ApiResponse({ status: 429, description: 'Limite de tentativas excedido.' })
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.login(dto, toRequestContext(request));
  }

  /** Renova a sessão (rotaciona o refresh token). */
  @Post('refresh')
  @Public()
  @AuthThrottled()
  @ApiOperation({
    summary: 'Renova a sessão',
    description:
      'Troca o refresh token por um novo par de tokens. O token usado é revogado; ' +
      'reapresentá-lo é tratado como roubo e revoga todas as sessões do usuário.',
  })
  @ApiResponse({ status: 201, description: 'Sessão renovada.', type: AuthSession })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado ou já utilizado.' })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.refresh(dto, toRequestContext(request));
  }

  /** Revoga o refresh token informado. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra a sessão', description: 'Revoga o refresh token informado.' })
  @ApiResponse({ status: 204, description: 'Sessão encerrada.' })
  @ApiResponse({ status: 401, description: 'Autenticação obrigatória.' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /** Dados do usuário autenticado. */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário.', type: AuthUser })
  @ApiResponse({ status: 401, description: 'Token ausente, inválido ou expirado.' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}

/** Extrai user-agent e IP para auditoria dos tokens. */
function toRequestContext(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];

  return {
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
    ...(request.ip ? { ipAddress: request.ip } : {}),
  };
}
