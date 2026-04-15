import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Configuração específica para testes de INTEGRAÇÃO.
 * - Sobe Postgres embutido via globalSetup
 * - Executa apenas arquivos *.integration.test.ts
 * - Roda em série (poolOptions.threads.singleThread) para evitar
 *   condições de corrida no banco de testes compartilhado
 * - Timeout maior (30s) para a primeira inicialização
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globalSetup: ['./src/test/embedded-postgres-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Banco de testes é compartilhado entre os arquivos. Forçamos execução
    // sequencial para que truncateAll() de um arquivo não apague dados que
    // outro arquivo acabou de inserir.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
