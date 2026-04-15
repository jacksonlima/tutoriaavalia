/**
 * Wrapper para rodar a suíte E2E com Postgres embutido.
 *
 * 1. Sobe embedded-postgres
 * 2. Aplica schema via `prisma db push`
 * 3. Seta DATABASE_URL no process.env
 * 4. Invoca `playwright test` como subprocess (herda o env)
 * 5. Ao terminar, derruba Postgres e propaga o exit code
 *
 * O globalSetup do Playwright (e2e/global-setup.ts) fica responsável
 * apenas pelo seed — a infra já está pronta quando ele roda.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 54320 + Math.floor(Math.random() * 500)
const DB_NAME = 'tutoriaavalia_e2e'
const USER = 'postgres'
const PASS = 'postgres'

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), 'tutoriaavalia-e2e-pg-'))
  console.log(`[e2e] Postgres embutido em ${dataDir} (porta ${PORT})...`)

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASS,
    port: PORT,
    persistent: false,
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase(DB_NAME)

  const databaseUrl = `postgresql://${USER}:${PASS}@localhost:${PORT}/${DB_NAME}`
  process.env.DATABASE_URL = databaseUrl
  process.env.DIRECT_DATABASE_URL = databaseUrl
  process.env.NEXTAUTH_SECRET = 'e2e-secret-nao-usar-em-producao'
  process.env.NEXTAUTH_URL = 'http://localhost:3100'
  // Essencial: dev/login só funciona com NODE_ENV=development
  process.env.NODE_ENV = 'development'

  console.log('[e2e] aplicando schema do Prisma...')
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  })

  console.log('[e2e] iniciando Playwright...')
  const pw = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  })

  const cleanup = async () => {
    try {
      await pg.stop()
    } catch (e) {
      console.error('[e2e] erro ao parar postgres:', e)
    }
    try {
      rmSync(dataDir, { recursive: true, force: true })
    } catch {}
  }

  pw.on('exit', async (code) => {
    await cleanup()
    process.exit(code ?? 1)
  })

  // Encerrar Postgres se o wrapper for interrompido
  process.on('SIGINT', async () => {
    pw.kill('SIGINT')
    await cleanup()
    process.exit(130)
  })
}

main().catch((e) => {
  console.error('[e2e] erro fatal:', e)
  process.exit(1)
})
