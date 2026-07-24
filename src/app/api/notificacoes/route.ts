/**
 * Notas da Tutoria v2
 * Autor: Jackson Lima — CESUPA
 *
 * GET  /api/notificacoes  — lista notificações do tutor logado
 * PATCH /api/notificacoes — marca como lida (uma ou todas)
 *
 * ATENÇÃO: banco tem colunas híbridas por migração parcial.
 * tutor_id = NOT NULL (coluna antiga, tem dados)
 * usuario_id = nullable (coluna nova)
 * Lemos por tutor_id OU usuario_id para cobrir ambos os casos.
 */

import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET — retorna notificações do tutor logado
export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const userId = session?.user?.id!
  const { searchParams } = new URL(req.url)
  const mostrarLidas = searchParams.get('todas') === 'true'

  // SQL raw: busca por tutor_id OU usuario_id (cobre notificações antigas e novas)
  let notificacoes: any[]
  let totalRow: any[]

  if (mostrarLidas) {
    notificacoes = await prisma.$queryRaw`
      SELECT
        id,
        titulo,
        mensagem,
        COALESCE(tipo, 'GERAL') AS tipo,
        lida,
        criada_em AS "criadaEm",
        lida_em   AS "lidaEm"
      FROM notificacoes
      WHERE tutor_id = ${userId} OR usuario_id = ${userId}
      ORDER BY criada_em DESC
      LIMIT 50
    `
  } else {
    notificacoes = await prisma.$queryRaw`
      SELECT
        id,
        titulo,
        mensagem,
        COALESCE(tipo, 'GERAL') AS tipo,
        lida,
        criada_em AS "criadaEm",
        lida_em   AS "lidaEm"
      FROM notificacoes
      WHERE (tutor_id = ${userId} OR usuario_id = ${userId})
        AND lida = false
      ORDER BY criada_em DESC
      LIMIT 50
    `
  }

  totalRow = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM notificacoes
    WHERE (tutor_id = ${userId} OR usuario_id = ${userId})
      AND lida = false
  `

  return NextResponse.json({
    notificacoes,
    totalNaoLidas: totalRow[0]?.total ?? 0,
  })
}

// PATCH — marca como lida (uma ou todas)
export async function PATCH(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const session = await auth()
  if (!session || session?.user?.papel !== 'TUTOR') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const userId = session?.user?.id!
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    await prisma.$executeRaw`
      UPDATE notificacoes
      SET lida = true, lida_em = NOW()
      WHERE id = ${id}
        AND (tutor_id = ${userId} OR usuario_id = ${userId})
    `
  } else {
    await prisma.$executeRaw`
      UPDATE notificacoes
      SET lida = true, lida_em = NOW()
      WHERE (tutor_id = ${userId} OR usuario_id = ${userId})
        AND lida = false
    `
  }

  return NextResponse.json({ ok: true })
}
