/**
 * Mapeamento de erros conhecidos do Prisma para respostas HTTP.
 *
 * Não importamos as classes de erro do Prisma de propósito: o `code` é a
 * chave estável e pública do Prisma, e essa approach não quebra se a
 * geração do client mudar a árvore de classes.
 */

export interface MappedError {
  statusCode: number;
  error: string;
  message: string;
}

interface PrismaLikeError {
  code: string;
  message: string;
}

const PRISMA_ERROR_CODE_PATTERN = /^P\d{4}$/;

/**
 * Códigos de erro de conexão do driver (`pg`).
 *
 * O Prisma 7 propaga o código do driver (`error.code = 'ECONNREFUSED'`) em vez
 * do `P1001`, e com uma mensagem pouco descritiva — por isso tratamos os
 * dois formatos.
 */
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'EPIPE',
]);

export function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & { code?: unknown };

  if (typeof candidate.code !== 'string') {
    return false;
  }

  return (
    PRISMA_ERROR_CODE_PATTERN.test(candidate.code) || CONNECTION_ERROR_CODES.has(candidate.code)
  );
}

/**
 * Converte um erro do Prisma em uma resposta HTTP coerente.
 *
 * Retorna `null` quando o erro não é do Prisma (ou é desconhecido), para que
 * o chamador aplique o tratamento genérico.
 */
export function mapPrismaError(error: unknown): MappedError | null {
  if (!isPrismaKnownError(error)) {
    return null;
  }

  switch (error.code) {
    // Violação de constraint única (P2002)
    case 'P2002':
      return {
        statusCode: 409,
        error: 'Conflict',
        message: 'Já existe um registro com este valor único.',
      };

    // Violação de foreign key (P2003)
    case 'P2003':
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Referência inválida: o registro relacionado não existe.',
      };

    // Violação de relação obrigatória (P2014)
    case 'P2014':
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Operação viola uma relação entre registros.',
      };

    // Registro não encontrado (P2025)
    case 'P2025':
      return {
        statusCode: 404,
        error: 'Not Found',
        message: 'Registro não encontrado.',
      };

    // Erros de conexão com o banco de dados:
    // P1001 (não foi possível conectar), P1002 (timeout do servidor),
    // P1008 (operação expirou), P1017 (conexão encerrada pelo servidor) e os
    // códigos de conexão propagados pelo driver `pg`.
    case 'P1001':
    case 'P1002':
    case 'P1008':
    case 'P1017':
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
    case 'EPIPE':
      return {
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Banco de dados indisponível no momento.',
      };

    default:
      return null;
  }
}
