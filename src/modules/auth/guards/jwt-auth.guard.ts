import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../tokens/token.service.js';

/**
 * Guard global de autenticação (Bearer token).
 *
 * Política "secure by default": toda rota exige token, exceto as marcadas com
 * `@Public()`.
 *
 * Além de validar a assinatura do JWT, o guard recarrega o usuário do banco a
 * cada requisição. Isso garante que uma conta desativada ou excluída (soft
 * delete) perca o acesso imediatamente, sem esperar o token expirar — e que o
 * papel usado na autorização esteja sempre atualizado.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token de acesso inválido.');
    }

    // O usuário é lido do banco a cada requisição: conta desativada ou
    // excluída perde o acesso imediatamente.
    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou inexistente.');
    }

    request.user = user;

    return true;
  }
}

/** Extrai o token do header `Authorization: Bearer <token>`. */
function extractBearerToken(request: { headers: Record<string, unknown> }): string | undefined {
  const header = request.headers.authorization;

  if (typeof header !== 'string') {
    return undefined;
  }

  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}
