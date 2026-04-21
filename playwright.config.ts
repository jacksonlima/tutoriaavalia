/**
 * TutoriaAvalia v2 — Configuração Playwright (Testes E2E)
 * Autor: Jackson Lima — CESUPA
 *
 * webServer.env garante que as variáveis de ambiente cheguem
 * ao processo do Next.js iniciado pelo Playwright (não herda automaticamente).
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Passa explicitamente as variáveis de ambiente para o processo Next.js
    // O webServer NÃO herda automaticamente o process.env do processo pai
    env: {
      DATABASE_URL:       process.env.DATABASE_URL       ?? '',
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL ?? '',
      NEXTAUTH_SECRET:    process.env.NEXTAUTH_SECRET    ?? 'secret-e2e-local',
      AUTH_SECRET:        process.env.AUTH_SECRET        ?? 'secret-e2e-local',
      AUTH_TRUST_HOST:    process.env.AUTH_TRUST_HOST    ?? 'true',
      NEXTAUTH_URL:       process.env.NEXTAUTH_URL       ?? 'http://localhost:3000',
      ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN ?? '',
      NODE_ENV:           'development',
    },
  },
})
