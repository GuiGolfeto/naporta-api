import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright (testes e2e do portal).
 *
 * O portal fala com a API real: os testes sobem contra a stack completa
 * (API + Postgres), não contra mocks — é o que garante que a integração
 * entre os dois apps funciona de verdade.
 *
 * Variáveis relevantes:
 *   PORTAL_URL  → endereço do portal (padrão: http://localhost:3001)
 *   API_URL     → endereço da API, usada pelo servidor do portal
 */
const portalUrl = process.env.PORTAL_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  // Cria o usuário e autentica uma vez, salvando o estado da sessão.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: portalUrl,
    // A sessão é criada uma única vez (globalSetup) e reaproveitada.
    storageState: 'e2e/.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
