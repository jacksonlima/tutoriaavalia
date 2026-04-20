/**
 * TutoriaAvalia v2 — Configuração Vitest (Testes de Integração)
 * Autor: Jackson Lima — CESUPA
 *
 * Roda: npm run test:integration
 * Precisa de um banco PostgreSQL real (veja .env.test).
 * Roda em série para evitar conflitos no banco.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
