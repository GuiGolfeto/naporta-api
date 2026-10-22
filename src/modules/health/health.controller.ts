import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';
import type { LivenessStatus } from './health.service.js';
import { PrismaHealthIndicator } from './prisma.health-indicator.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
  ) {}

  /** Liveness — o processo está no ar? Não depende do banco. */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Liveness',
    description: 'Responde 200 enquanto o processo estiver vivo.',
  })
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness();
  }

  /** Readiness — a API está pronta para receber tráfego? Depende do banco. */
  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness',
    description: 'Verifica o banco de dados; responde 503 quando ele está indisponível.',
  })
  @HealthCheck()
  getReadiness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([() => this.prismaHealthIndicator.pingCheck('database')]);
  }
}
