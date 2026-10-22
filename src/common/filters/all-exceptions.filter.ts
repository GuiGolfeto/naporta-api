import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { mapPrismaError } from '../errors/prisma-error.mapper.js';

/** Formato único de erro devolvido pela API. */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

type RequestWithId = Request & { id?: string | number };

/**
 * Filtro global de exceções.
 *
 * Garante que nenhuma requisição devolva uma resposta fora do contrato:
 * o cliente sempre recebe `{ statusCode, error, message, path, timestamp }`.
 *
 * Registrado via `APP_FILTER` para que a injeção de dependências funcione
 * (o logger do pino é resolvido pelo container do Nest).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<RequestWithId>();

    const { statusCode, error, message, details } = this.toErrorPayload(exception);

    const payload: ApiErrorResponse = {
      statusCode,
      error,
      message,
      ...(details === undefined ? {} : { details }),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      ...(request.id === undefined ? {} : { requestId: String(request.id) }),
    };

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        { err: exception, statusCode, path: payload.path },
        'Erro não tratado ao processar a requisição',
      );
    } else {
      this.logger.warn(
        { statusCode, path: payload.path, message: payload.message },
        'Requisição rejeitada',
      );
    }

    response.status(statusCode).json(payload);
  }

  private toErrorPayload(exception: unknown): {
    statusCode: number;
    error: string;
    message: string | string[];
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { statusCode, error: this.statusLabel(statusCode), message: response };
      }

      const body = response as { message?: string | string[]; error?: unknown; details?: unknown };

      return {
        statusCode,
        // Alguns módulos (ex.: Terminus) devolvem um objeto em `error`;
        // o contrato da API exige sempre uma string.
        error: typeof body.error === 'string' ? body.error : this.statusLabel(statusCode),
        message: body.message ?? exception.message,
        ...(body.details === undefined ? {} : { details: body.details }),
      };
    }

    const prismaError = mapPrismaError(exception);
    if (prismaError) {
      return prismaError;
    }

    const isProduction = process.env.NODE_ENV === 'production';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: isProduction
        ? 'Erro interno do servidor.'
        : exception instanceof Error
          ? exception.message
          : 'Erro interno do servidor.',
    };
  }

  private statusLabel(statusCode: number): string {
    const label = HttpStatus[statusCode];

    if (!label) {
      return 'Error';
    }

    return label
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
