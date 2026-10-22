import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { Role } from '../../../generated/prisma/client.js';
import type { User } from '../../../generated/prisma/client.js';

/** Claims do access token. */
export interface AccessTokenPayload {
  /** Id do usuário. */
  sub: string;
  email: string;
  role: Role;
  /** Discriminador do tipo de token — impede reaproveitar um refresh token
   *  como access token (e vice-versa). */
  type: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/** Issuer e audience dos tokens emitidos pela API. */
export const TOKEN_ISSUER = 'naporta-api';
export const TOKEN_AUDIENCE = 'naporta-clients';

/**
 * Emissão e validação de tokens.
 *
 * - **Access token**: JWT (HS256) de curta duração, com `sub`, `email`, `role`
 *   e `type: 'access'`.
 * - **Refresh token**: valor opaco e aleatório (48 bytes). Só o hash SHA-256
 *   é persistido — se o banco vazar, nenhum refresh token pode ser reaproveitado.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Assina o access token do usuário. */
  signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.sign(payload);
  }

  /** Gera um refresh token opaco e aleatório. */
  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  /** Gera o hash SHA-256 do refresh token (o que de fato é armazenado). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Validade do access token, em segundos. */
  get accessTokenExpiresIn(): number {
    return parseDurationToSeconds(this.configService.getOrThrow<string>('auth.jwtExpiresIn'));
  }

  /** Validade do refresh token, em segundos. */
  get refreshTokenExpiresIn(): number {
    return parseDurationToSeconds(
      this.configService.getOrThrow<string>('auth.jwtRefreshExpiresIn'),
    );
  }
}

/**
 * Converte durações no formato do `ms` (ex.: `15m`, `7d`, `900`) em segundos.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(duration.trim());

  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1 / 1000,
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
  };

  return Math.floor(value * (multipliers[unit] ?? 1));
}
