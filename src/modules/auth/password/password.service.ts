import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import type { HashOptions } from 'argon2';

/**
 * Parâmetros do Argon2id.
 *
 * Seguem a recomendação da OWASP (19 MiB de memória, 2 iterações, 1 thread):
 * custo suficiente para tornar o brute force caro, sem penalizar o login.
 *
 * Observação: a tipagem do pacote declara `type` como o *nome* do algoritmo
 * ('argon2id'), mas a implementação nativa espera a constante numérica. A
 * conversão abaixo usa a constante exportada pelo próprio pacote.
 */
const ARGON2_OPTIONS = {
  type: argon2id as unknown as HashOptions['type'],
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} satisfies HashOptions;

/**
 * Hash descartável usado quando o e-mail informado não existe.
 *
 * O login sempre verifica *algum* hash — mesmo sem usuário — para que o tempo
 * de resposta não revele quais e-mails existem na base (timing attack).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$Jc9DXQllws/c9znOVG1BXA$F6vCHeGjji82olqZ2oEMd2mphYiBnmE/HzUR4WGNO7g';

/**
 * Hash de senhas.
 *
 * Fica isolado em um serviço próprio para que o algoritmo possa ser trocado
 * (argon2id → bcrypt, por exemplo) sem tocar no restante da aplicação.
 */
@Injectable()
export class PasswordService {
  /** Gera o hash argon2id da senha. */
  hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /**
   * Confere a senha contra o hash.
   *
   * Devolve `false` (e nunca lança) para hashes corrompidos ou de outro
   * algoritmo — a falha é indistinguível de senha incorreta.
   */
  async verifyPassword(hashValue: string, password: string): Promise<boolean> {
    try {
      return await verify(hashValue, password);
    } catch {
      return false;
    }
  }

  /**
   * Verifica a senha contra um hash descartável.
   *
   * Usado quando o usuário não existe, para equalizar o tempo de resposta do
   * login (evita enumeração de contas).
   */
  async verifyDummy(password: string): Promise<void> {
    await this.verifyPassword(DUMMY_HASH, password);
  }
}
