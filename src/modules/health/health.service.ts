import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { readPackageVersion } from '../../common/utils/read-package-version.js';

export interface LivenessStatus {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Liveness: responde se o processo está vivo.
 *
 * Não toca o banco de propósito — se o Postgres cair, a API deve continuar
 * no ar para que o orquestrador possa reiniciar apenas o banco.
 */
@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getLiveness(): LivenessStatus {
    return {
      status: 'ok',
      service: 'naporta-api',
      version: readPackageVersion(),
      environment: this.configService.getOrThrow<string>('app.nodeEnv'),
      uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };
  }
}
