import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { configuration } from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configuration,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.getOrThrow<string>('app.nodeEnv') === 'production';

        return {
          pinoHttp: {
            level: configService.getOrThrow<string>('logger.level'),
            // Em desenvolvimento o log é legível; em produção, JSON para o agregador.
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname,reqId,res,responseTime,req',
                  },
                },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.passwordHash',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('http.throttleTtl'),
            limit: configService.getOrThrow<number>('http.throttleLimit'),
          },
        ],
      }),
    }),

    PrismaModule,
    OrdersModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
