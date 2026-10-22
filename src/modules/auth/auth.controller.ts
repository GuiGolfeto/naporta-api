import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthThrottled } from '../../common/throttling/auth-throttled.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthSession, AuthUser, RequestContext } from './entities/auth-user.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Cria uma conta e devolve a sessão inicial. */
  @Post('register')
  @Public()
  @AuthThrottled()
  register(@Body() dto: RegisterDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.register(dto, toRequestContext(request));
  }

  /** Autentica e emite access token + refresh token. */
  @Post('login')
  @Public()
  @AuthThrottled()
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.login(dto, toRequestContext(request));
  }

  /** Renova a sessão (rotação do refresh token). */
  @Post('refresh')
  @Public()
  @AuthThrottled()
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<AuthSession> {
    return this.authService.refresh(dto, toRequestContext(request));
  }

  /** Revoga o refresh token informado. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /** Dados do usuário autenticado. */
  @Get('me')
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
