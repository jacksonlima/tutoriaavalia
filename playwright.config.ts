/**
 * Playwright config para a suíte E2E.
 *
 * A infra (Postgres embutido + env vars + schema) é provisionada pelo
 * wrapper `e2e/run.ts` ANTES do Playwright iniciar — por isso este arquivo
 * só precisa se preocupar com:
 *   - onde estão os specs
 *   - como subir o webServer (Next dev herda DATABASE_URL do wrapper)
 *   - qual globalSetup rodar (só seed, infra já está pronta)
 *
 * Rodamos apenas no Chromium para a suíte ficar rápida (~30s).
 */
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    // env herdado automaticamente do process.env (setado pelo e2e/run.ts)
  },
})
