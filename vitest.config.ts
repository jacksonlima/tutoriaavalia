/**
 * TutoriaAvalia v2 — Configuração Vitest (Testes Unitários)
 * Autor: Jackson Lima — CESUPA
 *
 * Roda: npm run test:run
 * Testa funções puras isoladas — sem banco, sem HTTP, sem browser.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.integration.test.ts', 'e2e/**'],
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
