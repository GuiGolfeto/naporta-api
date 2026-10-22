import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

import { readPackageVersion } from './utils/read-package-version.js';

/** Caminho da documentação na API. */
export const SWAGGER_PATH = 'docs';

/**
 * Monta e publica a documentação OpenAPI (Swagger UI).
 *
 * - Os schemas dos DTOs são gerados pelo plugin do `@nestjs/swagger`
 *   (configurado no `nest-cli.json`) a partir dos tipos e dos comentários do
 *   código — a documentação acompanha a validação real da API;
 * - o esquema de segurança é Bearer/JWT, com o botão "Authorize" na UI.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('naPorta API')
    .setDescription(
      [
        'Web API da **naPorta** para gestão de pedidos de entrega.',
        '',
        'Todos os endpoints exigem `Authorization: Bearer <accessToken>`, exceto os marcados',
        'como públicos (cadastro, login, renovação de token e health checks).',
      ].join('\n'),
    )
    .setVersion(readPackageVersion())
    // Os paths do documento já contêm o prefixo (`/api/v1/...`),
    // gerado pelo versionamento URI + prefixo global.
    .addServer('/', 'Servidor local')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token obtido em `POST /api/v1/auth/login`.',
      },
      'bearer',
    )
    .addTag('Autenticação', 'Cadastro, login, renovação de token e perfil do usuário')
    .addTag('Pedidos', 'Criação, consulta, edição e exclusão (lógica) de pedidos')
    .addTag('Usuários', 'Gestão de usuários (restrito ao administrador)')
    .addTag('Health', 'Verificação de liveness e readiness da API')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      // Mantém o token entre as requisições feitas na própria UI.
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
    },
    customSiteTitle: 'naPorta API — documentação',
  });
}
