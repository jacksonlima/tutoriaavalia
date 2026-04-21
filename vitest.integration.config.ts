/**
 * TutoriaAvalia v2 — Configuração Vitest (Testes de Integração)
 * Autor: Jackson Lima — CESUPA
 *
 * Roda: npm run test:integration
 * Em CI: variáveis injetadas pelo workflow (.github/workflows/tests.yml)
 * Local: carrega de .env.test se existir
 */
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'

// Carrega .env.test localmente se o arquivo existir
// Em CI as variáveis já vêm do workflow — não precisa do arquivo
const envTestPath = path.resolve(__dirname, '.env.test')
if (fs.existsSync(envTestPath)) {
  const lines = fs.readFileSync(envTestPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    // Só define se ainda não estiver definida (não sobrescreve o CI)
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    pool: 'forks',
    singleFork: true,
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
