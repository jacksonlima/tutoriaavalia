/**
 * Cliente Prisma dedicado aos testes de integração.
 *
 * Conecta na DATABASE_URL definida pelo embedded-postgres-setup.ts.
 * Importar este módulo em testes em vez de '@/lib/db' garante isolamento.
 */
import { PrismaClient } from '@prisma/client'

export const testPrisma = new PrismaClient({
  log: ['error', 'warn'],
})

/**
 * Limpa todas as tabelas mantendo o schema. Chamar em beforeEach
 * para isolar cada teste do anterior.
 *
 * Usa TRUNCATE ... CASCADE para resolver foreign keys automaticamente.
 * A ordem das tabelas no array não importa por causa do CASCADE.
 */
export async function truncateAll() {
  // Lista todas as tabelas do schema public (exceto _prisma_migrations)
  const rows = await testPrisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT LIKE '_prisma%'`
  )
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  if (tables.length === 0) return
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`
  )
}
