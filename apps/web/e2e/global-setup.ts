import { chromium, expect } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

/**
 * Preparação da suíte e2e do portal.
 *
 * O `globalSetup` roda **antes** de qualquer contexto de navegador — é o
 * único ponto em que é possível autenticar uma vez e salvar o estado da
 * sessão para todos os testes.
 *
 * Motivos:
 *  - as rotas de credencial têm rate limit de 5/min: a suíte consome 3
 *    chamadas no total (1 cadastro + 1 login + 1 login inválido);
 *  - cada teste começa autenticado, o que testa o fluxo real do portal.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const PORTAL_URL = process.env.PORTAL_URL ?? 'http://localhost:3001';
const AUTH_STATE = 'e2e/.auth/state.json';

const CREDENCIAIS = {
  email: `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@teste.local`,
  password: 'Senha@1234',
};

/** Cria o usuário de teste pela API. */
async function criarUsuario(): Promise<void> {
  const payload = JSON.stringify({
    name: 'Usuário E2E',
    email: CREDENCIAIS.email,
    password: CREDENCIAIS.password,
  });

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (response.ok) {
      return;
    }

    if (response.status !== 429) {
      throw new Error(`Falha ao criar o usuário de teste: ${response.status}`);
    }

    // A janela do rate limit ainda está aberta: espera e tenta de novo.
    await new Promise((resolve) => setTimeout(resolve, 65_000));
  }

  throw new Error('Não foi possível criar o usuário de teste: rate limit de credenciais.');
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await criarUsuario();

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: PORTAL_URL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(CREDENCIAIS.email);
  await page.getByLabel('Senha').fill(CREDENCIAIS.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();

  await context.storageState({ path: AUTH_STATE });
  await context.close();
  await browser.close();
}
