import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { HealthService } from './health.service.js';
import type { LivenessStatus } from './health.service.js';
import { PrismaHealthIndicator } from './prisma.health-indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
  ) {}

  /** Liveness — o processo está no ar? Não depende do banco. */
  @Get()
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness();
  }

  /** Readiness — a API está pronta para receber tráfego? Depende do banco. */
  @Get('ready')
  @HealthCheck()
  getReadiness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([() => this.prismaHealthIndicator.pingCheck('database')]);
  }
}
