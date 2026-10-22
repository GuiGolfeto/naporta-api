import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { AuthSession, AuthUser, RequestContext } from './entities/auth-user.entity.js';
import { PasswordService } from './password/password.service.js';
import { TokenService } from './tokens/token.service.js';

/**
 * Regras de autenticação.
 *
 * - O registro **sempre** cria usuário com papel `USER` — o papel nunca vem
 *   do cliente (evita escalate de privilégio).
 * - O login responde sempre a mesma mensagem, exista ou não o e-mail.
 * - O refresh token é rotativo: a cada renovação o token anterior é revogado.
 * - Se um refresh token já revogado for reapresentado, assume-se roubo e
 *   **todas** as sessões do usuário são revogadas.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  /** Cria um usuário e devolve a sessão inicial. */
  async register(dto: RegisterDto, context: RequestContext): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.client.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.prisma.client.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        // O papel é fixo: o cliente não escolhe o próprio nível de acesso.
        role: 'USER',
      },
    });

    return this.issueSession(user, context);
  }

  /** Autentica o usuário e emite uma nova sessão. */
  async login(dto: LoginDto, context: RequestContext): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.client.user.findUnique({ where: { email } });

    if (!user) {
      // Verifica um hash descartável para não revelar (por tempo de resposta)
      // que o e-mail não existe.
      await this.passwordService.verifyDummy(dto.password);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.issueSession(user, context);
  }

  /**
   * Renova a sessão trocando o refresh token.
   *
   * Detecção de reuso: um refresh token revogado não é aceito — e a tentativa
   * revoga todas as sessões do usuário, porque significa que o token vazou.
   */
  async refresh(dto: RefreshTokenDto, context: RequestContext): Promise<AuthSession> {
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);

    const storedToken = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (storedToken.revokedAt) {
      await this.revokeAllSessions(storedToken.userId);
      throw new UnauthorizedException(
        'Refresh token já utilizado. Todas as sessões foram revogadas.',
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expirado.');
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: storedToken.userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou inexistente.');
    }

    // Rotação: o token usado é revogado no mesmo instante em que o novo é emitido.
    await this.prisma.client.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(user, context);
  }

  /** Revoga o refresh token informado (logout). */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);

    await this.prisma.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoga todas as sessões ativas do usuário. */
  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Emite access token + refresh token e persiste o hash do refresh token. */
  private async issueSession(
    user: {
      id: string;
      name: string;
      email: string;
      role: AuthUser['role'];
      isActive: boolean;
      createdAt: Date;
    },
    context: RequestContext,
  ): Promise<AuthSession> {
    const accessToken = this.tokenService.signAccessToken(user);
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    const expiresAt = new Date(Date.now() + this.tokenService.refreshTokenExpiresIn * 1_000);

    await this.prisma.client.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt,
        ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 255) } : {}),
        ...(context.ipAddress ? { ipAddress: context.ipAddress.slice(0, 45) } : {}),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokenService.accessTokenExpiresIn,
    };
  }
}
