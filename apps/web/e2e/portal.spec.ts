import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Suíte e2e do portal.
 *
 * Os testes rodam contra a API real (sem mocks).
 *
 * Duas restrições do domínio moldaram o desenho da suíte:
 *
 * 1. **Rate limit de credencial (5/min)** — por isso o usuário é criado uma
 *    única vez e o login acontece uma única vez (no `globalSetup`); o estado da
 *    sessão é salvo e reaproveitado. A suíte consome 3 chamadas de credencial
 *    no total, dentro do limite.
 * 2. **Ordem dos testes** — cada pedido criado usa um nome de cliente
 *    único, para que as asserções não dependam do que os outros testes
 *    deixaram na base.
 */

/**
 * Nome de cliente único por pedido.
 *
 * Cada teste cria o seu: assim as asserções não dependem do que os outros
 * testes deixaram na base (nem da ordem em que rodam).
 */
let contador = 0;

function nomeClienteUnico(): string {
  contador += 1;
  return `Cliente E2E ${Date.now()}-${contador}`;
}

/** Preenche o formulário de novo pedido com um nome de cliente único. */
async function preencherNovoPedido(page: Page, nomeCliente: string): Promise<void> {
  await page.getByRole('main').getByRole('link', { name: 'Novo pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Novo pedido' })).toBeVisible();

  await page.getByLabel('Nome do cliente').fill(nomeCliente);
  await page.getByLabel('CPF ou CNPJ').fill('11144477735');
  await page.getByLabel('Logradouro').fill('Rua das Flores');
  await page.getByLabel('Número').fill('123');
  await page.getByLabel('Bairro').fill('Centro');
  await page.getByLabel('Cidade').fill('Sao Paulo');
  await page.getByLabel('UF').fill('SP');
  await page.getByLabel('CEP').fill('01001000');
  await page.getByLabel('Descrição do item').fill('Caixa de teste');
  await page.getByLabel('Preço unitário').fill('49.90');
}

test('recusa credenciais inválidas', async ({ page }) => {
  // contexto limpo: este teste é justamente sobre não ter sessão
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('ninguem@teste.local');
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('p[role="alert"]')).toContainText('Credenciais inválidas');
  await expect(page).toHaveURL(/\/login/);
});

test('autentica e abre o dashboard com a sessão', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('Usuário E2E');
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
});

test('cria um pedido pelo formulário', async ({ page }) => {
  const nomeCliente = nomeClienteUnico();

  await page.goto('/');
  await preencherNovoPedido(page, nomeCliente);
  await page.getByRole('button', { name: 'Criar pedido' }).click();

  // Vai para o detalhe do pedido criado, com o número gerado pela API.
  await expect(page.getByRole('heading', { name: /^NP-\d{4}-\d{5}$/ })).toBeVisible();
  await expect(page.getByText(nomeCliente)).toBeVisible();
  await expect(page.getByText('Caixa de teste')).toBeVisible();
});

test('altera o status e exclui o pedido', async ({ page }) => {
  const nomeCliente = nomeClienteUnico();

  await page.goto('/');
  await preencherNovoPedido(page, nomeCliente);
  await page.getByRole('button', { name: 'Criar pedido' }).click();

  await expect(page.getByRole('heading', { name: /^NP-\d{4}-\d{5}$/ })).toBeVisible();

  // Avança o status de PENDING até CONFIRMED.
  await page.getByRole('button', { name: 'Marcar como Confirmado' }).click();
  await expect(page.getByText('Confirmado').first()).toBeVisible();

  // Exclui o pedido (com a confirmação no próprio botão).
  await page.getByRole('button', { name: 'Excluir pedido' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();

  // Volta para a listagem, onde o pedido não aparece mais.
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByText(nomeCliente)).toHaveCount(0);
});
