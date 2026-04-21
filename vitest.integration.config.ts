/**
 * TutoriaAvalia v2 — Configuração Vitest (Testes de Integração)
 * Autor: Jackson Lima — CESUPA
 *
 * A opção `env` do Vitest injeta variáveis ANTES de qualquer import de módulo.
 * Isso é necessário porque o Prisma valida DATABASE_URL no momento do import.
 *
 * Em CI: DATABASE_URL vem do workflow (.github/workflows/tests.yml)
 * Local: DATABASE_URL vem do .env.test (carregado via process.env abaixo)
 */
import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

// Carrega .env.test localmente se existir e DATABASE_URL ainda não estiver definida
const envTestPath = path.resolve(__dirname, '.env.test')
if (fs.existsSync(envTestPath) && !process.env.DATABASE_URL) {
  for (const line of fs.readFileSync(envTestPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
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
    // env injeta variáveis ANTES do import dos módulos de teste (Prisma precisa disso)
    env: {
      DATABASE_URL: process.env.DATABASE_URL
        ?? 'postgresql://test:test@localhost:5432/tutoriaavalia_test',
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL
        ?? process.env.DATABASE_URL
        ?? 'postgresql://test:test@localhost:5432/tutoriaavalia_test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
