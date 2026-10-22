import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password/password.service.js';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './tokens/token.service.js';
import { TokenService } from './tokens/token.service.js';

/**
 * Tipo da validade do token.
 *
 * O `@nestjs/jwt` usa os tipos do `ms` (template literal), que não aceitam
 * um `string` genérico vindo da configuração.
 */
type JwtExpiresIn = NonNullable<NonNullable<JwtModuleOptions['signOptions']>['expiresIn']>;

/**
 * Módulo de autenticação.
 *
 * O `JwtModule` é registrado aqui com o segredo vindo da configuração
 * validada — o segredo nunca é lido de `process.env` fora do `ConfigService`.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('auth.jwtExpiresIn') as JwtExpiresIn,
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
          algorithm: 'HS256',
        },
        verifyOptions: {
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  // O `JwtModule` é exportado para que o `JwtAuthGuard` (guard global,
  // registrado no módulo raiz) resolva o `JwtService`.
  exports: [AuthService, TokenService, PasswordService, JwtModule],
})
export class AuthModule {}
