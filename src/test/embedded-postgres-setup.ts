/**
 * Global setup do Vitest para testes de INTEGRAÇÃO.
 *
 * Sobe um Postgres embutido (`embedded-postgres`) uma única vez por
 * execução do Vitest, aplica o schema do Prisma via `prisma db push`,
 * e injeta `DATABASE_URL` no `process.env` para os testes usarem o
 * PrismaClient normalmente.
 *
 * Ao final, derruba o servidor e remove o diretório de dados temporário.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pg: EmbeddedPostgres | null = null
let dataDir: string | null = null

function pickPort(): number {
  // Faixa de portas alta para evitar conflito com Postgres local
  return 54320 + Math.floor(Math.random() * 1000)
}

export async function setup() {
  dataDir = mkdtempSync(join(tmpdir(), 'tutoriaavalia-pg-'))
  const port = pickPort()
  const user = 'postgres'
  const password = 'postgres'

  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: false,
  })

  await pg.initialise()
  await pg.start()
  await pg.createDatabase('tutoriaavalia_test')

  const databaseUrl = `postgresql://${user}:${password}@localhost:${port}/tutoriaavalia_test`
  process.env.DATABASE_URL = databaseUrl
  process.env.DIRECT_DATABASE_URL = databaseUrl

  // Aplica o schema do Prisma. db push é mais rápido que migrate dev e
  // ideal para testes (sem histórico de migrações).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
  })

  console.log(`\n[test-db] Postgres embutido em ${databaseUrl}\n`)
}

export async function teardown() {
  try {
    if (pg) await pg.stop()
  } catch (e) {
    console.error('[test-db] erro ao parar postgres:', e)
  }
  if (dataDir) {
    try {
      rmSync(dataDir, { recursive: true, force: true })
    } catch (e) {
      console.error('[test-db] erro ao limpar dataDir:', e)
    }
  }
}
